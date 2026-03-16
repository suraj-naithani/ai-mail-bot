import { Pinecone } from "@pinecone-database/pinecone";

let pineconeClient;

export const getPineconeIndex = () => {
    if (!process.env.PINECONE_API_KEY) {
        throw new Error("Missing PINECONE_API_KEY");
    }
    if (!process.env.PINECONE_INDEX) {
        throw new Error("Missing PINECONE_INDEX");
    }

    if (!pineconeClient) {
        pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    }

    return pineconeClient.Index(process.env.PINECONE_INDEX);
};
