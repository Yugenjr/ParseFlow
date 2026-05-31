# ParseFlow

ParseFlow is an AI-powered document intelligence platform that classifies, stores, and organizes uploaded files (PDF, JPG, JPEG, PNG) into structured folders with searchable history and feedback-driven improvements.

## What Is Included

- Hybrid classification path with confidence-based fallback
- Category-aware storage (`Identity`, `Financial`, `Legal`, `Compliance`, `Tax`, `Business`, `Other`)
- Auto folder creation by category and document type
- History and document explorer with category filtering and search
- Feedback flow for top history item (`Correct` / `Wrong`)
- Optional Google Drive auto-sync
- Security extensions: auth middleware, encrypted extracted payload storage, file hash integrity, secure file access route

## System Flow

```mermaid
flowchart TD
    A[Upload Document] --> B[Backend /upload]
    B --> C{File Type}

    C -->|PDF| D[Convert PDF to Images\nup to 3 pages]
    D --> E[Vision LLM Classification\nper page]
    E --> F{Known Doc Type?}
    F -->|Yes| G[Use Vision Result]
    F -->|No| H[Fallback Unknown/Other]

    C -->|Image| I[ML Classifier]
    I --> J{Confidence >= Threshold}
    J -->|Yes| K[Use ML Result]
    J -->|No| L[Vision LLM Fallback]

    G --> M[Derive Category + DocType]
    H --> M
    K --> M
    L --> M

    M --> N[Persist File to Storage\nstorage/userId/category/docType/file]
    N --> O[Persist Metadata to MongoDB]
    O --> P[Security Layer\nfileHash + encryptedData]
    P --> Q[Optional Google Drive Sync]
    Q --> R[API Response]

    R --> S[Frontend: Documents + History + Feedback]
    S --> T[Feedback Submitted\nCorrect/Wrong]
    T --> U[Next Top History Document]
```

## Current Architecture

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + MongoDB
- Classification: ML first, Vision LLM fallback for low confidence/unknown cases
- Storage: Local file system under user/category/doc-type path
- Auth: Clerk token verification (plus `x-user-id` compatibility path)

## Repository Layout

```
docs/          # Product docs, usage, architecture, contribution, conduct
parseflow_main/
  backend/     # Express API, classification orchestration, storage sync, notifications
  frontend/    # React/Vite UI
  ml-service/  # Python services for model/OCR-related tasks
  storage/     # Persisted documents
```

## Quick Start

### 1. Install dependencies

From repository root:

```powershell
npm --prefix "parseflow_main/backend" install
npm --prefix "parseflow_main/frontend" install
```

### 2. Configure environment

Backend env:

- Copy `parseflow_main/backend/.env.example` to `parseflow_main/backend/.env`
- Set required values (`CLERK_SECRET_KEY`, `MONGO_URI`, `GROQ_API_KEY`, `DATA_ENCRYPTION_KEY`, etc.)

Frontend env:

- Set `VITE_BACKEND_URL` in `parseflow_main/frontend/.env`
- Local default is usually `http://localhost:5000`

### 3. Start services

Backend:

```powershell
cd "parseflow_main/backend"
npm start
```

Frontend:

```powershell
cd "parseflow_main/frontend"
npm run dev
```

If port `5000` is already in use, stop the existing process first, then restart backend.

## Security Enhancements

- Middleware auth gate for protected routes
- Extracted payload encryption before DB write (`encryptedData`)
- SHA-256 integrity hash per stored file (`fileHash`)
- Secure file route with user-level access validation for authenticated requests
- Env-based secret handling (`DATA_ENCRYPTION_KEY` and related credentials)

## Category and Folder Behavior

- Backend now preserves explicit `Compliance` category from model output.
- Compliance docs are stored under `Compliance/...`, not forced to `Other`.
- UI category rendering prefers:
  1. `storage.category`
  2. `classification.category`
  3. `category`
  4. fallback `Other`

## Troubleshooting

### Backend does not start (`EADDRINUSE` on 5000)

```powershell
$conn = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($conn) { Stop-Process -Id $conn.OwningProcess -Force }
cd "parseflow_main/backend"
npm start
```

### UI still shows old category/result

- Ensure backend is running latest code (not stale node process)
- Re-upload document after backend restart
- Hard refresh frontend browser tab
- Verify `VITE_BACKEND_URL` points to active backend

## Additional Documentation

For full onboarding and operations details, see [docs/README.md](docs/README.md).

The docs folder includes product rationale, how to use ParseFlow, system architecture, flow diagrams, and community guidelines.
