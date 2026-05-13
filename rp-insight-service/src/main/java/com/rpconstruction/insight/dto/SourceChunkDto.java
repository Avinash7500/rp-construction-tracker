package com.rpconstruction.insight.dto;

import java.util.Map;
import java.util.UUID;

public record SourceChunkDto(
    UUID id,
    String fileId,
    double similarity,
    String chunkText,
    Map<String, Object> metadata
) {
}
