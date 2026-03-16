import { createEmbeddings, createChatCompletion } from "./openaiClient.js";
import { getPineconeIndex } from "./pineconeClient.js";

const buildEmailContext = (metadata, index) => {
    const subject = metadata?.subject || "Unknown subject";
    const from = metadata?.from || "Unknown sender";
    const date = metadata?.date || "Unknown date";
    const snippet = metadata?.snippet || "";
    const sentByYou = metadata?.direction === "outbound" ? " (sent by you)" : "";

    return [
        `Email ${index + 1}:`,
        `Subject: ${subject}`,
        `From: ${from}${sentByYou}`,
        `Date: ${date}`,
        snippet ? `Snippet: ${snippet}` : "Snippet: (no snippet available)",
    ].join("\n");
};

const buildAttachmentContext = (metadata, index) => {
    const filename = metadata?.filename || "Unknown file";
    const subject = metadata?.subject || "";
    const from = metadata?.from || "";
    const snippet = metadata?.snippet || "";

    return [
        `Document ${index + 1} (attachment: ${filename}):`,
        subject ? `From email subject: ${subject}` : "",
        from ? `From: ${from}` : "",
        snippet ? `Content excerpt: ${snippet}` : "Content: (no excerpt)",
    ]
        .filter(Boolean)
        .join("\n");
};

const sortMatchesByDate = (matches) => {
    const getTime = (m) => {
        const d = m?.metadata?.date;
        if (!d) return Infinity;
        const t = new Date(d).getTime();
        return Number.isNaN(t) ? Infinity : t;
    };
    return [...matches].sort((a, b) => getTime(a) - getTime(b));
};

export const retrieveRelevantEmails = async (
    question,
    { topK = 6, namespace, filter } = {}
) => {
    const cleanQuestion = question?.trim();
    if (!cleanQuestion) {
        return [];
    }

    const [embedding] = await createEmbeddings([cleanQuestion]);
    if (!embedding) {
        return [];
    }

    const resolvedTopK = Math.min(Math.max(parseInt(topK, 10) || 6, 1), 20);
    const resolvedNamespace = namespace || process.env.PINECONE_NAMESPACE || "emails";
    const resolvedFilter = filter ?? { docType: { $in: ["email", "attachment"] } };

    const index = getPineconeIndex();
    const target = index.namespace(resolvedNamespace);
    const result = await target.query({
        vector: embedding,
        topK: resolvedTopK,
        includeMetadata: true,
        filter: resolvedFilter,
    });

    const matches = result.matches || [];
    return sortMatchesByDate(matches);
};

export const buildContextFromMatches = (matches = []) => {
    if (!matches.length) {
        return "";
    }

    return matches
        .map((match, index) => {
            const meta = match.metadata || {};
            return meta.docType === "attachment"
                ? buildAttachmentContext(meta, index)
                : buildEmailContext(meta, index);
        })
        .join("\n\n");
};

export const buildCitationsFromMatches = (matches = []) =>
    matches.map((match) => {
        const metadata = match.metadata || {};
        const docType = metadata.docType || "email";
        return {
            id: match.id,
            score: match.score,
            docType,
            subject: metadata.subject || "",
            from: metadata.from || "",
            date: metadata.date || "",
            threadId: metadata.threadId || "",
            snippet: metadata.snippet || "",
            filename: metadata.filename || "",
        };
    });

const CHAT_MAX_TOKENS =
    parseInt(process.env.OPENAI_CHAT_MAX_TOKENS, 10) || 500;

