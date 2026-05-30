const { verifyToken } = require('@clerk/backend');

async function authMiddleware(req, res, next) {
  try {
    const headerUserId = req.headers['x-user-id'];
    if (headerUserId) {
      req.userId = String(headerUserId);
      req.user = { id: req.userId };
      req.userEmail = null;
      req.authPayload = null;
      return next();
    }

    const authHeader = req.headers.authorization || '';
    let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // Allow token via query parameter for preview proxy (use carefully)
    if (!token && req.query && req.query.token) {
      token = String(req.query.token || '').trim();
    }

    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    req.userId = payload.sub;
    req.user = { id: req.userId };
    req.userEmail = payload.email || payload.email_address || null;
    req.authPayload = payload;

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;