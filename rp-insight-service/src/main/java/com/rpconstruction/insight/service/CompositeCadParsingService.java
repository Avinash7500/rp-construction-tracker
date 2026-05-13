package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.DrawingFileType;
import com.rpconstruction.insight.domain.ExtractedDrawingData;
import com.rpconstruction.insight.domain.InsightFileRecord;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.ArrayList;

@Service
public class CompositeCadParsingService implements CadParsingService {

    private final AsposeCadParsingService asposeCadParsingService;
    private final KabejaDxfFallbackParsingService kabejaDxfFallbackParsingService;

    public CompositeCadParsingService(
        AsposeCadParsingService asposeCadParsingService,
        KabejaDxfFallbackParsingService kabejaDxfFallbackParsingService
    ) {
        this.asposeCadParsingService = asposeCadParsingService;
        this.kabejaDxfFallbackParsingService = kabejaDxfFallbackParsingService;
    }

    @Override
    public ExtractedDrawingData parse(InsightFileRecord file, Path localFile) {
        try {
            return asposeCadParsingService.parse(file, localFile);
        } catch (Exception ex) {
            if (file.fileType() != DrawingFileType.DXF) {
                throw ex;
            }
            ExtractedDrawingData fallback = kabejaDxfFallbackParsingService.parse(file, localFile);
            ArrayList<String> warnings = new ArrayList<>(fallback.warnings());
            warnings.add("Aspose.CAD failed, Kabeja DXF fallback used: " + ex.getMessage());
            return new ExtractedDrawingData(
                fallback.siteId(),
                fallback.fileId(),
                fallback.fileType(),
                fallback.layers(),
                fallback.elements(),
                fallback.rawText(),
                warnings
            );
        }
    }
}
