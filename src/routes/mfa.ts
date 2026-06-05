import type { RequestHandler } from "express";
import { getPrismaClient } from "../utils/db/client.js";
import { generateMFASecret, generateMFAQRCode, verifyMFAToken } from "../utils/auth/mfa.js";
import jwt from 'jsonwebtoken';
import { generateJWT } from "../utils/auth/jwt.js";

export const setupMFA: RequestHandler = async (req, res) => {
  const user = await getPrismaClient().user.findUnique({ where: { id: res.locals.userId } });
  if (!user) {
    return res.status(404).json({ success: false, error: "error.user_not_found" });
  }

  const { secret, otpauthUrl } = generateMFASecret(user.email);
  const qrCodeUrl = await generateMFAQRCode(otpauthUrl);


  await getPrismaClient().user.update({
    where: { id: user.id },
    data: { mfa_token: secret }
  });

  return res.json({
    success: true,
    qrCode: qrCodeUrl,
    secret: secret
  });
};

export const verifyMFALogin: RequestHandler = async (req, res) => {
  const { access_token, code } = req.body;

  if (!access_token || !code) {
    return res.status(400).json({ success: false, error: "error.missing_fields" });
  }

  try {
    const decoded = jwt.verify(access_token, process.env.JWT_SECRET || 'fallback_secret') as { id: string, email: string };

    const user = await getPrismaClient().user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.mfa_token) {
      return res.status(400).json({ success: false, error: "error.invalid_session" });
    }

    const isValid = verifyMFAToken(code, user.mfa_token);

    if (!isValid) {
      return res.status(401).json({ success: false, error: "error.invalid_mfa_code" });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        avatar_id: user.avatar_id,
        theme: user.theme
      },
      access_token: generateJWT(user.id, user.email)
    });

  } catch (error) {
    return res.status(401).json({ success: false, error: "error.invalid_or_expired_token" });
  }
};
