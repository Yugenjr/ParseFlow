# Architecture and Flows

This page describes how ParseFlow moves a document from upload to storage and review.

## High-Level Architecture

- Frontend: user upload, history, filtering, and feedback
- Backend: request validation, classification orchestration, storage, metadata persistence, and sync
- ML service: OCR and model-backed support for image/document classification
- Storage: files organized by user, category, and document type
- Database: metadata, history, and extracted payloads

## Main Upload Flow

```mermaid
flowchart TD
    A[User uploads a document] --> B[Frontend sends file to backend]
    B --> C{File type}

    C -->|PDF| D[Convert first pages to images]
    D --> E[Vision-based classification]
    E --> F{Known document type?}
    F -->|Yes| G[Use detected type and category]
    F -->|No| H[Fallback to Unknown or Other]

    C -->|Image| I[ML classification]
    I --> J{Confidence above threshold?}
    J -->|Yes| G
    J -->|No| K[Vision fallback]
    K --> F

    G --> L[Derive folder path]
    H --> L
    L --> M[Store file in user/category/doc type path]
    M --> N[Persist metadata and extracted payload]
    N --> O[Return response to frontend]
    O --> P[Show document in history and explorer]
```

## Storage Flow

```mermaid
flowchart LR
    A[Upload] --> B[User ID]
    B --> C[Category]
    C --> D[Document Type]
    D --> E[Stored file path]
    E --> F[Metadata record]
    F --> G[Searchable history]
```

## Feedback Loop

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database

    U->>F: Marks a result as Correct or Wrong
    F->>B: Sends feedback event
    B->>D: Stores feedback with document metadata
    D-->>B: Acknowledges write
    B-->>F: Confirms update
```

## Design Intent

- Prefer deterministic storage paths so files are predictable.
- Use fallback classification so unknown documents still get handled.
- Keep metadata separate from file storage so history and search stay fast.
- Preserve a feedback path so the app can show corrections instead of hiding uncertainty.
