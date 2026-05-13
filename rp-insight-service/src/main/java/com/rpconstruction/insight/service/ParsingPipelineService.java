package com.rpconstruction.insight.service;

import com.rpconstruction.insight.config.RpInsightProperties;
import com.rpconstruction.insight.domain.DrawingChunk;
import com.rpconstruction.insight.domain.ExtractedDrawingData;
import com.rpconstruction.insight.domain.InsightFileRecord;
import com.rpconstruction.insight.domain.InsightFileStatus;
import com.rpconstruction.insight.repository.InsightFileRepository;
import com.rpconstruction.insight.storage.ObjectStorageService;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class ParsingPipelineService {

    private final InsightFileRepository fileRepository;
    private final ObjectStorageService storageService;
    private final DrawingParserRouter parserRouter;
    private final DrawingChunkingService chunkingService;
    private final EmbeddingIndexService embeddingIndexService;
    private final RpInsightProperties properties;

    public ParsingPipelineService(
        InsightFileRepository fileRepository,
        ObjectStorageService storageService,
        DrawingParserRouter parserRouter,
        DrawingChunkingService chunkingService,
        EmbeddingIndexService embeddingIndexService,
        RpInsightProperties properties
    ) {
        this.fileRepository = fileRepository;
        this.storageService = storageService;
        this.parserRouter = parserRouter;
        this.chunkingService = chunkingService;
        this.embeddingIndexService = embeddingIndexService;
        this.properties = properties;
    }

    @Async("rpInsightExecutor")
    public CompletableFuture<Void> processAsync(String fileId) {
        process(fileId);
        return CompletableFuture.completedFuture(null);
    }

    public void process(String fileId) {
        InsightFileRecord file = fileRepository.findById(fileId)
            .orElseThrow(() -> new IllegalArgumentException("Unknown RP Insight fileId: " + fileId));

        fileRepository.updateStatus(fileId, InsightFileStatus.PROCESSING, null, null);
        Path tempFile = null;
        try {
            tempFile = Files.createTempFile("rp-insight-", "." + file.fileType().name().toLowerCase());
            try (InputStream input = storageService.open(file.storageKey());
                 OutputStream output = Files.newOutputStream(tempFile)) {
                input.transferTo(output);
            }

            ExtractedDrawingData extracted = parserRouter.parse(file, tempFile);
            List<DrawingChunk> chunks = chunkingService.chunk(
                extracted,
                properties.getIngestion().getChunkTargetChars(),
                properties.getIngestion().getChunkOverlapChars()
            );
            embeddingIndexService.index(fileId, chunks);
            fileRepository.updateStatus(fileId, InsightFileStatus.INDEXED, null, chunks.size());
        } catch (Exception ex) {
            fileRepository.updateStatus(fileId, InsightFileStatus.FAILED, ex.getMessage(), null);
        } finally {
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (Exception ignored) {
                    // Temp cleanup failure should not hide ingestion status.
                }
            }
        }
    }
}
