import { Router } from "express";
import passport from "passport";
import { isAuthenticated } from "../middleware/auth.js";
import {
    getMessages,
    handleGmailCallback,
    streamAiResponse,
    syncMessages,
} from "../controller/gmailController.js";

const router = Router();

router.get(
    "/connect",
    isAuthenticated,
    (req, res, next) => {
        const authToken =
            req.cookies?.auth_token ||
            req.headers["x-auth-token"] ||
            req.query?.token ||
            "";
        return passport.authenticate("gmail-connect", {
            accessType: "offline",
            prompt: "consent",
            includeGrantedScopes: true,
            scope: [
                "https://www.googleapis.com/auth/gmail.readonly",
                "profile",
                "email",
            ],
            state: authToken,
        })(req, res, next);
    }
);

router.get(
    "/callback",
    passport.authenticate("gmail-connect", {
        failureRedirect: `${process.env.CLIENT_URL}/gmail-sync?status=error`,
    }),
    handleGmailCallback
);

//for demo only to fetch the data from mail
router.get("/messages", isAuthenticated, getMessages);

router.post("/sync", isAuthenticated, syncMessages);
router.post("/ai-response", isAuthenticated, streamAiResponse);

export default router;
