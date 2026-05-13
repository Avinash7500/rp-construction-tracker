package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.DrawingFileType;
import com.rpconstruction.insight.domain.ExtractedDrawingData;
import com.rpconstruction.insight.domain.InsightFileRecord;
import org.springframework.stereotype.Service;

import java.nio.file.Path;

@Service
public class DrawingParserRouter {

    private final CadParsingService cadParsingService;
    private final PdfDrawingParsingService pdfDrawingParsingService;

    public DrawingParserRouter(CadParsingService cadParsingService, PdfDrawingParsingService pdfDrawingParsingService) {
        this.cadParsingService = cadParsingService;
        this.pdfDrawingParsingService = pdfDrawingParsingService;
    }

    public ExtractedDrawingData parse(InsightFileRecord file, Path localFile) {
        if (file.fileType() == DrawingFileType.PDF) {
            return pdfDrawingParsingService.parse(file, localFile);
        }
        if (file.fileType() == DrawingFileType.DWG || file.fileType() == DrawingFileType.DXF) {
            return cadParsingService.parse(file, localFile);
        }
        throw new IllegalArgumentException("Unsupported drawing file type: " + file.fileType());
    }
}
