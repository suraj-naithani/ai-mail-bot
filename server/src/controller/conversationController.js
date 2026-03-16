import { randomUUID } from "crypto";
import prisma from "../config/db.js";
import {
    buildCitationsFromMatches,
    generateRagAnswerWithHistory,
    retrieveRelevantEmails,
} from "../utils/ragService.js";
import { createChatCompletionOnce } from "../utils/openaiClient.js";

const HISTORY_LIMIT = 15;
const MEMORY_SUMMARY_MESSAGES = 8;

/** True if the last prior message is from assistant and asked which email to reply to or was a reply draft */
function lastAssistantWasReplyChoiceOrDraft(priorMessages) {
    if (!Array.isArray(priorMessages) || priorMessages.length === 0) return false;
    const last = priorMessages[priorMessages.length - 1];
    if (last?.role !== "system") return false;
    const text = (last.message || "").toLowerCase();
    const askedWhichEmail =
        text.includes("which email") ||
        text.includes("specify which email") ||
        /which email would you like to reply/i.test(text);
    const looksLikeDraft = (last.message || "").includes("**Subject:**") || (last.message || "").length > 200;
    return askedWhichEmail || looksLikeDraft;
}

/** True if the message looks like a greeting or short reply that does not pick an email */
function isGreetingOrNonSpecifier(question) {
    const q = (question || "").trim();
    if (q.length === 0) return false;
    const lower = q.toLowerCase();
    const shortGreetings = [
        "hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "yes", "no",
        "sup", "hola", "hi there", "hello there", "hey there",
    ];
    if (shortGreetings.includes(lower)) return true;
    if (q.length <= 20 && !/\d/.test(q) && !lower.includes("subject") && !lower.includes("number")) return true;
    return false;
}

/** Ensure conversation exists and belongs to req.user */
async function getConversationForUser(conversationId, userId) {
    const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
    });
    return conversation;
}

export const createConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const title = req.body?.title?.trim() || "New chat";
        const conversationId = randomUUID();
        const mem0SessionId = randomUUID();

        await prisma.$transaction([
            prisma.conversation.create({
                data: {
                    id: conversationId,
                    userId,
                    title,
                },
            }),
            prisma.mem0Session.create({
                data: {
                    id: mem0SessionId,
                    conversationId,
                    userId,
                    memory: {},
                },
            }),
        ]);

        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        return res.status(201).json({
            id: conversation.id,
            user_id: conversation.userId,
            title: conversation.title,
            created_at: conversation.createdAt,
            updated_at: conversation.updatedAt,
        });
    } catch (error) {
        console.error("[createConversation]", error);
        return res.status(500).json({
            message: "Failed to create conversation",
            error: error.message,
        });
    }
};

export const listConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const list = await prisma.conversation.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
        });
        return res.json(
            list.map((c) => ({
                id: c.id,
                user_id: c.userId,
                title: c.title,
                created_at: c.createdAt,
                updated_at: c.updatedAt,
            }))
        );
    } catch (error) {
        console.error("[listConversations]", error);
        return res.status(500).json({
            message: "Failed to list conversations",
            error: error.message,
        });
    }
};

export const getConversation = async (req, res) => {
    try {
        const conversation = await getConversationForUser(
            req.params.id,
            req.user.id
        );
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        return res.json({
            id: conversation.id,
            user_id: conversation.userId,
            title: conversation.title,
            created_at: conversation.createdAt,
            updated_at: conversation.updatedAt,
        });
    } catch (error) {
        console.error("[getConversation]", error);
        return res.status(500).json({
            message: "Failed to get conversation",
            error: error.message,
        });
    }
};

export const updateConversationTitle = async (req, res) => {
    try {
        const title = req.body?.title?.trim();
        if (title === undefined || title === "") {
            return res.status(400).json({ message: "Title is required" });
        }
        const updated = await prisma.conversation.updateMany({
            where: { id: req.params.id, userId: req.user.id },
            data: { title },
        });
        if (updated.count === 0) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        const conversation = await prisma.conversation.findUnique({
            where: { id: req.params.id },
        });
        return res.json({
            id: conversation.id,
            user_id: conversation.userId,
            title: conversation.title,
            created_at: conversation.createdAt,
            updated_at: conversation.updatedAt,
        });
    } catch (error) {
        console.error("[updateConversationTitle]", error);
        return res.status(500).json({
            message: "Failed to update conversation",
            error: error.message,
        });
    }
};

