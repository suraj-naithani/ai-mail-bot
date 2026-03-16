import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import { encrypt } from "../utils/encrypt.js";

passport.use(
    "gmail-connect",
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL:
                process.env.GMAIL_CALLBACK_URL || "/auth/gmail/callback",
            accessType: "offline",
            prompt: "consent",
            passReqToCallback: true, 
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const stateToken = req.query?.state;
                let adminUserId = null;
                if (stateToken) {
                    try {
                        const payload = jwt.verify(
                            stateToken,
                            process.env.JWT_SECRET
                        );
                        adminUserId = payload?.sub || null;
                    } catch (error) {
                        return done(new Error("Invalid auth state"), null);
                    }
                }

                const googleEmail = profile.emails?.[0]?.value;

                if (!adminUserId) {
                    return done(new Error("No authenticated user found"), null);
                }

                if (!googleEmail) {
                    return done(new Error("No email returned from Google"), null);
                }

                let connection;

                if (refreshToken) {
                    const encryptedToken = encrypt(refreshToken);
                    await prisma.gmailConnection.upsert({
                        where: {
                            adminUserId_googleAccountEmail: {
                                adminUserId,
                                googleAccountEmail: googleEmail,
                            },
                        },
                        create: {
                            adminUserId,
                            googleAccountEmail: googleEmail,
                            refreshToken: encryptedToken,
                            scope: "gmail.readonly",
                            syncStatus: "connected",
                        },
                        update: {
                            refreshToken: encryptedToken,
                            scope: "gmail.readonly",
                            syncStatus: "connected",
                        },
                    });
                } else {
                    const connection = await prisma.gmailConnection.findFirst({
                        where: {
                            adminUserId,
                            googleAccountEmail: googleEmail,
                        },
                    });

                    if (!connection) {
                        return done(
                            new Error(
                                "No refresh token received. Revoke access and reconnect."
                            ),
                            null
                        );
                    }
                }

                return done(null, req.user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);
