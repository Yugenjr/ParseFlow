import axios from 'axios';

export interface BackendDocument {
  _id: string;
  userId: string;
  fileName: string;
  filename?: string;
  fileUrl: string;
  publicId: string;
  document_type?: string;
  category?: string;
  accuracy?: number;
  confidence: number;
  method: string;
  metadata?: Record<string, unknown>;
  extracted_text?: string;
  llm_analysis?: {
    summary?: string;
    key_fields?: Record<string, unknown>;
  };
  storage?: {
    category?: string;
    docType?: string;
    filePath?: string;
    fileUrl?: string;
  };
  classification?: {
    document_type?: string;
    category?: string;
    accuracy?: number;
    confidence?: number;
    method?: string;
  };
  createdAt: string;
}

export interface BackendNotification {
  _id: string;
  userId: string;
  message: string;
  type: 'STORAGE' | 'INSIGHT' | 'ORGANIZATION' | string;
  read: boolean;
  createdAt: string;
}

export interface BackendStats {
  avgProcessingTimeSec: number;
  queryCount: number;
}

interface UploadResponse {
  success: boolean;
  file?: BackendDocument;
  document?: BackendDocument;
}

export interface GoogleDriveStatus {
  connected: boolean;
}

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL || '/api-proxy';

function normalizeDocument(doc: Partial<BackendDocument>): BackendDocument {
  const normalizedName = String(doc.fileName || doc.filename || 'Unnamed file');
  return {
    _id: String(doc._id || ''),
    userId: String(doc.userId || ''),
    fileName: normalizedName,
    filename: normalizedName,
    fileUrl: String(doc.fileUrl || ''),
    publicId: String(doc.publicId || ''),
    document_type: doc.document_type,
    category: doc.category,
    accuracy: doc.accuracy,
    confidence: doc.confidence,
    method: doc.method,
    metadata: doc.metadata,
    extracted_text: doc.extracted_text,
    llm_analysis: doc.llm_analysis,
    storage: doc.storage,
    classification: doc.classification,
    createdAt: String(doc.createdAt || new Date().toISOString()),
  };
}

function buildAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`
  };
}

export async function uploadDocument(file: File, token: string, onProgress?: (percent: number) => void): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const resp = await axios.post(`${backendBaseUrl}/upload`, formData, {
    headers: buildAuthHeaders(token),
    onUploadProgress: (evt) => {
      if (!onProgress) return;
      const total = evt.total || 0;
      if (total <= 0) return;
      const percent = Math.round((evt.loaded * 100) / total);
      onProgress(Math.max(1, Math.min(100, percent)));
    }
  });
  const data = resp.data as UploadResponse;
  if (data.file) data.file = normalizeDocument(data.file);
  if (data.document) data.document = normalizeDocument(data.document);
  return data;
}

export async function uploadDocumentToFolder(file: File, folder: string, token: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const resp = await axios.post(`${backendBaseUrl}/upload`, formData, {
    headers: buildAuthHeaders(token)
  });
  const data = resp.data as UploadResponse;
  if (data.file) data.file = normalizeDocument(data.file);
  if (data.document) data.document = normalizeDocument(data.document);
  return data;
}

export async function fetchUserDocuments(token: string): Promise<BackendDocument[]> {
  const resp = await axios.get(`${backendBaseUrl}/files`, {
    headers: buildAuthHeaders(token)
  });
  if (!Array.isArray(resp.data)) return [];
  return (resp.data as Partial<BackendDocument>[]).map((doc) => normalizeDocument(doc));
}

export async function deleteUserDocument(documentId: string, token: string): Promise<void> {
  const encodedId = encodeURIComponent(String(documentId || '').trim());
  if (!encodedId) {
    throw new Error('Invalid document id');
  }

  try {
    await axios.delete(`${backendBaseUrl}/files/${encodedId}`, {
      headers: buildAuthHeaders(token)
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new Error(String(err.response?.data?.error || err.message || 'Delete failed'));
    }
    throw err;
  }
}

export async function queryDocBot(question: string, token: string): Promise<{ answer: string; documents_used: number }> {
  let resp;
  try {
    resp = await axios.post(
      `${backendBaseUrl}/api/docbot/query`,
      { question },
      { headers: buildAuthHeaders(token) }
    );
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      resp = await axios.post(
        `${backendBaseUrl}/docbot/query`,
        { question },
        { headers: buildAuthHeaders(token) }
      );
    } else {
      throw err;
    }
  }

  const data = resp.data as { answer?: string; documents_used?: number };
  return {
    answer: String(data.answer || "I couldn't find this in your documents."),
    documents_used: Number(data.documents_used || 0)
  };
}

export async function fetchRecentNotifications(token: string): Promise<BackendNotification[]> {
  const resp = await axios.get(`${backendBaseUrl}/notifications`, {
    headers: buildAuthHeaders(token)
  });

  const data = resp.data as { notifications?: BackendNotification[] };
  return Array.isArray(data.notifications) ? data.notifications : [];
}

export async function fetchDashboardStats(token: string): Promise<BackendStats> {
  const resp = await axios.get(`${backendBaseUrl}/api/stats`, {
    headers: buildAuthHeaders(token)
  });

  const data = resp.data as { avgProcessingTimeSec?: number; queryCount?: number };
  return {
    avgProcessingTimeSec: Number(data.avgProcessingTimeSec || 0),
    queryCount: Number(data.queryCount || 0)
  };
}

export async function fetchGoogleDriveStatus(token: string): Promise<GoogleDriveStatus> {
  const resp = await axios.get(`${backendBaseUrl}/api/google-drive/status`, {
    headers: buildAuthHeaders(token)
  });
  const data = resp.data as { connected?: boolean };
  return { connected: Boolean(data.connected) };
}

export async function fetchGoogleDriveAuthUrl(token: string): Promise<string> {
  const resp = await axios.get(`${backendBaseUrl}/api/google-drive/auth-url`, {
    headers: buildAuthHeaders(token)
  });
  const data = resp.data as { url?: string };
  if (!data.url) {
    throw new Error('Failed to get Google OAuth URL');
  }
  return data.url;
}