export const deleteConversation = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const userId = req.user.id;

        const conversation = await getConversationForUser(
            conversationId,
            userId
        );
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        await prisma.$transaction([
            prisma.chat.deleteMany({
                where: { conversationId, userId },
            }),
            prisma.mem0Session.deleteMany({
                where: { conversationId, userId },
            }),
            prisma.conversation.deleteMany({
                where: { id: conversationId, userId },
            }),
        ]);

        return res.status(204).end();
    } catch (error) {
        console.error("[deleteConversation]", error);
        return res.status(500).json({
            message: "Failed to delete conversation",
            error: error.message,
        });
    }
};

export const getChats = async (req, res) => {
    try {
        const conversation = await getConversationForUser(
            req.params.id,
            req.user.id
        );
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        const chats = await prisma.chat.findMany({
            where: {
                conversationId: req.params.id,
                userId: req.user.id,
            },
            orderBy: { sequence: "asc" },
        });

        return res.json(
            chats.map((c) => ({
                id: c.id,
                conversation_id: c.conversationId,
                user_id: c.userId,
                role: c.role,
                message: c.message,
                sequence: c.sequence,
                created_at: c.createdAt,
            }))
        );
    } catch (error) {
        console.error("[getChats]", error);
        return res.status(500).json({
            message: "Failed to get chats",
            error: error.message,
        });
    }
};

async function updateConversationMemory(conversationId, userId, newSummary) {
    const session = await prisma.mem0Session.findFirst({
        where: { conversationId, userId },
    });
    if (!session) return;
    const current = (session.memory && typeof session.memory === "object") ? session.memory : {};
    const merged = {
        ...current,
        summary:
            typeof newSummary === "string" && newSummary.trim()
                ? newSummary.trim().slice(0, 2000)
                : current.summary || "",
        updatedAt: new Date().toISOString(),
    };
    await prisma.mem0Session.updateMany({
        where: { conversationId, userId },
        data: { memory: merged },
    });
}

