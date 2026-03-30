const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const DRIVE_SCOPE = ['https://www.googleapis.com/auth/drive.file'];
const DRIVE_ROOT_FOLDER_NAME = process.env.GOOGLE_DRIVE_ROOT_FOLDER || 'ParseFlow';

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://10.0.111.131:5000/auth/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are missing (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function createGoogleAuthUrl(stateToken) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: DRIVE_SCOPE,
    state: stateToken,
  });
}

function escapeQueryValue(value) {
  return String(value || '').replace(/'/g, "\\'");
}

async function getDriveClientFromUser(userDoc) {
  if (!userDoc || !userDoc.googleDrive || !userDoc.googleDrive.connected) {
    throw new Error('Google Drive is not connected for this user');
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: userDoc.googleDrive.access_token || undefined,
    refresh_token: userDoc.googleDrive.refresh_token || undefined,
    expiry_date: userDoc.googleDrive.token_expiry_date || undefined,
  });

  await oauth2Client.getAccessToken();

  const refreshed = oauth2Client.credentials || {};
  let dirty = false;

  if (refreshed.access_token && refreshed.access_token !== userDoc.googleDrive.access_token) {
    userDoc.googleDrive.access_token = refreshed.access_token;
    dirty = true;
  }
  if (refreshed.refresh_token && refreshed.refresh_token !== userDoc.googleDrive.refresh_token) {
    userDoc.googleDrive.refresh_token = refreshed.refresh_token;
    dirty = true;
  }
  if (typeof refreshed.expiry_date === 'number' && refreshed.expiry_date !== userDoc.googleDrive.token_expiry_date) {
    userDoc.googleDrive.token_expiry_date = refreshed.expiry_date;
    dirty = true;
  }

  if (dirty) {
    await userDoc.save();
  }

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  return { drive };
}

async function getOrCreateFolder({ drive, name, parentId }) {
  const safeName = escapeQueryValue(name);
  const queryParts = [
    "mimeType='application/vnd.google-apps.folder'",
    `name='${safeName}'`,
    'trashed=false',
  ];

  if (parentId) {
    queryParts.push(`'${parentId}' in parents`);
  }

  const query = queryParts.join(' and ');

  const existing = await drive.files.list({
    q: query,
    fields: 'files(id,name)',
    spaces: 'drive',
    pageSize: 1,
  });

  const found = existing.data && existing.data.files && existing.data.files[0];
  if (found && found.id) {
    return found.id;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });

  return created.data.id;
}

function normalizeDriveFolderSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"\\|?*]/g, '')
    .replace(/\s+/g, '_');
}

async function ensureFolderStructure({ drive, userId, category, docType }) {
  const rootId = await getOrCreateFolder({ drive, name: DRIVE_ROOT_FOLDER_NAME });

  const categoryName = normalizeDriveFolderSegment(category || 'Other') || 'Other';
  let folderId = await getOrCreateFolder({ drive, name: categoryName, parentId: rootId });

  const subCategoryParts = String(docType || '')
    .split(/[\\/]+/)
    .map((part) => normalizeDriveFolderSegment(part))
    .filter((part) => part && part.toLowerCase() !== 'unknown');

  for (const part of subCategoryParts) {
    folderId = await getOrCreateFolder({ drive, name: part, parentId: folderId });
  }

  return folderId;
}

async function uploadToDrive({ filePath, fileName, userId, category, docType, userDoc }) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`File not found for Drive sync: ${filePath || 'unknown path'}`);
  }

  const { drive } = await getDriveClientFromUser(userDoc);
  const folderId = await ensureFolderStructure({ drive, userId, category, docType });

  const uploaded = await drive.files.create({
    requestBody: {
      name: fileName || path.basename(filePath),
      parents: [folderId],
    },
    media: {
      body: fs.createReadStream(filePath),
    },
    fields: 'id,webViewLink',
  });

  return {
    fileId: uploaded.data.id || null,
    fileUrl: uploaded.data.webViewLink || null,
  };
}

module.exports = {
  createGoogleAuthUrl,
  getOAuthClient,
  ensureFolderStructure,
  uploadToDrive,
};
