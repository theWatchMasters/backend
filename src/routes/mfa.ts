import type { RequestHandler } from 'express';
import { getPrismaClient } from '../utils/db/client.js';
import {
  generateMFASecret,
  generateMFAQRCode,
  verifyMFAToken,
} from '../utils/auth/mfa.js';
import { generateAuthJWT, verifyMFAJWT } from '../utils/auth/jwt.js';

/**
 * Handles the MFA setup process for a user. The function
 * 1. Checks if the user already has MFA. If they do, it returns a 400 status with an error message.
 * 2. If not, it generates a new MFA secret, QR code and authenticator URI for the user.
 * 3. It updates the user's record in the database with the new MFA token.
 * 4. It returns a response with the QR code and other MFA setup details.
 *
 * This function is idempotent, i.e., the user can initiate MFA setup multiple times without causing issues.
 */
export const setupMFA: RequestHandler = async (req, res) => {
  // Find the user
  const user = await getPrismaClient().user.findUnique({
    where: { id: res.locals.userId },
  });

  // If the user is not found, return a 404 error
  if (!user) {
    return res
      .status(404)
      .json({ success: false, error: 'error.user_not_found' });
  }

  // If the user already has MFA enabled, return a 400 error
  if (user.mfa_enabled) {
    return res
      .status(400)
      .json({ success: false, error: 'error.2fa_already_enabled' });
  }

  // Generate the MFA details
  const { secret, otpauthUrl } = generateMFASecret(user.email);
  const qrCodeUrl = await generateMFAQRCode(otpauthUrl);

  // Update the user's MFA token in the database
  await getPrismaClient().user.update({
    where: { id: user.id },
    data: { mfa_token: secret },
  });

  // Return the MFA setup details to the client
  return res.json({
    success: true,
    qrCode: qrCodeUrl,
    url: otpauthUrl,
    secret: secret,
  });
};

/**
 * Handles the verification of the MFA setup for a user. The function
 * 1. Validates the MFA code provided in the request body.
 * 2. It checks if the user has initiated MFA setup and if they have MFA enabled. If not, it returns appropriate error messages.
 * 3. If the code is invalid, it returns a 400 status with an error message.
 * 4. It updates the user's record in the database to enable MFA.
 */
export const verifyMFASetup: RequestHandler = async (req, res) => {
  // Verify the MFA code exists in the request body
  const { code } = req.body;
  if (!code) {
    return res
      .status(400)
      .json({ success: false, error: 'error.missing_fields' });
  }

  // Find the user
  const user = await getPrismaClient().user.findUnique({
    where: { id: res.locals.userId },
  });
  if (!user) {
    return res
      .status(404)
      .json({ success: false, error: 'error.user_not_found' });
  }

  // Check if the user already has MFA enabled or if they have not initiated MFA setup
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

  // Verify the MFA code
  const isValid = await verifyMFAToken(code, user.mfa_token);
  if (!isValid) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_mfa_code' });
  }

  // Enable MFA for the user in the database
  await getPrismaClient().user.update({
    where: { id: user.id },
    data: { mfa_enabled: true },
  });

  return res.json({
    success: true,
  });
};

/**
 * Handles the verification of the MFA token during login. The function
 * 1. Validates the MFA token and code provided in the request body.
 * 2. It checks if the user has MFA enabled. If not, it returns a 400 status with an error message.
 * 3. If the code is invalid, it returns a 400 status with an error message.
 * 4. If the code is valid, it returns a response with the user details and an access token for authentication.
 */
export const verifyMFALogin: RequestHandler = async (req, res) => {
  // Verify the MFA token and code exist in the request body
  const { token: access_token, code } = req.body;
  if (!access_token || !code) {
    return res
      .status(400)
      .json({ success: false, error: 'error.missing_fields' });
  }

  try {
    // Verify the MFA JWT and extract the user ID
    const decoded = verifyMFAJWT(access_token);
    if (decoded === undefined) {
      return res
        .status(400)
        .json({ success: false, error: 'error.invalid_or_expired_token' });
    }

    // Find the user and check if they have MFA enabled
    const user = await getPrismaClient().user.findUnique({
      where: { id: decoded.id },
    });
    if (!user || !user.mfa_enabled || !user.mfa_token) {
      return res
        .status(400)
        .json({ success: false, error: 'error.invalid_session' });
    }

    // Verify the MFA code
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
