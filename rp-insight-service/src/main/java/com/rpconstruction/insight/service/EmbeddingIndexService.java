package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.DrawingChunk;
import com.rpconstruction.insight.repository.PgVectorChunkRepository;
import dev.langchain4j.model.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class EmbeddingIndexService {

    private final EmbeddingModel documentEmbeddingModel;
    private final PgVectorChunkRepository chunkRepository;

    public EmbeddingIndexService(
        @Qualifier("documentEmbeddingModel") EmbeddingModel documentEmbeddingModel,
        PgVectorChunkRepository chunkRepository
    ) {
        this.documentEmbeddingModel = documentEmbeddingModel;
        this.chunkRepository = chunkRepository;
    }

    public void index(String fileId, List<DrawingChunk> chunks) {
        chunkRepository.deleteByFileId(fileId);
        if (chunks.isEmpty()) {
            return;
        }
        List<PgVectorChunkRepository.EmbeddedChunk> rows = new ArrayList<>(chunks.size());
        for (DrawingChunk chunk : chunks) {
            float[] embedding = documentEmbeddingModel.embed(chunk.chunkText()).content().vector();
            rows.add(new PgVectorChunkRepository.EmbeddedChunk(chunk, embedding));
        }
        chunkRepository.saveAll(rows);
    }
}
