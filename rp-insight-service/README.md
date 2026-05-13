# RP Insight Service

Spring Boot backend for the RP Construction Tracker "Digital Site Engineer" feature.

## What It Implements

- `POST /api/rp-insight/upload` accepts DWG, DXF and PDF drawings.
- Files are stored through a pluggable storage layer: local disk for development, Firebase Storage for production.
- CAD is parsed as structured drawing data, not as an image.
- DWG/DXF parsing uses Aspose.CAD first, with Kabeja fallback for DXF.
- PDF text extraction uses Apache PDFBox, with optional Tesseract OCR fallback.
- Extracted drawing data is normalized, chunked, embedded with LangChain4j Gemini embeddings, and stored in PostgreSQL pgvector.
- `POST /api/rp-insight/ask` performs site-scoped RAG retrieval and answers through LangChain4j with Gemini by default or OpenAI GPT-4o when configured.
- Responses include language, confidence and source chunks.

## Local Start

```bash
cd rp-insight-service
docker compose up -d
```

Set at least:

```bash
set GEMINI_AI_KEY=your_key
```

The default local test model is `gemini-2.5-flash-lite` because free-tier projects may have zero quota for `gemini-2.5-pro`. For production-quality reasoning, set `RP_INSIGHT_GEMINI_MODEL=gemini-2.5-pro` after enabling billing or confirming quota in AI Studio.

Then run:

```bash
mvn spring-boot:run
```

The service starts on `http://localhost:8081`.

If Maven previously failed to resolve Aspose.CAD or Kabeja, force a dependency refresh once:

```bash
mvn -U test
```

## Frontend Integration

The React app has an RP Insight page at:

```text
/rp-insight
```

It is hidden by default while the feature is still being finished. Enable it in the React app with:

```bash
set VITE_RP_INSIGHT_ENABLED=true
```

For local frontend development, keep the Spring Boot service running on port `8081`. The React app defaults to `http://localhost:8081`, or you can override it with:

```bash
set VITE_RP_INSIGHT_API_BASE=http://localhost:8081
```

The backend allows Vite dev origins by default. To add another frontend origin, set:

```bash
set RP_INSIGHT_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Upload Example

```bash
curl -X POST http://localhost:8081/api/rp-insight/upload ^
  -F "siteId=site123" ^
  -F "file=@C:\drawings\structural.dxf"
```

Response:

```json
{
  "fileId": "file-uuid",
  "siteId": "site123",
  "status": "PROCESSING",
  "storageUri": "...",
  "message": "Upload accepted. RP Insight parsing and vector indexing has started."
}
```

Check ingestion status:

```bash
curl http://localhost:8081/api/rp-insight/files/{fileId}
```

## Ask Example

```bash
curl -X POST http://localhost:8081/api/rp-insight/ask ^
  -H "Content-Type: application/json" ^
  -d "{\"siteId\":\"site123\",\"question\":\"कॉलमची जाडी किती आहे?\"}"
```

Response shape:

```json
{
  "answer": "ड्रॉइंगनुसार Column P1 ची जाडी 300x300 mm आहे.",
  "language": "Marathi",
  "confidence": 0.87,
  "sourceChunks": []
}
```

## Production Notes

- Enable the `vector` extension on the managed PostgreSQL database before running Flyway if the DB user cannot create extensions.
- `rp_insight_chunks.embedding` is fixed to `vector(768)`, matching `RP_INSIGHT_EMBEDDING_DIMENSIONS`.
- For Firebase Storage, set `RP_INSIGHT_STORAGE_BACKEND=FIREBASE`, `RP_INSIGHT_FIREBASE_BUCKET`, and either `GOOGLE_APPLICATION_CREDENTIALS` or `RP_INSIGHT_FIREBASE_CREDENTIALS_PATH`.
- For Aspose.CAD production use, set `ASPOSE_CAD_LICENSE_PATH`.
- OCR is off by default. Enable it with `RP_INSIGHT_OCR_ENABLED=true` and configure Tesseract language data for `eng+hin+mar`.
- The LLM prompt explicitly forbids guessing. If retrieval is weak, the API returns a missing-data answer without calling the LLM.

## Core Flow

```text
Upload File
  -> Store original file
  -> Parse DWG/DXF/PDF
  -> Extract layers, labels, dimensions, materials, coordinates and raw text
  -> Chunk extracted data
  -> Embed chunks with LangChain4j
  -> Store vectors in pgvector
  -> Embed question
  -> Retrieve top site-scoped chunks
  -> Ask LLM with strict context-only prompt
  -> Return answer, language, confidence and sources
```
