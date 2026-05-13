package com.rpconstruction.insight.domain;

public record DrawingElement(
    String type,
    String label,
    String dimensions,
    String material,
    String layer,
    String coordinates,
    String sourceText
) {
}
