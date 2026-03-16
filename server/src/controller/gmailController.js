import {
    extractEmailFields,
    getRagRelevantAttachments,
} from "../utils/emailProcessing.js";
import { processEmailsToPinecone } from "../utils/emailSyncProcessor.js";
import { parseAndChunkDocument } from "../utils/documentProcessor.js";
import { createEmbeddings } from "../utils/openaiClient.js";
import { getPineconeIndex } from "../utils/pineconeClient.js";
import {
    getAttachmentContent,
    getGmailClientForUser,
    listGmailMessages,
} from "../utils/gmailService.js";
import prisma from "../config/db.js";
import {
    buildCitationsFromMatches,
    generateRagAnswer,
    retrieveRelevantEmails,
} from "../utils/ragService.js";

/** Max attachment size to parse for RAG (bytes). */
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

const buildListOptions = (query, defaults) => {
    const maxResults = Math.min(
        Math.max(parseInt(query.maxResults, 10) || defaults.maxResults, 1),
        100
    );
    const fetchAll = query.all === "true";
    const maxTotal = Math.max(
        parseInt(query.maxTotal, 10) || defaults.maxTotal,
        1
    );
    const labelIds = query.labelIds
        ? query.labelIds.split(",").filter(Boolean)
        : undefined;
    const q = query.q || undefined;

    return { maxResults, fetchAll, maxTotal, labelIds, q, pageToken: query.pageToken };
};

export const handleGmailCallback = (req, res) => {
    res.redirect(`${process.env.CLIENT_URL}/gmail-sync`);
};

export const getMessages = async (req, res) => {
    try {
        const gmail = await getGmailClientForUser(req.user?.id);
        const { maxResults, fetchAll, maxTotal, labelIds, q, pageToken } =
            buildListOptions(req.query, { maxResults: 20, maxTotal: 200 });

        const { messages, nextPageToken, resultSizeEstimate } =
            await listGmailMessages(gmail, {
                maxResults,
                fetchAll,
                maxTotal,
                q,
                labelIds,
                pageToken,
            });

        const messageDetails = await Promise.all(
            messages.map(async (msg) => {
                const detail = await gmail.users.messages.get({
                    userId: "me",
                    id: msg.id,
                    format: "metadata",
                    metadataHeaders: ["Subject", "From", "Date"],
                });

                const headers = detail.data.payload?.headers || [];
                const headerMap = headers.reduce((acc, header) => {
                    acc[header.name] = header.value;
                    return acc;
                }, {});

                return {
                    id: detail.data.id,
                    threadId: detail.data.threadId,
                    snippet: detail.data.snippet,
                    subject: headerMap.Subject || "",
                    from: headerMap.From || "",
                    date: headerMap.Date || "",
                };
            })
        );

        return res.json({
            messages: messageDetails,
            nextPageToken,
            resultSizeEstimate,
            fetchedCount: messageDetails.length,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            message: "Failed to fetch Gmail messages",
            error: error.message,
        });
    }
};

