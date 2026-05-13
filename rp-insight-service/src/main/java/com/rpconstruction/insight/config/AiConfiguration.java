package com.rpconstruction.insight.config;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.googleai.GoogleAiEmbeddingModel;
import dev.langchain4j.model.googleai.GoogleAiGeminiChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
public class AiConfiguration {

    @Bean
    public ChatModel chatModel(RpInsightProperties properties) {
        RpInsightProperties.Ai ai = properties.getAi();
        if ("openai".equalsIgnoreCase(ai.getProvider())) {
            return OpenAiChatModel.builder()
                .apiKey(required(ai.getOpenAiApiKey(), "OPENAI_API_KEY"))
                .modelName(ai.getOpenAiModel())
                .temperature(ai.getTemperature())
                .build();
        }

        return GoogleAiGeminiChatModel.builder()
            .apiKey(required(ai.getGeminiApiKey(), "GEMINI_AI_KEY"))
            .modelName(ai.getGeminiModel())
            .temperature(ai.getTemperature())
            .build();
    }

    @Bean
    @Qualifier("documentEmbeddingModel")
    public EmbeddingModel documentEmbeddingModel(RpInsightProperties properties) {
        return geminiEmbeddingModel(properties, GoogleAiEmbeddingModel.TaskType.RETRIEVAL_DOCUMENT);
    }

    @Bean
    @Qualifier("queryEmbeddingModel")
    public EmbeddingModel queryEmbeddingModel(RpInsightProperties properties) {
        return geminiEmbeddingModel(properties, GoogleAiEmbeddingModel.TaskType.RETRIEVAL_QUERY);
    }

    private EmbeddingModel geminiEmbeddingModel(
        RpInsightProperties properties,
        GoogleAiEmbeddingModel.TaskType taskType
    ) {
        RpInsightProperties.Ai ai = properties.getAi();
        return GoogleAiEmbeddingModel.builder()
            .apiKey(required(ai.getGeminiApiKey(), "GEMINI_AI_KEY"))
            .modelName(ai.getEmbeddingModel())
            .taskType(taskType)
            .outputDimensionality(ai.getEmbeddingDimensions())
            .build();
    }

    private String required(String value, String name) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException(name + " must be configured for RP Insight AI");
        }
        return value;
    }
}
