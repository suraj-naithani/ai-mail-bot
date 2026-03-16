import OpenAI from "openai";

let openaiClient;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) => {
    const status = error?.status || error?.statusCode;
    return status === 429 || (status >= 500 && status <= 599);
};

const getOpenAIClient = () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("Missing OPENAI_API_KEY");
    }

    if (!openaiClient) {
        openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    return openaiClient;
};

export const createEmbeddings = async (inputs) => {
    if (!Array.isArray(inputs) || inputs.length === 0) {
        return [];
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
    const dimensions = process.env.OPENAI_EMBEDDING_DIM
        ? parseInt(process.env.OPENAI_EMBEDDING_DIM, 10)
        : undefined;
    const batchSize =
        parseInt(process.env.OPENAI_EMBEDDING_BATCH_SIZE, 10) || 96;
    const maxRetries =
        parseInt(process.env.OPENAI_EMBEDDING_MAX_RETRIES, 10) || 3;
    const baseDelayMs =
        parseInt(process.env.OPENAI_EMBEDDING_RETRY_DELAY_MS, 10) || 500;

    const embeddings = [];
    for (let i = 0; i < inputs.length; i += batchSize) {
        const batch = inputs.slice(i, i + batchSize);
        let attempt = 0;
        while (true) {
            try {
                const response = await client.embeddings.create({
                    model,
                    input: batch,
                    ...(dimensions ? { dimensions } : {}),
                });
                embeddings.push(
                    ...response.data.map((item) => item.embedding)
                );
                break;
            } catch (error) {
                if (!isRetryableError(error) || attempt >= maxRetries) {
                    throw error;
                }
                const delayMs =
                    baseDelayMs * Math.pow(2, attempt) +
                    Math.floor(Math.random() * 100);
                attempt += 1;
                await sleep(delayMs);
            }
        }
    }

    return embeddings;
};

export async function* createChatCompletion({
    messages,
    temperature = 0.2,
    maxTokens = 500,
    model,
} = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("Missing chat messages");
    }

    const client = getOpenAIClient();
    const resolvedModel = model || process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

    const stream = await client.chat.completions.create({
        model: resolvedModel,
        messages,
        temperature,
        // max_tokens: maxTokens,
        stream: true,
    });

    for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (typeof content === "string" && content.length > 0) {
            yield content;
        }
    }
}

export async function createChatCompletionOnce({
    messages,
    temperature = 0.2,
    maxTokens = 300,
    model,
} = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("Missing chat messages");
    }
    const client = getOpenAIClient();
    const resolvedModel = model || process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
    const response = await client.chat.completions.create({
        model: resolvedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
    });
    return response.choices?.[0]?.message?.content ?? "";
}
