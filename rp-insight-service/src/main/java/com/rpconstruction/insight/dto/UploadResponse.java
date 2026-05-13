package com.rpconstruction.insight.dto;

public record UploadResponse(
    String fileId,
    String siteId,
    String status,
    String storageUri,
    String message
) {
}
