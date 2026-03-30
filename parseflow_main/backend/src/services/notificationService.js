const Notification = require('../models/Notification');

async function createNotification(userId, message, type) {
  return Notification.create({ userId, message, type });
}

async function getRecentNotifications(userId) {
  return Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
}

module.exports = {
  createNotification,
  getRecentNotifications
};
