export const DEFAULT_CHUNK_SIZE = 800;
export const DEFAULT_CHUNK_OVERLAP = 150;

/** Max chars per email body chunk for embeddings. ~1.5 chars/token in dense text -> 12000 chars ~8000 tokens. */
export const EMAIL_EMBEDDING_MAX_CHARS = 8000;

export const TEXT_MIMES = new Set(["text/plain", "text/csv", "text/html"]);

export const RAG_ATTACHMENT_MIMES = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/csv",
    "text/html",
]);

export const ENCRYPTION_ALGORITHM = "aes-256-cbc";
export const ENCRYPTION_KEY = Buffer.from(
    process.env.ENCRYPTION_KEY,
    "hex"
);
