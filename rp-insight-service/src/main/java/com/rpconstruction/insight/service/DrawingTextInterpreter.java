package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.DrawingElement;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class DrawingTextInterpreter {

    private static final Pattern LABEL_PATTERN = Pattern.compile("\\b([A-Z]{1,4}\\s*-?\\s*\\d+[A-Z]?)\\b");
    private static final Pattern DIMENSION_PATTERN = Pattern.compile(
        "\\b\\d+(?:\\.\\d+)?\\s*(?:x|X|\\u00D7)\\s*\\d+(?:\\.\\d+)?\\s*(?:mm|cm|m)?\\b|\\b\\d+(?:\\.\\d+)?\\s*(?:mm|cm|m)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern MATERIAL_PATTERN = Pattern.compile(
        "\\b(?:M\\s?\\d{2}|Fe\\s?\\d{3}|RCC|PCC|Concrete|Cement|Steel)\\b|कंक्रीट|काँक्रीट|सिमेंट|स्टील",
        Pattern.CASE_INSENSITIVE
    );

    public DrawingElement toElement(String fallbackType, String text, String layer, String coordinates) {
        String normalized = text == null ? "" : text.replaceAll("\\s+", " ").trim();
        String type = inferType(fallbackType, normalized, layer);
        return new DrawingElement(
            type,
            firstMatch(LABEL_PATTERN, normalized),
            firstMatch(DIMENSION_PATTERN, normalized),
            firstMatch(MATERIAL_PATTERN, normalized),
            layer,
            coordinates,
            normalized
        );
    }

    private String inferType(String fallbackType, String text, String layer) {
        String haystack = ((text == null ? "" : text) + " " + (layer == null ? "" : layer)).toLowerCase(Locale.ROOT);
        if (haystack.contains("column") || haystack.contains("col") || haystack.contains("कॉलम")) {
            return "COLUMN";
        }
        if (haystack.contains("beam") || haystack.contains("बीम")) {
            return "BEAM";
        }
        if (haystack.contains("slab") || haystack.contains("स्लॅब") || haystack.contains("स्लैब")) {
            return "SLAB";
        }
        if (haystack.contains("footing") || haystack.contains("foundation") || haystack.contains("फुटिंग")) {
            return "FOOTING";
        }
        if (haystack.contains("wall") || haystack.contains("भिंत") || haystack.contains("दीवार")) {
            return "WALL";
        }
        if (haystack.contains("electrical") || haystack.contains("electric") || haystack.contains("इलेक्ट्र")) {
            return "ELECTRICAL";
        }
        if (haystack.contains("plumbing") || haystack.contains("pipe") || haystack.contains("पाईप")) {
            return "PLUMBING";
        }
        return StringUtils.hasText(fallbackType) ? fallbackType.toUpperCase(Locale.ROOT) : "DRAWING_TEXT";
    }

    private String firstMatch(Pattern pattern, String value) {
        Matcher matcher = pattern.matcher(value == null ? "" : value);
        return matcher.find() ? matcher.group().trim() : null;
    }
}
