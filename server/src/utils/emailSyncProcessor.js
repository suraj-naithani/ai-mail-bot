/**
 * Shared email processing function used by both manual sync (Gmail API) and auto sync (IMAP)
 * Processes emails: extract → clean → embed → Pinecone upsert
 */

import {
    buildEmbeddingText,
    chunkEmailBody,
    cleanBody,
    detectIntentFlags,
    extractEmailFields,
} from "./emailProcessing.js";
import { createEmbeddings } from "./openaiClient.js";
import { getPineconeIndex } from "./pineconeClient.js";

/**
 * Process emails and sync to Pinecone
 * @param {Array} emailData - Array of email objects in extractEmailFields format
 * @param {string} mailboxEmail - Email address of the mailbox (for direction detection)
 * @param {string} namespace - Pinecone namespace (default: "emails")
 * @returns {Promise<{syncedCount: number, attachmentChunksSynced: number, namespace: string}>}
 */
export const processEmailsToPinecone = async (
    emailData,
    mailboxEmail = "",
    namespace = null
) => {
    // Process emails: extract → clean → chunk long bodies → build embedding texts
    const emailChunks = [];
    for (const fields of emailData) {
        const cleanedBody = cleanBody(fields.body);
        const threadId = fields.inReplyTo || fields.messageId;
        const flags = detectIntentFlags(cleanedBody);
        const bodyChunks = chunkEmailBody(cleanedBody);

        for (let i = 0; i < bodyChunks.length; i++) {
            const chunk = bodyChunks[i];
            const embeddingText = buildEmbeddingText({
                subject: fields.subject,
                from: fields.from,
                body: chunk.text,
            });
            const snippet =
                bodyChunks.length === 1
                    ? cleanedBody.slice(0, 1000)
                    : chunk.text.slice(0, 500);

            emailChunks.push({
                ...fields,
                body: cleanedBody,
                threadId,
                embeddingText,
                flags,
                snippet,
                chunkIndex: i,
                totalChunks: bodyChunks.length,
            });
        }
    }

    // Generate embeddings
    const embeddings = await createEmbeddings(
        emailChunks.map((c) => c.embeddingText)
    );

    // Get Pinecone index
    const targetNamespace =
        namespace || process.env.PINECONE_NAMESPACE || "emails";
    const index = getPineconeIndex();
    const target = index.namespace(targetNamespace);

    // Build vectors
    const mailboxEmailLower = mailboxEmail.toLowerCase();
    const vectors = emailChunks.map((chunk, idx) => {
        const vectorId =
            chunk.totalChunks > 1
                ? `${chunk.messageId}_chunk_${chunk.chunkIndex}`
                : chunk.messageId;
        return {
            id: vectorId,
            values: embeddings[idx],
            metadata: {
                docType: "email",
                messageId: chunk.messageId,
                threadId: chunk.threadId,
                source: "gmail",
                date: chunk.date,
                subject: chunk.subject,
                from: chunk.from,
                snippet: chunk.snippet,
                chunkIndex: chunk.chunkIndex,
                totalChunks: chunk.totalChunks,
                direction:
                    mailboxEmailLower &&
                        (chunk.from || "").toLowerCase().includes(mailboxEmailLower)
                        ? "outbound"
                        : "inbound",
                hasAction: chunk.flags.hasAction,
                hasDecision: chunk.flags.hasDecision,
                hasConfirmation: chunk.flags.hasConfirmation,
            },
        };
    });

    // Upsert to Pinecone in batches
    const upsertBatchSize = 100;
    for (let i = 0; i < vectors.length; i += upsertBatchSize) {
        const batch = vectors.slice(i, i + upsertBatchSize);
        await target.upsert(batch);
    }

    return {
        syncedCount: vectors.length,
        attachmentChunksSynced: 0, // Attachments handled separately if needed
        namespace: targetNamespace,
    };
};