export const syncMessages = async (req, res) => {
    try {
        const gmail = await getGmailClientForUser(req.user?.id);
        await prisma.gmailConnection.updateMany({
            where: { adminUserId: req.user?.id },
            data: { syncStatus: "syncing" },
        });
        const { maxResults, fetchAll, maxTotal, labelIds, q, pageToken } =
            buildListOptions(req.query, { maxResults: 25, maxTotal: 200 });

        // Default to INBOX + SENT if no labelIds specified (sync sent and received emails only)
        const syncLabelIds = labelIds || ["INBOX", "SENT"];

        const { messages } = await listGmailMessages(gmail, {
            maxResults,
            fetchAll,
            maxTotal,
            q,
            labelIds: syncLabelIds,
            pageToken,
        });

        const details = [];
        const batchSize = 10;
        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            const batchDetails = await Promise.all(
                batch.map((msg) =>
                    gmail.users.messages.get({
                        userId: "me",
                        id: msg.id,
                        format: "full",
                    })
                )
            );
            details.push(...batchDetails);
        }

        const connection = await prisma.gmailConnection.findFirst({
            where: { adminUserId: req.user?.id },
            orderBy: { updatedAt: "desc" },
        });
        const mailboxEmail = (
            connection?.googleAccountEmail ||
            req.user?.email ||
            ""
        ).toLowerCase();

        const namespace = process.env.PINECONE_NAMESPACE || "emails";
        const emailData = details.map((d) => extractEmailFields(d.data));

        const { syncedCount, namespace: resolvedNamespace } =
            await processEmailsToPinecone(emailData, mailboxEmail, namespace);

        const index = getPineconeIndex();
        const target = index.namespace(resolvedNamespace);

        let attachmentChunksSynced = 0;

        for (let d = 0; d < details.length; d++) {
            const detail = details[d];
            const emailMeta = extractEmailFields(detail.data);
            const msgId = detail.data.id;
            const subject = emailMeta?.subject ?? "";
            const from = emailMeta?.from ?? "";
            const date = emailMeta?.date ?? "";
            const threadId = emailMeta?.inReplyTo || emailMeta?.messageId || msgId;

            const attachments = getRagRelevantAttachments(detail.data);
            for (const att of attachments) {
                try {
                    const buffer = await getAttachmentContent(
                        gmail,
                        msgId,
                        att.attachmentId
                    );
                    if (buffer.length > MAX_ATTACHMENT_SIZE) continue;
                    if (buffer.length === 0) continue;

                    const chunks = await parseAndChunkDocument(
                        buffer,
                        att.mimeType,
                        att.filename
                    );
                    if (!chunks.length) continue;

                    const embeddingTexts = chunks.map(
                        (c) =>
                            `Attachment: ${att.filename}\nFrom email: ${subject}\nFrom: ${from}\n\nContent:\n${c.text}`
                    );
                    const chunkEmbeddings = await createEmbeddings(embeddingTexts);

                    const attVectors = chunks.map((c, i) => ({
                        id: `${msgId}_att_${att.attachmentId}_${c.index}`,
                        values: chunkEmbeddings[i],
                        metadata: {
                            docType: "attachment",
                            messageId: msgId,
                            threadId,
                            filename: att.filename,
                            mimeType: att.mimeType,
                            subject,
                            from,
                            date,
                            snippet: c.text.slice(0, 500),
                            chunkIndex: c.index,
                        },
                    }));

                    for (let i = 0; i < attVectors.length; i += upsertBatchSize) {
                        const batch = attVectors.slice(
                            i,
                            i + upsertBatchSize
                        );
                        await target.upsert(batch);
                    }
                    attachmentChunksSynced += attVectors.length;
                } catch (err) {
                    console.warn(
                        `[sync] Skip attachment ${att.filename} (${msgId}):`,
                        err.message
                    );
                }
            }
        }

        await prisma.gmailConnection.updateMany({
            where: { adminUserId: req.user?.id },
            data: { syncStatus: "connected", lastSyncedAt: new Date() },
        });

        return res.json({
            syncedCount,
            attachmentChunksSynced,
            namespace: resolvedNamespace,
        });
    } catch (error) {
        await prisma.gmailConnection.updateMany({
            where: { adminUserId: req.user?.id },
            data: { syncStatus: "error" },
        });
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            message: "Failed to sync Gmail messages to Pinecone",
            error: error.message,
        });
    }
};

export const streamAiResponse = async (req, res) => {
    const question = req.body?.question?.trim();
    if (!question) {
        return res.status(400).json({ message: "Question is required" });
    }

    try {
        const connection = await prisma.gmailConnection.findFirst({
            where: { adminUserId: req.user?.id },
            orderBy: { updatedAt: "desc" },
        });
        const mailboxEmail =
            connection?.googleAccountEmail || req.user?.email || "";

        const topK = req.body?.topK;
        const matches = await retrieveRelevantEmails(question, { topK });
        const citations = buildCitationsFromMatches(matches);

        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }

        // First line: metadata (citations, matchCount)
        res.write(
            JSON.stringify({
                type: "metadata",
                citations,
                matchCount: matches.length,
            }) + "\n"
        );

        const stream = generateRagAnswer(question, matches, {
            userEmail: mailboxEmail,
        });
        for await (const chunk of stream) {
            res.write(JSON.stringify({ type: "chunk", content: chunk }) + "\n");
            if (typeof res.flush === "function") {
                res.flush();
            }
        }

        res.write(JSON.stringify({ type: "done" }) + "\n");
        res.end();
    } catch (error) {
        if (res.headersSent) {
            res.write(
                JSON.stringify({
                    type: "error",
                    message: error.message || "Failed to generate answer",
                }) + "\n"
            );
            res.end();
        } else {
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json({
                message: "Failed to generate answer",
                error: error.message,
            });
        }
    }
};
