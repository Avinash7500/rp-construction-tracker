package com.rpconstruction.insight.domain;

public enum QuestionLanguage {
    ENGLISH("English"),
    HINDI("Hindi"),
    MARATHI("Marathi");

    private final String displayName;

    QuestionLanguage(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }

    public String missingDataMessage() {
        return switch (this) {
            case MARATHI -> "Drawing मध्ये ही माहिती स्पष्ट नाही. कृपया साइटवर तपासा.";
            case HINDI -> "Drawing में यह जानकारी स्पष्ट नहीं है. कृपया साइट पर सत्यापित करें.";
            case ENGLISH -> "Not available in drawing. Please verify with the physical drawing before execution.";
        };
    }

    public String safetyNote() {
        return switch (this) {
            case MARATHI -> "कृपया execution आधी physical drawing आणि साइटवर verify करा.";
            case HINDI -> "कृपया execution से पहले physical drawing और साइट पर verify करें.";
            case ENGLISH -> "Please verify with the physical drawing before execution.";
        };
    }
}
