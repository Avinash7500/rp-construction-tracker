package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.DrawingFileType;
import com.rpconstruction.insight.domain.InsightFileRecord;
import com.rpconstruction.insight.domain.InsightFileStatus;
import com.rpconstruction.insight.domain.StoredFile;
import com.rpconstruction.insight.dto.UploadResponse;
import com.rpconstruction.insight.repository.InsightFileRepository;
import com.rpconstruction.insight.storage.ObjectStorageService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class RpInsightUploadService {

    private final ObjectStorageService storageService;
    private final InsightFileRepository fileRepository;
    private final ParsingPipelineService parsingPipelineService;
    private final com.rpconstruction.insight.config.RpInsightProperties properties;

    public RpInsightUploadService(
        ObjectStorageService storageService,
        InsightFileRepository fileRepository,
        ParsingPipelineService parsingPipelineService,
        com.rpconstruction.insight.config.RpInsightProperties properties
    ) {
        this.storageService = storageService;
        this.fileRepository = fileRepository;
        this.parsingPipelineService = parsingPipelineService;
        this.properties = properties;
    }

    public UploadResponse upload(String siteId, MultipartFile file) throws IOException {
        if (!StringUtils.hasText(siteId)) {
            throw new IllegalArgumentException("siteId is required");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Drawing file is required");
        }

        String originalFilename = file.getOriginalFilename() == null ? "drawing" : file.getOriginalFilename();
        DrawingFileType fileType = DrawingFileType.fromFilename(originalFilename);
        if (!fileType.isSupportedForPhaseOne()) {
            throw new IllegalArgumentException("Only DWG, DXF and PDF files are supported in RP Insight phase 1");
        }

        String fileId = UUID.randomUUID().toString();
        StoredFile storedFile = storageService.store(siteId, fileId, file);
        OffsetDateTime now = OffsetDateTime.now();
        InsightFileRecord record = new InsightFileRecord(
            fileId,
            siteId,
            originalFilename,
            file.getContentType(),
            fileType,
            storedFile.storageKey(),
            storedFile.storageUri(),
            InsightFileStatus.UPLOADED,
            null,
            0,
            now,
            now
        );
        fileRepository.insert(record);

        InsightFileStatus responseStatus = InsightFileStatus.PROCESSING;
        if (properties.getIngestion().isAsync()) {
            parsingPipelineService.processAsync(fileId);
        } else {
            parsingPipelineService.process(fileId);
            responseStatus = fileRepository.findById(fileId)
                .map(InsightFileRecord::status)
                .orElse(InsightFileStatus.FAILED);
        }

        return new UploadResponse(
            fileId,
            siteId,
            responseStatus.name(),
            storedFile.storageUri(),
            "Upload accepted. RP Insight parsing and vector indexing has started."
        );
    }
}
