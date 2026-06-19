import type { RequestHandler } from 'express';
import { verifyAuthJWT } from './jwt.js';
import { getPrismaClient } from '../db/client.js';

/**
 * A higher-order function that wraps an Express request handler with authentication middleware.
 * The middleware checks for a valid JWT in the Authorization header of the incoming request,
 * verifies it, and if valid, extracts the user ID and email from the token and attaches them to res.locals
 * for use in the wrapped handler. If the token is missing or invalid, it returns a 401 Unauthorized response.
 *
 * @param handler The Express request handler to wrap with authentication middleware.
 * @returns A new Express request handler that includes authentication checks before invoking the original handler.
 */
export const authMiddleware: (arg0: RequestHandler) => RequestHandler =
  (handler) => async (req, res, next) => {
    // Check for the presence of an access token
    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith('Bearer ')
    ) {
      return res
        .status(401)
        .json({ success: false, error: 'error.unauthorized' });
    }
    // Verify the access token
    const jwt = verifyAuthJWT(
      req.headers.authorization.slice('Bearer '.length),
    );
    if (!jwt) {
      return res
        .status(401)
        .json({ success: false, error: 'error.unauthorized' });
    }
    // In the development environment, there may be JWTs that reference user IDs that do not exist in the database.
    if (process.env.NODE_ENV == 'development') {
      if (
        !(await getPrismaClient().user.findUnique({ where: { id: jwt.id } }))
      ) {
        return res
          .status(401)
          .json({ success: false, error: 'error.unauthorized' });
      }
    }
    // Attach user ID and email to res.locals for use in the handler
    res.locals.userId = jwt.id;
    res.locals.email = jwt.email;
    return await handler(req, res, next);
  };
