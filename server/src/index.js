import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });
import "./auth/google.js";
import "./auth/gmail.js";

import express from "express";
import passport from "passport";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/db.js";

import authRoutes from "./routes/authRoute.js";
import gmailRoute from "./routes/gmailRoute.js";
import conversationRoutes from "./routes/conversationRoute.js";
import { startImapService } from "./services/imapService.js";

const app = express();
const isProd = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use(
    cors({
        origin: process.env.CLIENT_URL,
        credentials: true,
    })
);

connectDB();

if (isProd) {
    app.set("trust proxy", 1);
}

app.use(passport.initialize());

/* ---------- ROUTES ---------- */
app.use("/auth", authRoutes);

app.use("/auth/gmail", gmailRoute);

app.use("/conversations", conversationRoutes);

app.listen(process.env.PORT, () => {
    console.log(`🚀 Server running on ${process.env.PORT}`);
    
    // Start IMAP service for auto-syncing new emails
    startImapService();
});
