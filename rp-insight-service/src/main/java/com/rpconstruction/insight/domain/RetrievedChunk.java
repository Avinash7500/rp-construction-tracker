package com.rpconstruction.insight.domain;

import java.util.Map;
import java.util.UUID;

public record RetrievedChunk(
    UUID id,
    String siteId,
    String fileId,
    String chunkText,
    double similarity,
    Map<String, Object> metadata
) {
}
