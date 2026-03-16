import {
    EMAIL_EMBEDDING_MAX_CHARS,
    RAG_ATTACHMENT_MIMES,
} from "../config/contant.js";

const decodeBase64Url = (data) => {
    if (!data) return "";
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = normalized.length % 4;
    const padded =
        padLength === 0 ? normalized : normalized + "=".repeat(4 - padLength);
    return Buffer.from(padded, "base64").toString("utf8");
};

const getHeaderValue = (headers, name) => {
    const header = headers.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase()
    );
    return header?.value || "";
};

const findPartByMime = (payload, mimeTypes) => {
    if (!payload) return null;
    if (mimeTypes.includes(payload.mimeType) && payload.body?.data) {
        return payload.body.data;
    }
    if (payload.parts?.length) {
        for (const part of payload.parts) {
            const found = findPartByMime(part, mimeTypes);
            if (found) return found;
        }
    }
    return null;
};

const extractBodyFromPayload = (payload) => {
    const plainData = findPartByMime(payload, ["text/plain"]);
    const htmlData = findPartByMime(payload, ["text/html"]);
    const data = plainData || htmlData || payload?.body?.data;
    return decodeBase64Url(data);
};

const decodeEntities = (text) => {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'");
};

const stripSignatures = (text) => {
    return text
        .replace(/(\n--\s*\n[\s\S]*$)/, "")
        .replace(/\nSent from my .*$/i, "");
};

export const cleanBody = (text) => {
    const noHtml = stripSignatures(text).replace(/<[^>]*>/g, " ");
    const decoded = decodeEntities(noHtml);
    return decoded.replace(/\s+/g, " ").trim();
};

export const extractEmailFields = (gmailMessage) => {
    const payload = gmailMessage.payload || {};
    const headers = payload.headers || [];

    const subject = getHeaderValue(headers, "Subject");
    const from = getHeaderValue(headers, "From");
    const date = getHeaderValue(headers, "Date");
    const messageIdHeader = getHeaderValue(headers, "Message-ID");
    const inReplyTo = getHeaderValue(headers, "In-Reply-To");

    const body = extractBodyFromPayload(payload);
    const messageId = messageIdHeader || gmailMessage.id;

    return {
        subject,
        from,
        date,
        body,
        messageId,
        inReplyTo,
    };
};

export const detectIntentFlags = (body) => {
    return {
        hasAction: /action required|please respond|waiting for your response/i.test(
            body
        ),
        hasDecision: /we decided|final decision|approved/i.test(body),
        hasConfirmation: /confirmed|successfully|completed/i.test(body),
    };
};

/**
 * Split long email body into chunks under maxChars to stay under embedding token limit.
 * Splits at paragraph, then sentence, then word boundaries.
 * @param {string} text - Email body text
 * @param {number} maxChars - Max characters per chunk (default: EMAIL_EMBEDDING_MAX_CHARS)
 * @returns {Array<{text: string, index: number}>}
 */
export const chunkEmailBody = (text, maxChars = EMAIL_EMBEDDING_MAX_CHARS) => {
    if (!text || typeof text !== "string") return [];
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.length <= maxChars) return [{ text: trimmed, index: 0 }];

    const chunks = [];
    let index = 0;

    const pushChunk = (str) => {
        if (str.trim()) {
            chunks.push({ text: str.trim(), index: index++ });
        }
    };

    const splitAtBoundary = (str, limit) => {
        if (str.length <= limit) return { head: str, tail: "" };
        const slice = str.slice(0, limit);
        const lastParagraph = slice.lastIndexOf("\n\n");
        const lastSentence = slice.match(/[^.!?]*[.!?]\s*$/);
        const lastSentenceIdx = lastSentence
            ? slice.lastIndexOf(lastSentence[0])
            : -1;
        const lastSpace = slice.lastIndexOf(" ");

        let splitIdx = limit;
        if (lastParagraph > limit / 2) splitIdx = lastParagraph + 2;
        else if (lastSentenceIdx > limit / 2) splitIdx = lastSentenceIdx + lastSentence[0].length;
        else if (lastSpace > limit / 2) splitIdx = lastSpace + 1;

        return {
            head: str.slice(0, splitIdx).trim(),
            tail: str.slice(splitIdx).trim(),
        };
    };

    let remaining = trimmed;
    while (remaining.length > maxChars) {
        const { head, tail } = splitAtBoundary(remaining, maxChars);
        pushChunk(head);
        remaining = tail;
    }
    pushChunk(remaining);

    return chunks;
};

export const buildEmbeddingText = ({ subject, from, body }) => {
    return `
Subject: ${subject}

From: ${from}

Message:
${body}
    `.trim();
};


const collectAttachmentParts = (payload, acc = []) => {
    if (!payload) return acc;
    if (payload.filename && payload.body?.attachmentId) {
        const mime = (payload.mimeType || "").toLowerCase();
        if (RAG_ATTACHMENT_MIMES.has(mime)) {
            acc.push({
                filename: payload.filename,
                mimeType: payload.mimeType,
                attachmentId: payload.body.attachmentId,
            });
        }
    }
    if (payload.parts?.length) {
        for (const part of payload.parts) {
            collectAttachmentParts(part, acc);
        }
    }
    return acc;
};

export const getRagRelevantAttachments = (gmailMessage) => {
    const payload = gmailMessage?.payload;
    return collectAttachmentParts(payload || {});
};
