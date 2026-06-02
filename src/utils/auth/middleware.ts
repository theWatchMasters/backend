import type { RequestHandler } from "express";
import { verifyJWT } from "./jwt.js";

export const authMiddleware: ((arg0: RequestHandler) => RequestHandler) = handler => async (req, res, next) => {
    const jwt = verifyJWT(req.cookies?.__session || '');
    if (!jwt) {
        return res.status(401).json({ success: false, error: "error.unauthorized" });
    }
    res.locals.userId = jwt.id;
    res.locals.email = jwt.email;
    return await handler(req, res, next);
}