const getBaseSystemPrompt = (userEmail = "") => {
    let prompt =
        "You are a helpful assistant that answers questions using the provided context, which may include emails and documents (attachments such as PDFs, Word files, or text files). " +
        "Use both email content and document excerpts to answer. If the context does not contain the answer, say you do not have enough information. " +

        // === NEW: CLARIFICATION LOGIC (this was missing/weak before) ===
        "When the user wants you to draft ANY email (reply, follow-up, or new email): " +
        "You MUST first gather these three pieces of information before writing anything: " +
        "1. The exact recipient (or thread). " +
        "2. The specific thread/email they are referring to (if there are multiple possible ones). " +
        "3. The main topic/purpose of the email. " +

        "If the user's message is vague or incomplete (e.g. 'hi I want to send a reply', 'write an email', 'reply to that thing'), do NOT generate a draft. " +
        "Instead, ask ONE short, clear clarifying question that gets you closer to all three pieces above. " +
        "Example: 'Sure, happy to help with a reply. Which thread or person are you replying to?' " +
        "Or: 'Got it — who should this email go to, and what's the main topic?' " +

        "If the user gives everything in one clear message (e.g. 'write a reply to the Cursor gang about project development and deadline'), and the context contains matching emails, proceed directly to drafting. " +
        "Never assume a thread or recipient. " +

        // === THREAD SELECTION (improved) ===
        "When the user asks to generate or draft a reply/follow-up email: " +
        "If the context contains multiple distinct emails/threads that could match (different subjects, senders, or dates), do NOT generate a draft yet. " +
        "List the options using a single sequential list: 1., 2., 3. — one number per option (one thread per option). " +
        "Use only: subject, from, and date in each line. Example: 1. [Subject] (From: …, Date: …). " +
        "Include ONLY emails (labelled 'Email 1:', 'Email 2:', …). Do not include documents. " +
        "Then ask: \"Which email/thread would you like to reply to?\" " +
        "Only generate a draft after the user specifies which one (by number, subject, or topic). " +
        "If your previous message already asked for clarification and the user's current message is vague ('hi', 'hello', etc.), do not repeat the list — just respond naturally (e.g. greet and ask how you can help). " +

        // === CORE EMAIL DRAFTING LOGIC (this is the big fix) ===
        "When you have all the required info and are generating a reply or follow-up draft: " +
        "1. Look at the FULL conversation thread for the selected email (all emails in that thread, in order). " +
        "2. Identify the MOST RECENT email in that thread (the last one shown, or the one with the latest date). " +
        "3. Check who sent that most recent email: " +
        "   - If the From field contains the user's email (" + (userEmail || "the user's email") + ") " +
        "     OR it is marked as 'sent by you', 'outbound', 'From: you', etc. → this is a FOLLOW-UP (you sent last). " +
        "   - Otherwise → this is a REPLY (someone else sent last). " +

        "Act as a strict professional email assistant. " +
        "TONE: Warm and collaborative, like a team lead checking in — not formal or policy-like. Professional but warm; calm; clear; natural. " +

        "EMAIL STRUCTURE (follow exactly — but the opener changes based on reply vs follow-up): " +
        "**Subject:** [contextual subject — keep or build on the original thread subject]. " +
        "Hi [receiver's first name or appropriate greeting], " +
        "I hope you're doing well. " +

        // === DYNAMIC OPENER (this fixes the "always follow-up" bug) ===
        "[Opener — choose based on the decision above]: " +
        "   • If it is a REPLY (someone else sent the last message): " +
        "     Use one of these natural reply openers: 'Thanks for your email' / 'Thanks for the update on...' / 'I wanted to respond to your message regarding...' / 'Great to hear from you about...' " +
        "   • If it is a FOLLOW-UP (you sent the last message): " +
        "     Use one of these natural follow-up openers: 'I wanted to follow up on our discussion regarding...' / 'Just checking in on...' / 'Wanted to follow up regarding...' / 'Following up on my last email about...' " +

        "[Main message: Respond directly to the content of the most recent email in the thread. " +
        "Analyze the entire conversation for context and accuracy, but do not summarize the whole thread in the email. " +
        "Frame the request or response as a gentle confirmation with reasoning (e.g. 'Please confirm that you're set to…' + why it matters). " +
        "Use short, clear sentences. Address the exact points from the last email. " +
        "Keep it collaborative and supportive.] " +

        "Let me know if you need any clarification, resources, or support before we begin. " +
        "[Forward-looking close: Looking forward to your thoughts / confirmation / next steps.] " +
        "Best regards, " +
        "[Your name / sender]. " +

        "RULES: " +
        "• Always include 'I hope you're doing well' as the first line after greeting. " +
        "• Never use transactional or cold phrases like 'Thank you for your update. We can proceed with...' or 'Please ensure'. " +
        "• Frame requests as confirmations with reasoning, not directives. " +
        "• Keep the support line exactly as: 'Let me know if you need any clarification, resources, or support before we begin.' " +
        "• CRITICAL: Output ONLY the email. No preamble, no 'Based on the context...', no 'Here is your draft', no thinking steps. Start directly with **Subject:**. " +

        // === USER EMAIL (now more robust) ===
        (userEmail && typeof userEmail === "string" && userEmail.trim()
            ? ` The user's email address is ${userEmail.trim()}. Use this to accurately detect whether the most recent email in a thread was sent by the user. `
            : "");

    return prompt;
};

