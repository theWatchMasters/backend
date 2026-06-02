import type { RequestHandler } from "express";
import { getPrismaClient } from "../utils/db/client.js";
import { validatePassword } from "../utils/auth/password.js";
import { generateJWT, generateMFAToken, verifyJWT } from "../utils/auth/jwt.js";
import { hashPassword } from "../utils/auth/password.js";
import { generateAvatarId } from "../utils/auth/avatar.js";

export const loginUser: RequestHandler = async (req, res) => {
    if (req.body === undefined) {
        return res.status(400).json({
            success: false,
            error: "error.invalid_credentials",
        });
    }
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: "error.invalid_credentials",
        });
    }
    const user = await getPrismaClient().user.findUnique({
        where: { email }
    });
    if (!user) {
        return res.status(400).json({
            success: false,
            error: "error.invalid_credentials",
        });
    }
    const isValidPassword = await validatePassword(password, user.password);
    if (!isValidPassword) {
        return res.status(400).json({
            success: false,
            error: "error.invalid_credentials",
        });
    }
    if (!user.mfa_token) {
        res.json({
            success: true,
            "2fa_enabled": false,
            user: {
                id: user.id,
                email: user.email,
                avatar_id: user.avatar_id,
                theme: user.theme
            }
        }).cookie("__session", generateJWT(user.id, user.email), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        });
        return;
    }
    res.json({
        success: true,
        "2fa_enabled": true,
        access_token: generateMFAToken(user.id, user.email)
    })
}

export const registerUser: RequestHandler = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: "error.missing_fields" });
    }

    try {
        const existingUser = await getPrismaClient().user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, error: "error.duplicate_credentials" });
        }

        const hashedPassword = await hashPassword(password);

        const newUser = await getPrismaClient().user.create({
            data: {
                email,
                password: hashedPassword,
                avatar_id: generateAvatarId(email),
                theme: "SYSTEM"
            }
        });

        return res.status(201).json({
            success: true,
            user: {
                id: newUser.id,
                email: newUser.email,
                avatar_id: newUser.avatar_id,
                theme: newUser.theme
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: "error.internal_server_error" });
    }
};

export const getCurrentUser: RequestHandler = async (req, res) => {
    try {
        const user = await getPrismaClient().user.findUnique({
            where: { id: res.locals.userId },
            select: {
                id: true,
                email: true,
                avatar_id: true,
                theme: true
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, error: "error.invalid_credentials" });
        }

        return res.json({
            success: true,
            user
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: "error.internal_server_error" });
    }
};