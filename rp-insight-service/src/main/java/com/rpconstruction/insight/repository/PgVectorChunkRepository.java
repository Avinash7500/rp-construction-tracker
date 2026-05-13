package com.rpconstruction.insight.repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rpconstruction.insight.domain.DrawingChunk;
import com.rpconstruction.insight.domain.RetrievedChunk;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
public class PgVectorChunkRepository {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public PgVectorChunkRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public void deleteByFileId(String fileId) {
        jdbcTemplate.update("DELETE FROM rp_insight_chunks WHERE file_id = ?", fileId);
    }

    public void saveAll(List<EmbeddedChunk> chunks) {
        jdbcTemplate.batchUpdate(
            """
                INSERT INTO rp_insight_chunks (
                    id, site_id, file_id, chunk_text, metadata, embedding
                )
                VALUES (?, ?, ?, ?, ?::jsonb, ?::vector)
                """,
            new BatchPreparedStatementSetter() {
                @Override
                public void setValues(PreparedStatement ps, int i) throws SQLException {
                    EmbeddedChunk row = chunks.get(i);
                    DrawingChunk chunk = row.chunk();
                    ps.setObject(1, chunk.id());
                    ps.setString(2, chunk.siteId());
                    ps.setString(3, chunk.fileId());
                    ps.setString(4, chunk.chunkText());
                    ps.setString(5, toJson(chunk.metadata()));
                    ps.setString(6, vectorLiteral(row.embedding()));
                }

                @Override
                public int getBatchSize() {
                    return chunks.size();
                }
            }
        );
    }

    public List<RetrievedChunk> search(String siteId, float[] queryEmbedding, int topK) {
        String vector = vectorLiteral(queryEmbedding);
        return jdbcTemplate.query(
            """
                SELECT id, site_id, file_id, chunk_text, metadata,
                       1 - (embedding <=> ?::vector) AS similarity
                  FROM rp_insight_chunks
                 WHERE site_id = ?
                 ORDER BY embedding <=> ?::vector
                 LIMIT ?
                """,
            (rs, rowNum) -> mapRetrievedChunk(rs),
            vector,
            siteId,
            vector,
            topK
        );
    }

    private RetrievedChunk mapRetrievedChunk(ResultSet rs) throws SQLException {
        return new RetrievedChunk(
            rs.getObject("id", UUID.class),
            rs.getString("site_id"),
            rs.getString("file_id"),
            rs.getString("chunk_text"),
            rs.getDouble("similarity"),
            fromJson(rs.getString("metadata"))
        );
    }

    private String vectorLiteral(float[] vector) {
        return Arrays.stream(toDoubleArray(vector))
            .mapToObj(Double::toString)
            .collect(Collectors.joining(",", "[", "]"));
    }

    private double[] toDoubleArray(float[] vector) {
        double[] result = new double[vector.length];
        for (int i = 0; i < vector.length; i++) {
            result[i] = vector[i];
        }
        return result;
    }

    private String toJson(Map<String, Object> metadata) throws SQLException {
        try {
            return objectMapper.writeValueAsString(metadata == null ? Map.of() : metadata);
        } catch (Exception ex) {
            throw new SQLException("Unable to serialize chunk metadata", ex);
        }
    }

    private Map<String, Object> fromJson(String json) throws SQLException {
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception ex) {
            throw new SQLException("Unable to read chunk metadata", ex);
        }
    }

    public record EmbeddedChunk(DrawingChunk chunk, float[] embedding) {
    }
}
