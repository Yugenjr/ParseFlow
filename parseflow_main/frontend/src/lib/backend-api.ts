import axios from 'axios';

export interface BackendDocument {
  _id: string;
  userId: string;
  filename: string;
  filePath: string;
  fileUrl?: string;
  document_type: string;
  category: string;
  confidence: number;
  method: string;
  metadata: Record<string, unknown>;
  storage?: {
    category?: string;
    docType?: string;
    filePath?: string;
    fileUrl?: string;
  };
  classification?: {
    document_type?: string;
    category?: string;
    confidence?: number;
    method?: string;
  };
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