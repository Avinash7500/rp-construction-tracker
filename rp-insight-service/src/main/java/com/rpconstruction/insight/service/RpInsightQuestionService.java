package com.rpconstruction.insight.service;

import com.rpconstruction.insight.config.RpInsightProperties;
import com.rpconstruction.insight.domain.QuestionLanguage;
import com.rpconstruction.insight.domain.RetrievedChunk;
import com.rpconstruction.insight.dto.AskRequest;
import com.rpconstruction.insight.dto.AskResponse;
import com.rpconstruction.insight.dto.SourceChunkDto;
import com.rpconstruction.insight.repository.PgVectorChunkRepository;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RpInsightQuestionService {

    private final EmbeddingModel queryEmbeddingModel;
    private final ChatModel chatModel;
    private final PgVectorChunkRepository chunkRepository;
    private final LanguageDetector languageDetector;
    private final RpInsightProperties properties;

    public RpInsightQuestionService(
        @Qualifier("queryEmbeddingModel") EmbeddingModel queryEmbeddingModel,
        ChatModel chatModel,
        PgVectorChunkRepository chunkRepository,
        LanguageDetector languageDetector,
        RpInsightProperties properties
    ) {
        this.queryEmbeddingModel = queryEmbeddingModel;
        this.chatModel = chatModel;
        this.chunkRepository = chunkRepository;
        this.languageDetector = languageDetector;
        this.properties = properties;
    }

    public AskResponse answer(AskRequest request) {
        QuestionLanguage language = languageDetector.detect(request.getQuestion());
        int requestedTopK = request.getTopK() == null ? properties.getRetrieval().getTopK() : request.getTopK();
        int topK = Math.max(1, Math.min(10, requestedTopK));
        float[] questionEmbedding = queryEmbeddingModel.embed(request.getQuestion()).content().vector();
        List<RetrievedChunk> chunks = chunkRepository.search(request.getSiteId(), questionEmbedding, topK);

        if (chunks.isEmpty() || chunks.getFirst().similarity() < properties.getRetrieval().getMinSimilarity()) {
            return new AskResponse(language.missingDataMessage(), language.displayName(), 0.15, List.of());
        }

        String prompt = buildPrompt(language, request.getQuestion(), chunks);
        String answer = chatModel.chat(prompt);
        double confidence = confidence(chunks, answer);
        if (confidence < 0.55 && !answer.contains(language.safetyNote())) {
            answer = answer.strip() + "\n\n" + language.safetyNote();
        }

        return new AskResponse(
            answer.strip(),
            language.displayName(),
            confidence,
            chunks.stream()
                .map(chunk -> new SourceChunkDto(
                    chunk.id(),
                    chunk.fileId(),
                    round(chunk.similarity()),
                    chunk.chunkText(),
                    chunk.metadata()
                ))
                .toList()
        );
    }

    private String buildPrompt(QuestionLanguage language, String question, List<RetrievedChunk> chunks) {
        StringBuilder context = new StringBuilder();
        for (int i = 0; i < chunks.size(); i++) {
            RetrievedChunk chunk = chunks.get(i);
            context.append("[SOURCE ").append(i + 1)
                .append(" | fileId=").append(chunk.fileId())
                .append(" | similarity=").append(round(chunk.similarity()))
                .append("]\n")
                .append(chunk.chunkText())
                .append("\n\n");
        }

        return """
            You are a senior civil site engineer.

            You are given extracted CAD/PDF drawing data. This is a RAG answer: the context below is the only allowed source.

            Rules:
            - Answer ONLY from the given context.
            - DO NOT guess.
            - If data is missing, answer exactly with the user's language equivalent of "Not available in drawing".
            - Mention uncertainty when the context is partial or ambiguous.
            - Keep technical units exactly as shown in the context.
            - Do not claim that an item exists unless it appears in the context.

            Language rule:
            - The user language is %s. Answer in %s only.

            Context:
            %s

            User question:
            %s

            Final answer:
            """.formatted(language.displayName(), language.displayName(), context, question);
    }

    private double confidence(List<RetrievedChunk> chunks, String answer) {
        double top = chunks.getFirst().similarity();
        double average = chunks.stream().mapToDouble(RetrievedChunk::similarity).average().orElse(top);
        double confidence = (top * 0.7) + (average * 0.3);
        String normalized = answer == null ? "" : answer.toLowerCase();
        if (normalized.contains("not available") || normalized.contains("स्पष्ट नाही") || normalized.contains("उपलब्ध") || normalized.contains("स्पष्ट नहीं")) {
            confidence = Math.min(confidence, 0.35);
        }
        return round(Math.max(0.0, Math.min(0.98, confidence)));
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
