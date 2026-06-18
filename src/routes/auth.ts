import type { RequestHandler } from 'express';
import { getPrismaClient } from '../utils/db/client.js';
import { validatePassword } from '../utils/auth/password.js';
import { generateAuthJWT, generateMFAJWT, verifyMagicJWT } from '../utils/auth/jwt.js';
import { hashPassword } from '../utils/auth/password.js';
import { generateAvatarId } from '../utils/auth/avatar.js';
import { sendMagicLink } from '../utils/email/utils.js';

export const loginUser: RequestHandler = async (req, res) => {
  if (req.body === undefined) {
    return res.status(400).json({
      success: false,
      error: 'error.invalid_credentials',
    });
  }
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'error.invalid_credentials',
    });
  }
  const user = await getPrismaClient().user.findUnique({
    where: { email, verified: true },
  });
  if (!user) {
    return res.status(400).json({
      success: false,
      error: 'error.invalid_credentials',
    });
  }
  const isValidPassword = await validatePassword(password, user.password);
  if (!isValidPassword) {
    return res.status(400).json({
      success: false,
      error: 'error.invalid_credentials',
    });
  }
  if (!user.mfa_enabled) {
    res.json({
      success: true,
      '2fa_enabled': false,
      user: {
        id: user.id,
        email: user.email,
        avatar_id: user.avatar_id,
        theme: user.theme,
      },
      access_token: generateAuthJWT(user.id, user.email),
    });
    return;
  }
  res.json({
    success: true,
    '2fa_enabled': true,
    access_token: generateMFAJWT(user.id, user.email),
  });
};

export const registerUser: RequestHandler = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, error: 'error.missing_fields' });
  }

  try {
    const existingUser = await getPrismaClient().user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: 'error.duplicate_credentials' });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = await getPrismaClient().user.create({
      data: {
        email,
        password: hashedPassword,
        avatar_id: generateAvatarId(email),
        theme: 'SYSTEM',
      },
    });
    sendMagicLink(newUser.id, newUser.email);
    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: 'error.internal_server_error' });
  }
};

export const emailVerifyUser: RequestHandler = async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) {
    return res.status(400).json({ success: false, error: 'error.invalid_fields' })
  }
  const jwt = verifyMagicJWT(access_token);
  if (!jwt) {
    return res.status(400).json({ success: false, error: 'error.invalid_credentials' });
  }
  const newUser = await getPrismaClient().user.update({
    where: { id: jwt.id },
    data: { verified: true }
  })
  return res.status(200).json({
    success: true, user: {
      id: newUser.id,
      email: newUser.email,
      avatar_id: newUser.avatar_id,
      theme: newUser.theme,
    }, access_token: generateAuthJWT(jwt.id, jwt.email)
  });
}

export const getCurrentUser: RequestHandler = async (req, res) => {
  try {
    const user = await getPrismaClient().user.findUnique({
      where: { id: res.locals.userId },
      select: {
        id: true,
        email: true,
        avatar_id: true,
        theme: true,
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'error.invalid_credentials' });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: 'error.internal_server_error' });
  }
};