// const getBaseSystemPrompt = (userEmail = "") => {
//     let prompt =
//         "You are a helpful assistant that answers questions using the provided context, which may include emails and documents (attachments such as PDFs, Word files, or text files). " +
//         "Use both email content and document excerpts to answer. If the context does not contain the answer, say you do not have enough information. If you are not at least 90% sure what the user wants, ask one short clarifying question instead of assuming. " +
//         "When the user asks to generate or draft a reply email: if the context contains multiple distinct emails (different subjects or threads) that could match (e.g. same sender), do NOT generate a reply yet. Instead, list the options using a single sequential list: 1., 2., 3. — one number per option (one thread/email per option). Do not mix these option numbers with context labels (Email 1, Email 2, etc.); use only subject, from, and date in each line. Example: 1. [Subject] (From: …, Date: …). 2. [Subject] (From: …, Date: …). Include only context items that are emails (labelled 'Email 1:', 'Email 2:', … in the Context); do not include 'Document N (attachment: …)' in the reply-choice list. Then ask: \"Which email would you like to reply to?\" Only generate a single reply draft after the user specifies which one (by number, subject, or topic). Never assume or pick one when multiple match; never generate replies for more than one email unless the user explicitly asks for multiple drafts. If your previous message already asked \"Which email would you like to reply to?\" or already provided a reply draft, and the user's current message does not specify an email (e.g. \"hi\", \"hello\", or an unrelated question), do not list emails again; respond to their message (e.g. greet them and ask how you can help). " +
//         "When generating reply or follow-up email drafts, act as a strict professional email assistant. TONE: Warm and collaborative, like a team lead checking in — not formal or policy-like. Professional but warm; calm; clear; natural. Avoid transactional phrases like 'Thank you for your update. We can proceed with...' or directive 'please ensure'. Instead use: 'I wanted to follow up on our discussion regarding...' or 'I wanted to check in regarding...'. EMAIL STRUCTURE (follow exactly): **Subject:** [contextual subject]. Hi [receiver], I hope you're doing well. [Context: I wanted to follow up on our discussion regarding… OR I wanted to check in regarding…]. [Main message: Frame as confirmation request with reasoning. Use 'Please confirm that you're set to…' and add 'This will help us ensure a smooth transition...' or similar. Address topic directly; short clear sentences.] Let me know if you need any clarification, resources, or support before we begin. [Forward-looking close: Looking forward to your confirmation.] Best regards, [sender]. RULES: Always include 'I hope you're doing well' as first line after greeting. Prefer 'I wanted to follow up on our discussion regarding' over 'Thank you for your update'. Frame requests as confirmations with reasoning, not directives. Keep support line as: 'Let me know if you need any clarification, resources, or support before we begin.' CRITICAL: Output ONLY the email. No preamble, no 'Based on the context...', no 'Here is your draft'. Start directly with **Subject:**.";
//     if (userEmail && typeof userEmail === "string" && userEmail.trim()) {
//         prompt +=
//             ` The user's email is ${userEmail.trim()}. When generating a reply or follow-up: if the most recent email in the context for that thread was sent by the user (From contains this email, or direction is outbound / marked "sent by you"), generate a FOLLOW-UP email (e.g. "Just checking in...", "Wanted to follow up on...") rather than a REPLY. A reply responds to someone else's message; a follow-up is for when the user sent last.`;
//     }
//     return prompt;
// };

export async function* generateRagAnswer(
    question,
    matches = [],
    { userEmail } = {}
) {
    const context = buildContextFromMatches(matches);
    const systemPrompt = getBaseSystemPrompt(userEmail);
    const userPrompt = [
        `Question: ${question}`,
        "",
        "Context:",
        context || "No relevant email or document context found.",
    ].join("\n");

    const stream = createChatCompletion({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        maxTokens: CHAT_MAX_TOKENS,
    });

    for await (const chunk of stream) {
        yield chunk;
    }
}

const FORCE_RESPOND_INSTRUCTION =
    "\n\n[Instruction: The user's message above is a greeting or does not specify an email. Respond to their message directly (e.g. greet them back and ask how you can help). Do not list emails or ask which email to reply to.]";

function buildMessagesWithHistory(
    question,
    matches,
    { priorMessages = [], memory = {}, userEmail, forceRespondToMessage } = {}
) {
    const context = buildContextFromMatches(matches);
    let systemContent = getBaseSystemPrompt(userEmail);
    const memorySummary =
        memory && typeof memory.summary === "string" && memory.summary.trim()
            ? `\n\nConversation memory (use for context only): ${memory.summary.trim()}`
            : "";
    if (memorySummary) {
        systemContent += memorySummary;
    }

    const messages = [{ role: "system", content: systemContent }];

    for (const m of priorMessages) {
        const role = m.role === "system" ? "assistant" : "user";
        messages.push({ role, content: m.message || "" });
    }

    let userContent = [
        `Question: ${question}`,
        "",
        "Context:",
        context || "No relevant email or document context found.",
    ].join("\n");
    if (forceRespondToMessage) {
        userContent += FORCE_RESPOND_INSTRUCTION;
    }
    messages.push({ role: "user", content: userContent });

    return messages;
}

export async function* generateRagAnswerWithHistory(
    question,
    matches = [],
    { priorMessages = [], memory = {}, userEmail, forceRespondToMessage } = {}
) {
    const messages = buildMessagesWithHistory(question, matches, {
        priorMessages,
        memory,
        userEmail,
        forceRespondToMessage,
    });
    const stream = createChatCompletion({
        messages,
        temperature: 0.2,
        maxTokens: CHAT_MAX_TOKENS,
    });
    for await (const chunk of stream) {
        yield chunk;
    }
}
