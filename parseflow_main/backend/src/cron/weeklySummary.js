const cron = require('node-cron');
const fs = require('fs');
const { createClerkClient } = require('@clerk/backend');
const User = require('../models/User');
const Document = require('../models/Document');
const { sendEmail } = require('../services/emailService');

const STORAGE_LIMIT_MB = 20;
const clerkClient = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

function calculateStorageUsedMB(docs) {
  let totalBytes = 0;
  for (const doc of docs) {
    try {
      if (doc.filePath && fs.existsSync(doc.filePath)) {
        totalBytes += fs.statSync(doc.filePath).size;
      }
    } catch {
      // Ignore missing/unreadable files for summary calculation.
    }
  }
  return totalBytes / (1024 * 1024);
}

async function resolveWeeklyEmail(clerkId, fallbackEmail) {
  if (clerkClient) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const primaryEmail = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
      if (primaryEmail && primaryEmail.emailAddress) {
        return primaryEmail.emailAddress;
      }
      if (clerkUser.emailAddresses[0] && clerkUser.emailAddresses[0].emailAddress) {
        return clerkUser.emailAddresses[0].emailAddress;
      }
    } catch (err) {
      console.warn('Weekly summary email resolution from Clerk failed:', err && (err.message || err));
    }
  }

  return fallbackEmail || null;
}

function startWeeklySummaryJob() {
  return cron.schedule('0 9 * * 0', async () => {
    try {
      const users = await User.find({}, { clerkId: 1, email: 1 }).lean();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for (const user of users) {
        const userId = user && user.clerkId;
        const email = await resolveWeeklyEmail(userId, user && user.email);
        if (!userId || !email) continue;

        const weeklyDocs = await Document.find({ userId, createdAt: { $gte: weekAgo } })
          .select({ category: 1 })
          .lean();

        const allDocs = await Document.find({ userId })
          .select({ filePath: 1 })
          .lean();

        const uploadedCount = weeklyDocs.length;
        const storageUsedMB = calculateStorageUsedMB(allDocs);
        const storagePercent = Math.min(100, Math.round((storageUsedMB / STORAGE_LIMIT_MB) * 100));
        const categorySet = new Set(
          weeklyDocs
            .map((doc) => String(doc.category || '').trim())
            .filter(Boolean)
        );
        const categories = categorySet.size > 0 ? Array.from(categorySet).join(', ') : 'None';

        const body = `You uploaded ${uploadedCount} documents.\nStorage used: ${storageUsedMB.toFixed(2)} MB (${storagePercent}%).\nCategories: ${categories}.`;
        await sendEmail(email, 'Your Weekly ParseFlow Summary', body);
      }
    } catch (err) {
      console.error('Weekly summary job failed:', err && (err.message || err));
    }
  });
}

module.exports = {
  startWeeklySummaryJob
};
