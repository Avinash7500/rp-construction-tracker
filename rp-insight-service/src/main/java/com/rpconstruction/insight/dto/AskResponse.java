package com.rpconstruction.insight.dto;

import java.util.List;

public record AskResponse(
    String answer,
    String language,
    double confidence,
    List<SourceChunkDto> sourceChunks
) {
}
