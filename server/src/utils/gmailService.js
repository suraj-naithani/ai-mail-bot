import { google } from "googleapis";
import prisma from "../config/db.js";
import { decrypt } from "./encrypt.js";

export const getGmailClientForUser = async (userId) => {
    const connection = await prisma.gmailConnection.findFirst({
        where: { adminUserId: userId },
        orderBy: { updatedAt: "desc" },
    });

    if (!connection) {
        const error = new Error("No Gmail connection found");
        error.statusCode = 404;
        throw error;
    }

    const refreshToken = decrypt(connection.refreshToken);
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "/auth/gmail/callback"
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    return google.gmail({ version: "v1", auth: oauth2Client });
};

export const listGmailMessages = async (gmail, options) => {
    const { maxResults, fetchAll, maxTotal, q, labelIds, pageToken } = options;
    const allMessages = [];
    let nextPageToken = pageToken || undefined;

    do {
        const listRes = await gmail.users.messages.list({
            userId: "me",
            maxResults,
            pageToken: nextPageToken,
            q,
            labelIds,
        });

        const messages = listRes.data.messages || [];
        allMessages.push(...messages);
        nextPageToken = listRes.data.nextPageToken;

        if (!fetchAll) {
            return {
                messages,
                nextPageToken,
                resultSizeEstimate: listRes.data.resultSizeEstimate,
            };
        }
    } while (fetchAll && nextPageToken && allMessages.length < maxTotal);

    return {
        messages: allMessages.slice(0, maxTotal),
        nextPageToken: fetchAll ? nextPageToken : undefined,
        resultSizeEstimate: allMessages.length,
    };
};

const decodeBase64UrlToBuffer = (data) => {
    if (!data) return Buffer.alloc(0);
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = normalized.length % 4;
    const padded =
        padLength === 0 ? normalized : normalized + "=".repeat(4 - padLength);
    return Buffer.from(padded, "base64");
};

export const getAttachmentContent = async (gmail, messageId, attachmentId) => {
    const res = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: attachmentId,
    });
    const data = res.data?.data;
    return decodeBase64UrlToBuffer(data);
};
