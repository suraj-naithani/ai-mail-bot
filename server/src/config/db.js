import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

export const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log("✅ PostgreSQL connected");
    } catch (error) {
        console.error("❌ PostgreSQL connection failed:", error.message);
        process.exit(1);
    }
};

export default prisma;
