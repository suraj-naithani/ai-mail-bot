import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import {
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    TEXT_MIMES,
} from "../config/contant.js";

export async function parseDocument(buffer, mimeType, filename = "") {
    if (!buffer?.length) {
        return { text: "" };
    }

    const mime = (mimeType || "").toLowerCase();

    if (mime === "application/pdf") {
        const parser = new PDFParse({ data: buffer });
        try {
            const result = await parser.getText();
            await parser.destroy();
            return { text: (result?.text || "").trim() };
        } catch (err) {
            await parser.destroy().catch(() => { });
            throw new Error(`PDF parse failed${filename ? ` (${filename})` : ""}: ${err.message}`);
        }
    }

    if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mime === "application/msword"
    ) {
        const result = await mammoth.extractRawText({ buffer });
        const text = (result?.value || "").trim();
        if (result?.messages?.length) {
            console.warn("[documentProcessor] mammoth messages:", result.messages);
        }
        return { text };
    }

    if (TEXT_MIMES.has(mime)) {
        const text = buffer.toString("utf8").trim();
        return { text };
    }

    throw new Error(`Unsupported MIME type for RAG: ${mimeType}`);
}

export function chunkText(text, options = {}) {
    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlap = options.overlap ?? DEFAULT_CHUNK_OVERLAP;

    if (!text || chunkSize <= 0) {
        return [];
    }

    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return [];

    if (normalized.length <= chunkSize) {
        return [{ text: normalized, index: 0 }];
    }

    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < normalized.length) {
        let end = start + chunkSize;
        let slice = normalized.slice(start, end);

        if (end < normalized.length) {
            const lastSpace = slice.lastIndexOf(" ");
            if (lastSpace > chunkSize / 2) {
                slice = slice.slice(0, lastSpace + 1);
                end = start + lastSpace + 1;
            }
        }

        if (slice.trim()) {
            chunks.push({ text: slice.trim(), index });
            index += 1;
        }

        start = end - (overlap > 0 ? Math.min(overlap, slice.length) : 0);
        if (start >= normalized.length) break;
    }

    return chunks;
}

export async function parseAndChunkDocument(buffer, mimeType, filename, chunkOptions = {}) {
    const { text } = await parseDocument(buffer, mimeType, filename);
    return chunkText(text, chunkOptions);
}