async function generateConversationTitle(conversationId, userId, firstMessage) {
    try {
        const titlePrompt = `Create a short, specific conversation title (2–5 words) based on the user's first message below.
                            Requirements:
                            - Capture the main topic or intent.
                            - Use natural, human-like phrasing.
                            - No quotes, punctuation at the end, or explanations.
                            - Output title only.

                            First message:${firstMessage.slice(0, 200)}`;

        const generatedTitle = await createChatCompletionOnce({
            messages: [
                {
                    role: "user",
                    content: titlePrompt,
                },
            ],
            temperature: 0.3,
            maxTokens: 30,
        });

        const trimmedTitle = generatedTitle.trim().replace(/^["']|["']$/g, "").slice(0, 100);
        if (trimmedTitle && trimmedTitle.length > 0) {
            await prisma.conversation.updateMany({
                where: { id: conversationId, userId },
                data: { title: trimmedTitle },
            });
            return trimmedTitle;
        }
        return null;
    } catch (error) {
        console.error("[generateConversationTitle]", error);
        return null;
    }
}

export const sendMessage = async (req, res) => {
    const question = req.body?.message?.trim() || req.body?.question?.trim();
    if (!question) {
        return res.status(400).json({ message: "Message is required" });
    }

    const conversationId = req.params.id;
    const userId = req.user.id;

    try {
        const conversation = await getConversationForUser(
            conversationId,
            userId
        );
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found" });
        }

        const { _max: { sequence: maxSeq } } = await prisma.chat.aggregate({
            where: { conversationId, userId },
            _max: { sequence: true },
        });
        const nextSequence = (maxSeq ?? 0) + 1;

        const userChatId = randomUUID();
        await prisma.chat.create({
            data: {
                id: userChatId,
                conversationId,
                userId,
                role: "user",
                message: question,
                sequence: nextSequence,
            },
        });

        const chatCount = await prisma.chat.count({
            where: { conversationId, userId },
        });
        
        // Start title generation in parallel for first message
        let titleGenerationPromise = null;
        if (chatCount === 1) {
            titleGenerationPromise = generateConversationTitle(conversationId, userId, question).catch(
                (err) => {
                    console.warn("[sendMessage] Title generation failed:", err.message);
                    return null;
                }
            );
        }

        const chatsAfter = await prisma.chat.findMany({
            where: { conversationId, userId },
            orderBy: { sequence: "asc" },
        });
        const lastN = chatsAfter.slice(-HISTORY_LIMIT);
        const priorMessages = lastN.slice(0, -1).map((c) => ({
            role: c.role,
            message: c.message,
        }));

        const mem0Session = await prisma.mem0Session.findFirst({
            where: { conversationId, userId },
        });
        const memory = mem0Session?.memory && typeof mem0Session.memory === "object"
            ? mem0Session.memory
            : {};

        const connection = await prisma.gmailConnection.findFirst({
            where: { adminUserId: userId },
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

        res.write(
            JSON.stringify({
                type: "metadata",
                citations,
                matchCount: matches.length,
            }) + "\n"
        );

        // Handle title generation completion - send it through the stream when ready
        if (titleGenerationPromise) {
            titleGenerationPromise.then((generatedTitle) => {
                if (generatedTitle && !res.destroyed && !res.closed) {
                    try {
                        res.write(JSON.stringify({ type: "title", title: generatedTitle }) + "\n");
                        if (typeof res.flush === "function") {
                            res.flush();
                        }
                    } catch (err) {
                        // Stream may have closed, ignore
                        console.warn("[sendMessage] Failed to send title update:", err.message);
                    }
                }
            }).catch(() => {
                // Already handled in generateConversationTitle
            });
        }

        const forceRespondToMessage =
            lastAssistantWasReplyChoiceOrDraft(priorMessages) && isGreetingOrNonSpecifier(question);
        let fullContent = "";
        const stream = generateRagAnswerWithHistory(question, matches, {
            priorMessages,
            memory,
            userEmail: mailboxEmail,
            forceRespondToMessage,
        });
        for await (const chunk of stream) {
            fullContent += chunk;
            res.write(JSON.stringify({ type: "chunk", content: chunk }) + "\n");
            if (typeof res.flush === "function") {
                res.flush();
            }
        }

        const systemChatId = randomUUID();
        await prisma.chat.create({
            data: {
                id: systemChatId,
                conversationId,
                userId,
                role: "system",
                message: fullContent || "No answer available.",
                sequence: nextSequence + 1,
            },
        });

        const chatsForSummary = await prisma.chat.findMany({
            where: { conversationId, userId },
            orderBy: { sequence: "asc" },
        });
        const lastForSummary = chatsForSummary.slice(-MEMORY_SUMMARY_MESSAGES);
        if (lastForSummary.length > 0) {
            try {
                const summaryPrompt = [
                    "Summarize this conversation in 1-2 short sentences for context in future turns. Only output the summary, no preamble.",
                    "",
                    ...lastForSummary.map((c) =>
                        `${c.role}: ${c.message.slice(0, 500)}`
                    ),
                ].join("\n");
                const summary = await createChatCompletionOnce({
                    messages: [
                        {
                            role: "user",
                            content: summaryPrompt,
                        },
                    ],
                    temperature: 0.2,
                    maxTokens: 150,
                });
                await updateConversationMemory(
                    conversationId,
                    userId,
                    summary
                );
            } catch (memErr) {
                console.warn("[sendMessage] Memory update failed:", memErr.message);
            }
        }

        res.write(JSON.stringify({ type: "done" }) + "\n");
        res.end();
    } catch (error) {
        console.error("[sendMessage]", error);
        if (res.headersSent) {
            res.write(
                JSON.stringify({
                    type: "error",
                    message: error.message || "Failed to send message",
                }) + "\n"
            );
            res.end();
        } else {
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json({
                message: "Failed to send message",
                error: error.message,
            });
        }
    }
};
