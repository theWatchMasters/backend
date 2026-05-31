import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export function generateMFASecret(email: string) {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, 'WatchMasters', secret);
  
  return { secret, otpauthUrl };
}

export async function generateMFAQRCode(otpauthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
}

export function verifyMFAToken(code: string, secret: string): boolean {
  return authenticator.verify({ token: code, secret });
}