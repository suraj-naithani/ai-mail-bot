import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    schema: path.join(__dirname, "prisma", "schema.prisma"),
    migrations: {
        path: path.join(__dirname, "prisma", "migrations"),
    },
    datasource: {
        url: env("DATABASE_URL"),
    },
});
