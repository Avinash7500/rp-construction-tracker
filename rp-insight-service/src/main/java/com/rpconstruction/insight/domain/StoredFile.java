package com.rpconstruction.insight.domain;

public record StoredFile(
    String fileId,
    String storageKey,
    String storageUri,
    long size
) {
}
