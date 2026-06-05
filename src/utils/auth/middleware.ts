import type { RequestHandler } from 'express';
import { verifyJWT } from './jwt.js';

export const authMiddleware: (arg0: RequestHandler) => RequestHandler =
  (handler) => async (req, res, next) => {
    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith('Bearer ')
    ) {
      return res
        .status(401)
        .json({ success: false, error: 'error.unauthorized' });
    }
    const jwt = verifyJWT(req.headers.authorization.slice(7));
    if (!jwt) {
      return res
        .status(401)
        .json({ success: false, error: 'error.unauthorized' });
    }
    res.locals.userId = jwt.id;
    res.locals.email = jwt.email;
    return await handler(req, res, next);
  };
