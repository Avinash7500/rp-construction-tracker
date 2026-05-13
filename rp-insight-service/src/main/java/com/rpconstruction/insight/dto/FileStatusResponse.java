package com.rpconstruction.insight.dto;

public record FileStatusResponse(
    String fileId,
    String siteId,
    String originalFilename,
    String fileType,
    String status,
    int chunkCount,
    String errorMessage
) {
}
