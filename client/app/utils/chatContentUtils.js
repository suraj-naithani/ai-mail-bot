// Regex patterns for chat content detection
const LIST_INTRO =
  /here are|found in|in the context|list of|addresses|the following|which (email|one) (would you like|do you want|to reply to|to (view|open|see))|please specify/i;
const WHICH_EMAIL_BLOCK = /which (email|one) (would you like|do you want)/i;
const NUMBERED_ITEMS = /\d+[\)\.]\s/;

export const isEmailDraft = (content) => {
  if (!content || typeof content !== "string") return false;
  const c = content.trim();
  const hasSubject = /\*\*Subject:\*\*|Subject:\s*/i.test(c);
  const hasGreeting = /\b(Hi|Dear|Hello)\s+/i.test(c);
  const hasSignOff =
    /\b(Best regards|Regards|Cheers|Sincerely|Thanks)\b/i.test(c);
  return hasSubject && hasGreeting && hasSignOff;
};

export const isListContent = (content) => {
  if (!content || typeof content !== "string") return false;
  const c = content.trim();
  if (!LIST_INTRO.test(c)) return false;
  const blocks = c.split(/\n\n+/);
  return blocks.some((block) => {
    if (WHICH_EMAIL_BLOCK.test(block)) return false;
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) return false;
    const listLike = lines.filter(
      (l) => l.includes("@") || l.includes("(") || l.length > 15
    );
    return listLike.length >= 2;
  });
};

export const formatListContent = (content) => {
  if (!content || typeof content !== "string") return content;
  const c = content.trim();
  const isChoiceList =
    NUMBERED_ITEMS.test(c) ||
    WHICH_EMAIL_BLOCK.test(c) ||
    /please specify by (number|subject)/i.test(c);
  if (NUMBERED_ITEMS.test(c)) {
    return c
      .replace(/\s+(\d+)\)/g, "\n$1.")
      .replace(/^(\d+)\)/gm, "$1.");
  }
  const blocks = c.split(/\n\n+/);
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (WHICH_EMAIL_BLOCK.test(block)) break;
    if (block.includes("\n")) {
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (
        lines.length >= 2 &&
        lines.some((l) => l.includes("@") || l.includes("(") || l.length > 15)
      ) {
        const prefix = isChoiceList ? (idx) => `${idx + 1}. ` : () => "- ";
        blocks[i] = lines.map((l, idx) => prefix(idx) + l).join("\n");
        break;
      }
    }
  }
  return blocks.join("\n\n");
};

export const isCompleteConversation = (content) => {
  if (!content || typeof content !== "string") return false;
  return /Email \d+:/i.test(content);
};

export const stripEmailNumbering = (content) => {
  return content.replace(/Email \d+:\s*/gi, "");
};

export const markdownToPlainText = (content) => {
  if (!content || typeof content !== "string") return "";
  return content
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#+\s*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
};
