import crypto from 'node:crypto';
/**
 * Generate a Gravatar ID for a given email address.
 * @param email The email to generate the Gravatar ID for.
 * @returns The generated Gravatar ID as a hexadecimal string.
 */
export function generateAvatarId(email: string): string {
  return crypto
    .createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex');
}
