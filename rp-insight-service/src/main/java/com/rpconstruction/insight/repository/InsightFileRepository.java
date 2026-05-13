package com.rpconstruction.insight.repository;

import com.rpconstruction.insight.domain.DrawingFileType;
import com.rpconstruction.insight.domain.InsightFileRecord;
import com.rpconstruction.insight.domain.InsightFileStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;

@Repository
public class InsightFileRepository {

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<InsightFileRecord> rowMapper = this::mapRow;

    public InsightFileRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void insert(InsightFileRecord record) {
        jdbcTemplate.update(
            """
                INSERT INTO rp_insight_files (
                    id, site_id, original_filename, content_type, file_type,
                    storage_key, storage_uri, status, error_message, chunk_count
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
            record.id(),
            record.siteId(),
            record.originalFilename(),
            record.contentType(),
            record.fileType().name(),
            record.storageKey(),
            record.storageUri(),
            record.status().name(),
            record.errorMessage(),
            record.chunkCount()
        );
    }

    public Optional<InsightFileRecord> findById(String fileId) {
        return jdbcTemplate.query(
            "SELECT * FROM rp_insight_files WHERE id = ?",
            rowMapper,
            fileId
        ).stream().findFirst();
    }

    public void updateStatus(String fileId, InsightFileStatus status, String errorMessage, Integer chunkCount) {
        jdbcTemplate.update(
            """
                UPDATE rp_insight_files
                   SET status = ?,
                       error_message = ?,
                       chunk_count = COALESCE(?, chunk_count),
                       updated_at = now()
                 WHERE id = ?
                """,
            status.name(),
            errorMessage,
            chunkCount,
            fileId
        );
    }

    private InsightFileRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new InsightFileRecord(
            rs.getString("id"),
            rs.getString("site_id"),
            rs.getString("original_filename"),
            rs.getString("content_type"),
            DrawingFileType.valueOf(rs.getString("file_type")),
            rs.getString("storage_key"),
            rs.getString("storage_uri"),
            InsightFileStatus.valueOf(rs.getString("status")),
            rs.getString("error_message"),
            rs.getInt("chunk_count"),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}
