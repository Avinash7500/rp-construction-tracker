package com.rpconstruction.insight.domain;

import java.time.OffsetDateTime;

public record InsightFileRecord(
    String id,
    String siteId,
    String originalFilename,
    String contentType,
    DrawingFileType fileType,
    String storageKey,
    String storageUri,
    InsightFileStatus status,
    String errorMessage,
    int chunkCount,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
