import crypto from 'node:crypto';
export function generateAvatarId(email: string): string {
    return crypto.createHash('sha1').update(email.trim().toLowerCase()).digest('hex');
}