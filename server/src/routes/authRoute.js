import { Router } from "express";
import passport from "passport";
import {
    googleAuth,
    googleCallback,
    dashboard,
    logout,
    sessionUser,
} from "../controller/authController.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = Router();

router.get("/google", googleAuth);

router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/login", session: false }),
    googleCallback
);

router.get("/dashboard", isAuthenticated, dashboard);

router.get("/logout", logout);

router.post("/session-user", sessionUser);

export default router;
