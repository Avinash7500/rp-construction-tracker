CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rp_insight_files (
    id VARCHAR(64) PRIMARY KEY,
    site_id VARCHAR(128) NOT NULL,
    original_filename TEXT NOT NULL,
    content_type TEXT,
    file_type VARCHAR(24) NOT NULL,
    storage_key TEXT NOT NULL,
    storage_uri TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    error_message TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rp_insight_chunks (
    id UUID PRIMARY KEY,
    site_id VARCHAR(128) NOT NULL,
    file_id VARCHAR(64) NOT NULL REFERENCES rp_insight_files(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rp_insight_files_site_status
    ON rp_insight_files(site_id, status);

CREATE INDEX IF NOT EXISTS idx_rp_insight_chunks_site_file
    ON rp_insight_chunks(site_id, file_id);

CREATE INDEX IF NOT EXISTS idx_rp_insight_chunks_metadata
    ON rp_insight_chunks USING gin(metadata);

CREATE INDEX IF NOT EXISTS idx_rp_insight_chunks_embedding_hnsw
    ON rp_insight_chunks USING hnsw (embedding vector_cosine_ops);
