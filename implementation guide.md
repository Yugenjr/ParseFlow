# ParseFlow Implementation Guide

This guide explains how a new user can set up, run, and understand ParseFlow end-to-end.

## 1. What ParseFlow Does

ParseFlow classifies uploaded documents (PDF/JPG/JPEG/PNG) and stores them in folder structure by category and document type.

Core processing path:

1. User uploads a file
2. Backend receives file
3. Classification logic runs
4. If needed, OCR + Vision LLM fallback runs
5. Document is saved in storage folder tree
6. Metadata is saved in MongoDB
7. Frontend shows history/documents/results

## 2. Current Project Structure

Top-level workspace:

- `parseflow_main/backend` - Node.js + Express API, classification orchestration, storage sync
- `parseflow_main/frontend` - React + Vite UI
- `parseflow_main/ml-service` - Python ML/OCR-related services
- `parseflow_main/storage` - persisted files organized by user/category/doc-type

## 3. Prerequisites

Install these first:

- Node.js 18+ (Node 20 recommended)
- npm
- Python (for ml-service)
- MongoDB Atlas URI or local MongoDB
- Clerk keys (if using token auth flow)
- Groq API key(s) for LLM/Vision route

Optional but commonly used in this project:

- ngrok (for exposing local backend)
- Vercel CLI (for frontend deployment)

## 4. Environment Setup

### 4.1 Backend env file

Create backend env file from example:

1. Go to `parseflow_main/backend`
2. Copy `.env.example` to `.env`
3. Fill values for at least:

- `CLERK_SECRET_KEY`
- `MONGO_URI`
- `GROQ_API_KEY`
- `GUIDEBOT_GROQ_API_KEY` (if used)
- `DOCBOT_GROQ_API_KEY` (if used)
- `DATA_ENCRYPTION_KEY` (new security layer)

Note:

- `.env` is ignored by git.
- Never commit real keys.

### 4.2 Frontend env file

In `parseflow_main/frontend/.env`, ensure:

- `VITE_BACKEND_URL=http://localhost:5000`

If backend is tunneled via ngrok, set it to the ngrok URL.

## 5. Install Dependencies

### 5.1 Backend

From repo root:

```powershell
npm --prefix "parseflow_main/backend" install
```

### 5.2 Frontend

From repo root:

```powershell
npm --prefix "parseflow_main/frontend" install
```

### 5.3 ML Service

Use your Python environment inside `parseflow_main/ml-service` and install required packages for that service.

## 6. Run Services (Recommended Order)

### 6.1 Start backend

```powershell
cd "parseflow_main/backend"
npm start
```

Expected log includes:

- `Backend running on port 5000`
- `MongoDB connected`

### 6.2 Start frontend

In a separate terminal:

```powershell
cd "parseflow_main/frontend"
npm run dev
```

Vite usually serves on `http://localhost:5173`.

### 6.3 Start ml-service (if required by your flow)

Start your Python service from `parseflow_main/ml-service` using your existing command/env.

## 7. How Classification and Storage Work

For each upload, backend computes:

- `document_type`
- `category`
- `confidence` and `accuracy`
- `folder`

Then saves the file under:

`storage/<userId>/<category>/<docType>/<filename>`

Example:

`storage/user_123/Compliance/Certificate_of_Compliance/cert.pdf`

Important:

- Category is derived in backend and now supports `Compliance` directly.
- Compliance payloads are preserved and should not be forced to `Other`.

## 8. Security Layers Added

Security was added in modular way without replacing pipeline architecture.

### 8.1 Access control middleware

File: `parseflow_main/backend/src/middleware/authMiddleware.js`

Supports:

- Bearer token verification (Clerk)
- `x-user-id` header fallback

### 8.2 Encrypted extracted payload storage

File: `parseflow_main/backend/src/utils/encryption.js`

- AES encryption using `DATA_ENCRYPTION_KEY`
- Encrypted payload stored in Mongo field `encryptedData`

### 8.3 File integrity hash

File: `parseflow_main/backend/src/utils/hash.js`

- SHA-256 hash generated for stored files
- Hash stored in Mongo field `fileHash`

### 8.4 Secure file route

Route added in backend:

- `GET /files/:userId/:category/:docType/:filename`

Behavior:

- Validates requesting user for authenticated requests
- Prevents user-to-user file access
- Keeps backward compatibility for existing static file access paths

## 9. UI Behavior Notes

### Documents page

Category display now prefers:

1. `storage.category`
2. `classification.category`
3. `category`
4. fallback `Other`

This prevents false `Other` labels when richer category metadata exists.

### History page

Includes `Other` filter and search support over:

- filename
- category
- document type

### Feedback page

Current behavior:

- Uses top history document as pending feedback target
- Shows only Correct/Wrong
- After submit, target vanishes until a new top document appears

## 10. Common Troubleshooting

### Issue: Backend keeps failing to start with port error

Symptom:

- `EADDRINUSE: address already in use :::5000`

Fix:

```powershell
$conn = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
cd "parseflow_main/backend"
npm start
```

### Issue: UI still shows old behavior after code change

Possible causes:

- Old backend process still running
- Frontend using older deployed build
- Browser cache

Fix checklist:

1. Restart backend on 5000
2. Restart frontend dev server
3. Hard refresh browser
4. Confirm `VITE_BACKEND_URL` points to correct backend

### Issue: Compliance predicted but shown/stored as Other

Checklist:

1. Verify backend is running latest code
2. Verify response payload has `category: Compliance`
3. Re-upload once after backend restart
4. Confirm path under `storage/<userId>/Compliance/...`

## 11. Optional Deployment Notes

### Backend via ngrok

```powershell
ngrok http 5000
```

Use resulting HTTPS URL in frontend env:

- `VITE_BACKEND_URL=https://<your-ngrok-subdomain>.ngrok-free.dev`

### Frontend via Vercel CLI

```powershell
npx vercel --cwd "parseflow_main/frontend" --prod --yes
```

If ngrok URL changes, update frontend env and redeploy.

## 12. Quick Validation Flow for New User

1. Start backend and frontend
2. Upload a document
3. Open History and verify category
4. Open Documents and verify folder grouping
5. Open Feedback and submit correct/wrong
6. Confirm the item disappears after feedback

## 13. Summary

ParseFlow combines classification, OCR, fallback LLM analysis, structured storage, and UI workflows.

Recent enhancements include:

- Compliance-aware categorization and foldering
- Additional security layers (auth, encryption, hashing, secure file route)
- Improved category rendering consistency in UI

This setup keeps backward compatibility while improving correctness and security.
