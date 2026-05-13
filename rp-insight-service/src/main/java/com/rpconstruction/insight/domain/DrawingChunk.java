package com.rpconstruction.insight.domain;

import java.util.Map;
import java.util.UUID;

public record DrawingChunk(
    UUID id,
    String siteId,
    String fileId,
    String chunkText,
    Map<String, Object> metadata
) {
}
