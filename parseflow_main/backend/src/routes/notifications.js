const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { getRecentNotifications } = require('../services/notificationService');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await getRecentNotifications(req.userId);
    return res.json({ notifications });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch notifications' });
  }
});

module.exports = router;
