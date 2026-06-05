import jwt from 'jsonwebtoken';

export function generateJWT(userId: string, userEmail: string): string {
  return jwt.sign(
    { email: userEmail, id: userId, type: 'jwt' },
    process.env.JWT_SECRET!,
    { expiresIn: '7d', subject: userId },
  );
}

export function generateMFAToken(userId: string, userEmail: string): string {
  return jwt.sign(
    { email: userEmail, id: userId, type: 'mfa' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h', subject: userId },
  );
}

export function verifyJWT(
  token: string,
): { email: string; id: string } | undefined {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      email: string;
      id: string;
      type: string;
    };
    if (payload.type !== 'jwt') {
      return undefined;
    }
    return { email: payload.email, id: payload.id };
  } catch (err) {
    return undefined;
  }
}

export function verifyMFAToken(
  token: string,
): { email: string; id: string } | undefined {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      email: string;
      id: string;
      type: string;
    };
    if (payload.type !== 'mfa') {
      return undefined;
    }
    return { email: payload.email, id: payload.id };
  } catch (err) {
    return undefined;
  }
}
