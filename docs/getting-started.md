# Getting Started

This guide explains how to run and use ParseFlow locally.

## Prerequisites

- Node.js and npm for the backend and frontend
- Python for the ML service
- MongoDB for metadata storage
- The required environment variables for each service

## Local Setup

1. Install backend dependencies from `parseflow_main/backend`.
2. Install frontend dependencies from `parseflow_main/frontend`.
3. Configure the backend environment file with the required secrets and service URLs.
4. Configure the frontend environment file with the backend base URL.
5. Start the backend service.
6. Start the frontend service.

## Using the App

1. Sign in if authentication is enabled in your environment.
2. Upload a supported file such as PDF, JPG, JPEG, or PNG.
3. Review the detected category and document type.
4. Open history or filters to revisit previous documents.
5. Submit feedback when the classification is correct or needs correction.

## Practical Notes

- PDFs are processed page by page for the initial classification path.
- Images go through the ML classification path first.
- Low-confidence or unknown results fall back to the vision-based flow.

## If Something Fails

- Check that the backend is reachable from the frontend.
- Confirm the environment variables are loaded correctly.
- Verify that MongoDB is running and accepting connections.
- Re-upload the file after fixing the underlying service issue.
