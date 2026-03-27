const { verifyToken } = require('@clerk/backend');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    req.userId = payload.sub;
    req.userEmail = payload.email || payload.email_address || null;
    req.authPayload = payload;

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { authMiddleware };