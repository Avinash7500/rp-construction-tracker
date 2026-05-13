package com.rpconstruction.insight.controller;

import com.rpconstruction.insight.domain.InsightFileRecord;
import com.rpconstruction.insight.dto.AskRequest;
import com.rpconstruction.insight.dto.AskResponse;
import com.rpconstruction.insight.dto.FileStatusResponse;
import com.rpconstruction.insight.dto.UploadResponse;
import com.rpconstruction.insight.repository.InsightFileRepository;
import com.rpconstruction.insight.service.RpInsightQuestionService;
import com.rpconstruction.insight.service.RpInsightUploadService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Validated
@RestController
@RequestMapping("/api/rp-insight")
public class RpInsightController {

    private final RpInsightUploadService uploadService;
    private final RpInsightQuestionService questionService;
    private final InsightFileRepository fileRepository;

    public RpInsightController(
        RpInsightUploadService uploadService,
        RpInsightQuestionService questionService,
        InsightFileRepository fileRepository
    ) {
        this.uploadService = uploadService;
        this.questionService = questionService;
        this.fileRepository = fileRepository;
    }

    @PostMapping(
        value = "/upload",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8"
    )
    public ResponseEntity<UploadResponse> upload(
        @RequestParam("siteId") String siteId,
        @RequestPart("file") MultipartFile file
    ) throws IOException {
        return ResponseEntity.accepted().body(uploadService.upload(siteId, file));
    }

    @PostMapping(
        value = "/ask",
        consumes = MediaType.APPLICATION_JSON_VALUE,
        produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8"
    )
    public AskResponse ask(@Valid @org.springframework.web.bind.annotation.RequestBody AskRequest request) {
        return questionService.answer(request);
    }

    @GetMapping(value = "/files/{fileId}", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
    public FileStatusResponse fileStatus(@PathVariable String fileId) {
        InsightFileRecord file = fileRepository.findById(fileId)
            .orElseThrow(() -> new IllegalArgumentException("Unknown RP Insight fileId: " + fileId));
        return new FileStatusResponse(
            file.id(),
            file.siteId(),
            file.originalFilename(),
            file.fileType().name(),
            file.status().name(),
            file.chunkCount(),
            file.errorMessage()
        );
    }
}
