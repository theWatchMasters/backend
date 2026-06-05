import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

export function generateMFASecret(email: string) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: email, label: 'WatchMasters', secret });
  
  return { secret, otpauthUrl };
}

export async function generateMFAQRCode(otpauthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
}

export async function verifyMFAToken(code: string, secret: string): Promise<boolean> {
  return (await verify({ token: code, secret })).valid;
}