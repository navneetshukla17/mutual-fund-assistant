---
title: Axis Mutual Fund Assistant
emoji: 📈
colorFrom: indigo
colorTo: blue
sdk: gradio
app_file: app.py
pinned: false
---

# Mutual Fund FAQ Assistant (Prototype)

## Overview
A facts-only RAG assistant built for Axis Mutual Fund (5 schemes). It answers factual queries using strictly official SIDs, Factsheets, and leaflets.

## Scope
**AMC**: Axis Mutual Fund
**Schemes**:
1. Axis Large Cap Fund
2. Axis Flexi Cap Fund
3. Axis Small Cap Fund
4. Axis ELSS Tax Saver Fund
5. Axis Liquid Fund

## Architecture
- **Backend:** FastAPI (Python) serving a single `/api/chat` endpoint.
- **RAG Pipeline:** Uses ChromaDB for local vector storage, `google-genai` for LLM and embeddings (`gemini-2.5-flash` and `gemini-embedding-2`).
- **Frontend:** Pure HTML/JS/CSS utilizing Google's official Material Web Components (M3) for perfect mobile and desktop responsiveness without requiring a heavy React/Node.js build step.
- **Ingestion:** Uses `PyMuPDF` (fitz) for PDFs and `BeautifulSoup` for HTML parsing, naive character chunking, and metadata tagging from `sources.csv`.

## Disclaimer
**Facts-only. No investment advice.**
*   **Official Sources Only:** Answers are strictly grounded in SEBI, AMC, and AMFI records with source links.
*   **No Advice:** No portfolio queries, return forecasts, or buy/sell recommendations.

## Known Limits
*   Answers are limited to the provided static document corpus. No live web fetching at runtime.
*   SIDs might be slightly dated compared to live AMC pages unless overridden by an addendum.
*   The system relies on naive character chunking for PDF text, which may occasionally misinterpret complex tables.
*   If a document listed in `sources.csv` is missing from `data/raw/`, the ingestion script will simply skip it and log a warning.

## Setup Instructions

### 1. Prerequisites
Ensure you have Python 3.9+ installed.

### 2. Environment Setup
```bash
# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. API Key Configuration
Create a `.env` file in the root directory (you can use `.env.example` as a reference) and add your Gemini API Key:
```text
GEMINI_API_KEY=your_actual_api_key_here
LLM_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-2
```

### 4. Downloading Data (Optional Helper)
If you don't already have the raw PDF/HTML files in `data/raw/`, you can use the helper script to download them based on the URLs in `sources.csv`:
```bash
export PYTHONPATH=$(pwd)
python scripts/download_sources.py
```

### 5. Ingesting Data to Vector Store
Before running the app, you need to embed the documents and store them in ChromaDB. This process may take a few minutes depending on API rate limits:
```bash
export PYTHONPATH=$(pwd)
python scripts/ingest.py
```

### 6. Running the Application
Start the FastAPI server:
```bash
export PYTHONPATH=$(pwd)
uvicorn src.main:app --host 0.0.0.0 --port 8000
```
Then, open your web browser and navigate to **http://localhost:8000** to use the assistant!

### 7. Running Tests
To verify the strict guardrails and logic constraints, run the test suite:
```bash
export PYTHONPATH=$(pwd)
pytest tests/
```
