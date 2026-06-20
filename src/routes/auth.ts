import type { RequestHandler } from 'express';
import { getPrismaClient } from '../utils/db/client.js';
import { validatePassword } from '../utils/auth/password.js';
import {
  generateAuthJWT,
  generateEmailResendJWT,
  generateMFAJWT,
  verifyEmailResendJWT,
  verifyMagicJWT,
} from '../utils/auth/jwt.js';
import { hashPassword } from '../utils/auth/password.js';
import { generateAvatarId } from '../utils/auth/avatar.js';
import { sendMagicLink } from '../utils/email/utils.js';

const EMAIL_RESEND_COOLDOWN = 50 * 1000; // 50 seconds (1 minute - 10 seconds buffer)

/**
 * Handle the login of a user. The function
 * 1. Validates the email and password provided in the request body.
 * 2. If the credentials are invalid, it returns a 400 status with an error message.
 * 3. If the user does not have MFA enabled, it returns a response with the user details and an access token for authentication.
 * 4. If the user has MFA enabled, it returns a response indicating that MFA is required along with a temporary MFA token.
 */
export const loginUser: RequestHandler = async (req, res) => {
  // Validate that the email and password are provided in the request body
  if (req.body === undefined) {
    return res.status(400).json({
      success: false,
      error: 'error.invalid_credentials',
    });
  }

  // Extract email and password from the request body
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'error.invalid_credentials',
    });
  }

  // Find the user and check that the email is verified
  const user = await getPrismaClient().user.findUnique({
    where: { email, verified: true },
  });
  if (!user) {
    return res.status(400).json({
      success: false,
      error: 'error.invalid_credentials',
    });
  }
  // Validate the password
  const isValidPassword = await validatePassword(password, user.password);
  if (!isValidPassword) {
    return res.status(400).json({
      success: false,
      error: 'error.invalid_credentials',
    });
  }

  // If the user does not have MFA enabled, return a response with the user details and an access token for authentication
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
  // If the user has MFA enabled, return a response indicating that MFA is required along with a temporary MFA token
  res.json({
    success: true,
    '2fa_enabled': true,
    access_token: generateMFAJWT(user.id, user.email),
  });
};

/**
 * Handle the registration of a new user. The function
 * 1. Validates the email and password provided in the request body.
 * 2. If the credentials are invalid (missing, malformed or already registered), it returns a 400 status with an error message.
 * 3. If the registration is successful, it
 *     * creates a new user in the database
 *     * sends a magic link to the user's email for verification
 *     * and returns a response with an access token for requesting email re-sends.
 */
export const registerUser: RequestHandler = async (req, res) => {
  // Validate that the email and password are provided in the request body
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, error: 'error.missing_fields' });
  }

  try {
    // Check if a user with the same email already exists
    const existingUser = await getPrismaClient().user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: 'error.duplicate_credentials' });
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const newUser = await getPrismaClient().user.create({
      data: {
        email,
        password: hashedPassword,
        avatar_id: generateAvatarId(email),
        theme: 'SYSTEM',
      },
    });
    // Send magic link
    sendMagicLink(newUser.id, newUser.email, 'register');

    // Return access token for requesting email re-sends
    return res.status(200).json({
      success: true,
      access_token: generateEmailResendJWT(newUser.id, newUser.email),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: 'error.internal_server_error' });
  }
};

/**
 * Handle the email verification of a user. This handler would typically be called when a user
 * opens a magic link sent to their email. The function
 * 1. Validates the magic JWT provided in the request body.
 * 2. If the token is invalid or expired, it returns a 400 status with an error message.
 * 3. If the token is valid, it
 *     * marks the user as verified in the database
 *     * returns a response with the user details and an access token for authentication.
 */
export const emailVerifyUser: RequestHandler = async (req, res) => {
  // Validate that the magic JWT is provided in the request body
  const { access_token } = req.body;
  if (!access_token) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_fields' });
  }

  // Verify the magic JWT
  const jwt = verifyMagicJWT(access_token);
  if (!jwt) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_credentials' });
  }

  // Update the user to be verified
  let newUser;
  try {
    newUser = await getPrismaClient().user.update({
      where: { id: jwt.id, verified: false },
      data: { verified: true },
    });
  } catch {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_credentials' });
  }
  return res.status(200).json({
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      avatar_id: newUser.avatar_id,
      theme: newUser.theme,
    },
    access_token: generateAuthJWT(jwt.id, jwt.email),
  });
};

/**
 * Handle the resending of the email verification magic link. The function
 * 1. Validates the email resend access token provided in the request body.
 * 2. If the token is invalid, it returns a 400 status with an error message.
 * 3. If the user has re-sent a verification email within a cooldown period, it rate limits the request.
 * 4. It
 *     * updates the `last_verified` timestamp for the user in the database
 *     * sends a new magic link to the user's email
 */
export const emailResendUser: RequestHandler = async (req, res) => {
  // Validate that the email resend access token is provided in the request body
  const { access_token } = req.body;
  if (!access_token) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_fields' });
  }

  // Verify the email resend access token
  const jwt = verifyEmailResendJWT(access_token);
  if (!jwt) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_credentials' });
  }

  // Check if the user is already verified
  const user = await getPrismaClient().user.findUnique({
    where: { id: jwt.id, verified: false },
    select: { last_verified: true },
  });
  if (!user) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_credentials' });
  }

  // Rate limit the email resend requests
  if (Date.now() - user.last_verified.getTime() < EMAIL_RESEND_COOLDOWN) {
    return res
      .status(429)
      .json({ success: false, error: 'error.too_many_requests' });
  }

  // Update the `last_verified` timestamp
  await getPrismaClient().user.update({
    where: { id: jwt.id },
    data: { last_verified: new Date() },
  });

  // Send a new magic link to the user's email
  // TODO: Don't assume the path is "register".
  sendMagicLink(jwt.id, jwt.email, 'register');
  return res.status(200).json({
    success: true,
  });
};

/**
 * Retrieves the current authenticated user's details. The function
 * 1. Uses the user ID set in `res.locals` by the authentication middleware to find the user in the database.
 * 2. If the user is not found, it returns a 404 status with an error message.
 * 3. If the user is found, it returns a response with the user details.
 */
export const getCurrentUser: RequestHandler = async (req, res) => {
  try {
    // Find the user
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
