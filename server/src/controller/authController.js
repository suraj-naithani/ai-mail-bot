import passport from "passport";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

const getTokenFromRequest = (req) => {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
        return authHeader.slice("Bearer ".length);
    }
    return (
        req.cookies?.auth_token ||
        req.headers["x-auth-token"] ||
        req.body?.token ||
        null
    );
};

const buildAuthCookieOptions = () => {
    const isProd = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
};

const signAuthToken = (user) =>
    jwt.sign(
        { sub: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

export const googleAuth = passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
});

export const googleCallback = (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Login required" });
    }
    const token = signAuthToken(req.user);
    res.cookie("auth_token", token, buildAuthCookieOptions());
    res.redirect(process.env.CLIENT_URL);
};

export const dashboard = (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    res.json({
        message: "Logged in successfully 🎉",
        user: req.user,
    });
};

export const logout = (req, res) => {
    res.clearCookie("auth_token", buildAuthCookieOptions());
    res.redirect(process.env.CLIENT_URL);
};

export const sessionUser = async (req, res) => {
    const token = getTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ message: "Login required" });
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ message: "Login required" });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: payload?.sub },
        });
        if (!user) {
            return res.status(401).json({ message: "Login required" });
        }

        return res.json({ user });
    } catch (error) {
        return res.status(500).json({ message: "Failed to load user" });
    }
};
