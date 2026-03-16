import jwt from "jsonwebtoken";
import prisma from "../config/db.js";

const getTokenFromRequest = (req) => {
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
        return authHeader.slice("Bearer ".length);
    }
    return req.cookies?.auth_token || req.headers["x-auth-token"] || null;
};

const isAuthenticated = async (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) {
        const acceptHeader = req.headers.accept || "";
        const wantsHtml = acceptHeader.includes("text/html");

        if (wantsHtml) {
            return res.redirect(`${process.env.CLIENT_URL}/login`);
        }

        return res.status(401).json({ message: "Login required" });
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ message: "Login required" });
    }

    const user = await prisma.user.findUnique({
        where: { id: payload?.sub },
    });
    if (!user) {
        return res.status(401).json({ message: "Login required" });
    }

    req.user = user;
    next();
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admins only" });
    }
    next();
};

export { isAuthenticated, isAdmin };