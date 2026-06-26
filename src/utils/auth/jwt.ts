import jwt, { type SignOptions } from 'jsonwebtoken';

/*
 * This file contains utility functions for generating and verifying JSON Web Tokens (JWTs) used for authentication and authorization in the application. The functions are designed to create different types of JWTs for various purposes, includin
 * - Authentication JWTs for user sessions
 * - MFA JWTs for multi-factor authentication processes
 * - Magic JWTs for email verification and passwordless login
 * - Email Resend JWTs for allowing users to request new verification emails
 *
 * Each type of JWT has a specific structure and expiration time, and the utility functions ensure that the tokens are generated and verified correctly using a secret key defined in the environment variables.
 * Internally, the claims of each type of JWT are similar, except the `type` claim which is used to differentiate between the various purposes.
 */

type JWTGenerator = (userId: string, userEmail: string) => string;
type JWTVerifier = (token: string) => { email: string; id: string } | undefined;

/**
 * A higher-order function that creates a JWT generator for a type of token
 * @param type The type of the JWT (e.g., "jwt", "mfa", "magic", "email_resend") which is included in the token's payload to differentiate its purpose.
 * @param expiresIn (optional) The expiration time for the token, which can be a string (e.g., "7d", "1h") or a number of seconds. Defaults to '7d' for authentication tokens.
 * @returns A function that generates a JWT for a given user ID and email, with the specified type and expiration.
 */
function generateJWT(
  type: string,
  expiresIn: SignOptions['expiresIn'] = '7d',
): JWTGenerator {
  return (userId, userEmail) => {
    return jwt.sign(
      { email: userEmail, id: userId, type: type },
      process.env.JWT_SECRET!,
      { expiresIn: expiresIn, subject: userId },
    );
  };
}

/**
 * A higher-order function that creates a JWT verifier for a type of token
 * @param type The type of the JWT (e.g., "jwt", "mfa", "magic", "email_resend") which is included in the token's payload to differentiate its purpose.
 * @returns A function that verifies a JWT and returns the user's email and ID if the token is valid and of the correct type, or undefined otherwise.
 */
function verifyJWT(type: string): JWTVerifier {
  return (token) => {
    try {
      // TODO: fix type assertions
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        email: string;
        id: string;
        type: string;
      };
      if (payload.type !== type) {
        return undefined;
      }
      return { email: payload.email, id: payload.id };
    } catch {
      return undefined;
    }
  };
}

export const generateAuthJWT = generateJWT('jwt');
export const generateMFAJWT = generateJWT('mfa', '1h');
export const generateMagicJWT = generateJWT('magic', '1h');
export const generateEmailResendJWT = generateJWT('email_resend', '1d');

export const verifyAuthJWT = verifyJWT('jwt');
export const verifyMFAJWT = verifyJWT('mfa');
export const verifyMagicJWT = verifyJWT('magic');
export const verifyEmailResendJWT = verifyJWT('email_resend');
