import axios from 'axios';

export interface BackendDocument {
  _id: string;
  userId: string;
  filename: string;
  filePath: string;
  fileUrl?: string;
  document_type: string;
  category: string;
  accuracy?: number;
  confidence: number;
  method: string;
  metadata: Record<string, unknown>;
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

interface UploadResponse {
  success: boolean;
  document: BackendDocument;
  result: Record<string, unknown>;
}

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

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
  return resp.data as UploadResponse;
}

export async function fetchUserDocuments(token: string): Promise<BackendDocument[]> {
  const resp = await axios.get(`${backendBaseUrl}/documents`, {
    headers: buildAuthHeaders(token)
  });
  return Array.isArray(resp.data) ? (resp.data as BackendDocument[]) : [];
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