import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

/**
 * Generates a secret and an otpauth URL for setting up MFA for a user.
 * The otpauth URL can be used to generate a QR code that the user can scan with an authenticator app (e.g., Google Authenticator) to set up MFA.
 * The secret is stored in the database and used to verify the MFA TOTP codes provided by the user during login.
 * @param email The email of the user for whom MFA is being set up, which is included in the otpauth URL as the issuer.
 * @returns An object containing the generated secret and the otpauth URL for MFA setup.
 */
export function generateMFASecret(email: string) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: email,
    label: 'WatchMasters',
    secret,
  });

  return { secret, otpauthUrl };
}

/**
 * Generates a QR code for the MFA setup URL.
 * @param otpauthUrl The otpauth URL for MFA setup.
 * @returns A promise resolving to the QR code as a data URL.
 */
export async function generateMFAQRCode(otpauthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch {
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verifies an MFA TOTP code against the user's MFA secret.
 * @param code The MFA TOTP code provided by the user.
 * @param secret The MFA secret stored in the database for the user.
 * @returns A promise resolving to a boolean indicating whether the provided MFA code is valid.
 */
export async function verifyMFAToken(
  code: string,
  secret: string,
): Promise<boolean> {
  return (await verify({ token: code, secret })).valid;
}
