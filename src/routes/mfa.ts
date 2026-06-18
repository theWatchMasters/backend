import type { RequestHandler } from 'express';
import { getPrismaClient } from '../utils/db/client.js';
import {
  generateMFASecret,
  generateMFAQRCode,
  verifyMFAToken,
} from '../utils/auth/mfa.js';
import { generateAuthJWT, verifyMFAJWT } from '../utils/auth/jwt.js';

export const setupMFA: RequestHandler = async (req, res) => {
  const user = await getPrismaClient().user.findUnique({
    where: { id: res.locals.userId },
  });
  if (!user) {
    return res
      .status(404)
      .json({ success: false, error: 'error.user_not_found' });
  }

  if (user.mfa_enabled) {
    return res
      .status(400)
      .json({ success: false, error: 'error.2fa_already_enabled' });
  }

  const { secret, otpauthUrl } = generateMFASecret(user.email);
  const qrCodeUrl = await generateMFAQRCode(otpauthUrl);

  await getPrismaClient().user.update({
    where: { id: user.id },
    data: { mfa_token: secret },
  });

  return res.json({
    success: true,
    qrCode: qrCodeUrl,
    url: otpauthUrl,
    secret: secret,
  });
};

export const verifyMFASetup: RequestHandler = async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res
      .status(400)
      .json({ success: false, error: 'error.missing_fields' });
  }

  const user = await getPrismaClient().user.findUnique({
    where: { id: res.locals.userId },
  });

  if (!user) {
    return res
      .status(404)
      .json({ success: false, error: 'error.user_not_found' });
  }

  if (user.mfa_enabled) {
    return res
      .status(400)
      .json({ success: false, error: 'error.2fa_already_enabled' });
  }

  if (!user.mfa_token) {
    return res
      .status(400)
      .json({ success: false, error: 'error.2fa_not_initiated' });
  }

  const isValid = await verifyMFAToken(code, user.mfa_token);
  if (!isValid) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_mfa_code' });
  }

  await getPrismaClient().user.update({
    where: { id: user.id },
    data: { mfa_enabled: true },
  });

  return res.json({
    success: true,
  });
};

export const verifyMFALogin: RequestHandler = async (req, res) => {
  const { token: access_token, code } = req.body;

  if (!access_token || !code) {
    return res
      .status(400)
      .json({ success: false, error: 'error.missing_fields' });
  }

  try {
    const decoded = verifyMFAJWT(access_token);
    if (decoded === undefined) {
      return res
        .status(400)
        .json({ success: false, error: 'error.invalid_or_expired_token' });
    }

    const user = await getPrismaClient().user.findUnique({
      where: { id: decoded.id },
    });
    if (!user || !user.mfa_enabled || !user.mfa_token) {
      return res
        .status(400)
        .json({ success: false, error: 'error.invalid_session' });
    }

    const isValid = await verifyMFAToken(code, user.mfa_token);
    if (!isValid) {
      return res
        .status(400)
        .json({ success: false, error: 'error.invalid_mfa_code' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        avatar_id: user.avatar_id,
        theme: user.theme,
      },
      access_token: generateAuthJWT(user.id, user.email),
    });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_or_expired_token' });
  }
};
