import jwt, { type SignOptions } from 'jsonwebtoken';

type JWTGenerator = (userId: string, userEmail: string) => string
type JWTVerifier = (token: string) => { email: string, id: string } | undefined

function generateJWT(type: string, expiresIn: SignOptions["expiresIn"] = '7d'): JWTGenerator {
  return (userId, userEmail) => {
    return jwt.sign(
      { email: userEmail, id: userId, type: type },
      process.env.JWT_SECRET!,
      { expiresIn: expiresIn, subject: userId },
    );
  }
}

function verifyJWT(type: string): JWTVerifier {
  return token => {
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
    } catch (err) {
      return undefined;
    }
  }
}


export const generateAuthJWT = generateJWT("jwt");
export const generateMFAJWT = generateJWT("mfa", "1h");
export const generateMagicJWT = generateJWT("magic", "1h");

export const verifyAuthJWT = verifyJWT("jwt");
export const verifyMFAJWT = verifyJWT("mfa");
export const verifyMagicJWT = verifyJWT("magic");
