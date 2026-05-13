package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.QuestionLanguage;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LanguageDetectorTest {

    private final LanguageDetector detector = new LanguageDetector();

    @Test
    void detectsMarathi() {
        assertThat(detector.detect("कॉलमची जाडी किती आहे?")).isEqualTo(QuestionLanguage.MARATHI);
    }

    @Test
    void detectsHindi() {
        assertThat(detector.detect("कॉलम की मोटाई कितनी है?")).isEqualTo(QuestionLanguage.HINDI);
    }

    @Test
    void detectsEnglish() {
        assertThat(detector.detect("What is the column size?")).isEqualTo(QuestionLanguage.ENGLISH);
    }
}
