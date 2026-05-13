package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.DrawingChunk;
import com.rpconstruction.insight.domain.DrawingElement;
import com.rpconstruction.insight.domain.ExtractedDrawingData;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DrawingChunkingService {

    public List<DrawingChunk> chunk(ExtractedDrawingData data, int targetChars, int overlapChars) {
        List<DrawingChunk> chunks = new ArrayList<>();

        for (DrawingElement element : data.elements()) {
            String chunkText = elementChunkText(data, element);
            if (StringUtils.hasText(chunkText)) {
                chunks.add(new DrawingChunk(UUID.randomUUID(), data.siteId(), data.fileId(), chunkText, metadata(data, element)));
            }
        }

        String rawText = data.rawText();
        if (StringUtils.hasText(rawText)) {
            for (String part : splitText(rawText, Math.max(300, targetChars), Math.max(0, overlapChars))) {
                chunks.add(new DrawingChunk(
                    UUID.randomUUID(),
                    data.siteId(),
                    data.fileId(),
                    "Raw drawing text:\n" + part,
                    Map.of("kind", "RAW_TEXT", "fileId", data.fileId(), "fileType", data.fileType().name())
                ));
            }
        }

        return chunks;
    }

    private String elementChunkText(ExtractedDrawingData data, DrawingElement element) {
        StringBuilder builder = new StringBuilder();
        builder.append("Site: ").append(data.siteId()).append('\n');
        builder.append("File: ").append(data.fileId()).append('\n');
        append(builder, "Layer", element.layer());
        append(builder, "Element type", element.type());
        append(builder, "Label", element.label());
        append(builder, "Dimensions", element.dimensions());
        append(builder, "Material", element.material());
        append(builder, "Coordinates", element.coordinates());
        append(builder, "Source text", element.sourceText());
        return builder.toString().trim();
    }

    private Map<String, Object> metadata(ExtractedDrawingData data, DrawingElement element) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("kind", "ELEMENT");
        metadata.put("siteId", data.siteId());
        metadata.put("fileId", data.fileId());
        metadata.put("fileType", data.fileType().name());
        putIfPresent(metadata, "layer", element.layer());
        putIfPresent(metadata, "type", element.type());
        putIfPresent(metadata, "label", element.label());
        putIfPresent(metadata, "dimensions", element.dimensions());
        putIfPresent(metadata, "material", element.material());
        return metadata;
    }

    private List<String> splitText(String value, int targetChars, int overlapChars) {
        String normalized = value.replaceAll("\\s+", " ").trim();
        List<String> parts = new ArrayList<>();
        int start = 0;
        while (start < normalized.length()) {
            int end = Math.min(normalized.length(), start + targetChars);
            int softEnd = normalized.lastIndexOf('.', end);
            if (softEnd > start + targetChars / 2) {
                end = softEnd + 1;
            }
            parts.add(normalized.substring(start, end).trim());
            if (end >= normalized.length()) {
                break;
            }
            start = Math.max(end - overlapChars, start + 1);
        }
        return parts;
    }

    private void append(StringBuilder builder, String label, String value) {
        if (StringUtils.hasText(value)) {
            builder.append(label).append(": ").append(value).append('\n');
        }
    }

    private void putIfPresent(Map<String, Object> metadata, String key, String value) {
        if (StringUtils.hasText(value)) {
            metadata.put(key, value);
        }
    }
}
