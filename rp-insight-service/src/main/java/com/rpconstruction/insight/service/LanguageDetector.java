package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.QuestionLanguage;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class LanguageDetector {

    private static final Pattern DEVANAGARI = Pattern.compile("[\\u0900-\\u097F]");
    private static final Pattern MARATHI_MARKERS = Pattern.compile(
        "(आहे|किती|मध्ये|साठी|ची|चा|चे|लागेल|कॉलमची|ड्रॉइंग|साइटवर)"
    );
    private static final Pattern HINDI_MARKERS = Pattern.compile(
        "(है|क्या|कितना|कितनी|में|का|की|के|चाहिए|साइट पर|ड्राइंग)"
    );

    public QuestionLanguage detect(String question) {
        String value = question == null ? "" : question;
        if (!DEVANAGARI.matcher(value).find()) {
            return QuestionLanguage.ENGLISH;
        }
        if (MARATHI_MARKERS.matcher(value).find()) {
            return QuestionLanguage.MARATHI;
        }
        if (HINDI_MARKERS.matcher(value).find()) {
            return QuestionLanguage.HINDI;
        }
        return QuestionLanguage.HINDI;
    }
}
