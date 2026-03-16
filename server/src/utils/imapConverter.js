/**
 * Converts mailparser parsed email to the same format as extractEmailFields
 * This allows IMAP-fetched emails to use the same processing pipeline
 */

export const convertMailparserToEmailFields = (parsed) => {
    // Extract message ID from headers or parsed object
    const messageId = 
        parsed.messageId || 
        parsed.headers?.get('message-id')?.[0] || 
        parsed.headers?.get('message-id') || 
        '';

    // Extract subject
    const subject = parsed.subject || '';

    // Extract from (can be object or string)
    let from = '';
    if (parsed.from) {
        if (typeof parsed.from === 'string') {
            from = parsed.from;
        } else if (parsed.from.text) {
            from = parsed.from.text;
        } else if (parsed.from.value && parsed.from.value[0]) {
            const addr = parsed.from.value[0];
            from = addr.name 
                ? `${addr.name} <${addr.address}>` 
                : addr.address;
        }
    }

    // Extract date
    const date = parsed.date 
        ? (parsed.date instanceof Date ? parsed.date.toISOString() : parsed.date)
        : new Date().toISOString();

    // Extract body (prefer text, fallback to HTML stripped)
    let body = '';
    if (parsed.text) {
        body = parsed.text;
    } else if (parsed.html) {
        // Basic HTML stripping (cleanBody will do more thorough cleaning)
        body = parsed.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Extract in-reply-to
    const inReplyTo = 
        parsed.inReplyTo || 
        parsed.headers?.get('in-reply-to')?.[0] || 
        parsed.headers?.get('in-reply-to') || 
        '';

    return {
        subject,
        from,
        date,
        body,
        messageId: messageId || `imap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        inReplyTo,
    };
};
