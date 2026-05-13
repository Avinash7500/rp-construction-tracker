package com.rpconstruction.insight.domain;

import java.util.Locale;

public enum DrawingFileType {
    DWG,
    DXF,
    PDF,
    IMAGE,
    UNKNOWN;

    public static DrawingFileType fromFilename(String filename) {
        if (filename == null) {
            return UNKNOWN;
        }
        String lower = filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".dwg")) {
            return DWG;
        }
        if (lower.endsWith(".dxf")) {
            return DXF;
        }
        if (lower.endsWith(".pdf")) {
            return PDF;
        }
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
            return IMAGE;
        }
        return UNKNOWN;
    }

    public boolean isSupportedForPhaseOne() {
        return this == DWG || this == DXF || this == PDF;
    }
}
