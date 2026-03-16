/**
 * IMAP service for auto-syncing new emails
 * Runs independently, uses env credentials (IMAP_USER, IMAP_APP_PASSWORD)
 * When new mail arrives → fetch → parse → process → Pinecone
 */

import Imap from "imap";
import { simpleParser } from "mailparser";
import { convertMailparserToEmailFields } from "../utils/imapConverter.js";
import { processEmailsToPinecone } from "../utils/emailSyncProcessor.js";
import prisma from "../config/db.js";

let imap = null;
let isConnected = false;
let reconnectTimeout = null;

/**
 * Get mailbox email from GmailConnection or env
 */
const getMailboxEmail = async () => {
    const imapUser = process.env.IMAP_USER;
    if (!imapUser) return "";

    // Try to find GmailConnection for this email
    try {
        const connection = await prisma.gmailConnection.findFirst({
            where: {
                googleAccountEmail: imapUser.toLowerCase(),
            },
            orderBy: { updatedAt: "desc" },
        });
        if (connection) {
            return connection.googleAccountEmail;
        }
    } catch (err) {
        console.warn("[IMAP] Could not lookup mailbox email:", err.message);
    }

    return imapUser.toLowerCase();
};

/**
 * Process a single email fetched via IMAP
 */
const processImapEmail = async (parsedEmail) => {
    try {
        // Convert mailparser output to extractEmailFields format
        const emailFields = convertMailparserToEmailFields(parsedEmail);

        // Get mailbox email for direction detection
        const mailboxEmail = await getMailboxEmail();

        // Process to Pinecone using shared function
        const result = await processEmailsToPinecone(
            [emailFields],
            mailboxEmail
        );

        console.log(
            `[IMAP] Processed new email: ${emailFields.subject} (${result.syncedCount} synced)`
        );
        return result;
    } catch (error) {
        console.error("[IMAP] Error processing email:", error.message);
        throw error;
    }
};

/**
 * Fetch and process latest email(s) from IMAP
 * Filters to only INBOX and SENT emails using Gmail's X-GM-RAW search
 */
const fetchLatestEmails = async (imapInstance, count = 1) => {
    return new Promise((resolve, reject) => {
        // Use Gmail's X-GM-RAW search to filter only INBOX and SENT emails
        // This excludes archived, drafts, and other labels
        // Gmail search syntax: label:INBOX OR label:SENT
        imapInstance.search([['X-GM-RAW', 'label:INBOX OR label:SENT']], (searchErr, results) => {
            if (searchErr) {
                // Fallback: if Gmail label search fails, use regular fetch
                console.warn("[IMAP] Gmail label search failed, using fallback:", searchErr.message);
                const range = count === 1 ? "*" : `*-${count - 1}:*`;
                const fetch = imapInstance.seq.fetch(range, { bodies: "" });
                processFetch(fetch, count, resolve, reject);
                return;
            }

            if (!results || results.length === 0) {
                resolve([]);
                return;
            }

            // Get the latest N emails from search results
            const latestUids = results.slice(-count);
            const fetch = imapInstance.fetch(latestUids, { bodies: "" });
            processFetch(fetch, count, resolve, reject);
        });
    });
};

/**
 * Helper function to process IMAP fetch results
 */
const processFetch = (fetch, expectedCount, resolve, reject) => {
    const emails = [];
    let processed = 0;
    let hasError = false;

    fetch.on("message", (msg, seqno) => {
        msg.on("body", async (stream) => {
            try {
                const parsed = await simpleParser(stream);
                emails.push(parsed);
                processed++;

                // Process each email
                await processImapEmail(parsed);

                // Resolve when all processed
                if (processed === expectedCount && !hasError) {
                    resolve(emails);
                }
            } catch (err) {
                hasError = true;
                console.error("[IMAP] Error parsing email:", err.message);
                processed++;
                if (processed === expectedCount) {
                    reject(err);
                }
            }
        });

        msg.once("end", () => {
            // Message fetch complete
        });
    });

    fetch.once("error", (err) => {
        hasError = true;
        reject(err);
    });

    fetch.once("end", () => {
        if (!hasError && processed === 0) {
            // No new emails
            resolve([]);
        } else if (!hasError && processed < expectedCount) {
            // Some emails processed, resolve with what we have
            resolve(emails);
        }
    });
};

/**
 * Start IMAP connection and IDLE listener
 */
export const startImapService = () => {
    const imapUser = process.env.IMAP_USER;
    const imapPassword = process.env.IMAP_APP_PASSWORD;

    if (!imapUser || !imapPassword) {
        console.warn(
            "[IMAP] IMAP_USER or IMAP_APP_PASSWORD not set. Skipping IMAP service."
        );
        return;
    }

    console.log(`[IMAP] Starting IMAP service for ${imapUser}...`);

    imap = new Imap({
        user: imapUser,
        password: imapPassword,
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: {
            interval: 10000, // Send NOOP every 10 seconds to keep connection alive
            idleInterval: 120000, // Resend IDLE every 2 minutes
        },
    });

    imap.once("ready", () => {
        console.log("[IMAP] Connected successfully");
        isConnected = true;

        // Monitor [Gmail]/All Mail folder (contains inbox, sent, archived, replies, entire threads)
        // We filter to only process INBOX and SENT emails using Gmail label search
        imap.openBox("[Gmail]/All Mail", false, (err, box) => {
            if (err) {
                console.error("[IMAP] Error opening [Gmail]/All Mail:", err.message);
                return;
            }

            console.log("[IMAP] Listening for new emails in [Gmail]/All Mail (filtering to INBOX + SENT only)...");

            // Start IDLE mode
            imap.on("mail", async () => {
                console.log("[IMAP] New email detected in [Gmail]/All Mail!");
                try {
                    // Fetch and process latest email
                    // fetchLatestEmails will filter to only INBOX and SENT emails using Gmail label search
                    await fetchLatestEmails(imap, 1);
                } catch (err) {
                    console.error("[IMAP] Error fetching new email:", err.message);
                }
            });
        });
    });

    imap.once("error", (err) => {
        console.error("[IMAP] Connection error:", err.message);
        isConnected = false;
        scheduleReconnect();
    });

    imap.once("end", () => {
        console.log("[IMAP] Connection ended");
        isConnected = false;
        scheduleReconnect();
    });

    // Connect
    // Note: keepalive is handled automatically by the Imap constructor options above
    imap.connect();
};

/**
 * Schedule reconnection after delay
 */
const scheduleReconnect = () => {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }

    reconnectTimeout = setTimeout(() => {
        console.log("[IMAP] Attempting to reconnect...");
        if (imap) {
            imap.end();
        }
        startImapService();
    }, 30000); // Reconnect after 30 seconds
};

/**
 * Stop IMAP service
 */
export const stopImapService = () => {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (imap) {
        imap.end();
        imap = null;
    }

    isConnected = false;
    console.log("[IMAP] Service stopped");
};
