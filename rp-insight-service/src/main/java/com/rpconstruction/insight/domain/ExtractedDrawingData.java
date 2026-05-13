package com.rpconstruction.insight.domain;

import java.util.List;

public record ExtractedDrawingData(
    String siteId,
    String fileId,
    DrawingFileType fileType,
    List<String> layers,
    List<DrawingElement> elements,
    String rawText,
    List<String> warnings
) {
}
