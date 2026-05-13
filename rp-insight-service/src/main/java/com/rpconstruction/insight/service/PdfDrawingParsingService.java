package com.rpconstruction.insight.service;

import com.rpconstruction.insight.config.RpInsightProperties;
import com.rpconstruction.insight.domain.DrawingElement;
import com.rpconstruction.insight.domain.ExtractedDrawingData;
import com.rpconstruction.insight.domain.InsightFileRecord;
import net.sourceforge.tess4j.Tesseract;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.awt.image.BufferedImage;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Service
public class PdfDrawingParsingService {

    private final DrawingTextInterpreter textInterpreter;
    private final RpInsightProperties properties;

    public PdfDrawingParsingService(DrawingTextInterpreter textInterpreter, RpInsightProperties properties) {
        this.textInterpreter = textInterpreter;
        this.properties = properties;
    }

    public ExtractedDrawingData parse(InsightFileRecord file, Path localFile) {
        List<DrawingElement> elements = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        String text;
        try (PDDocument document = Loader.loadPDF(localFile.toFile())) {
            text = new PDFTextStripper().getText(document);
            if (!StringUtils.hasText(text) && properties.getOcr().isEnabled()) {
                text = runOcr(document);
                warnings.add("PDF text layer was empty; OCR fallback was used.");
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to parse PDF drawing", ex);
        }

        String normalized = text == null ? "" : text.replaceAll("\\r", "").trim();
        for (String line : normalized.split("\\n")) {
            if (elements.size() >= properties.getIngestion().getMaxExtractedElements()) {
                warnings.add("PDF extraction was capped at " + properties.getIngestion().getMaxExtractedElements() + " lines.");
                break;
            }
            String safe = line.replaceAll("\\s+", " ").trim();
            if (StringUtils.hasText(safe)) {
                elements.add(textInterpreter.toElement("PDF_TEXT", safe, "PDF", null));
            }
        }

        if (!StringUtils.hasText(normalized)) {
            warnings.add("No readable text was extracted from the PDF drawing.");
        }

        return new ExtractedDrawingData(
            file.siteId(),
            file.id(),
            file.fileType(),
            List.of("PDF"),
            List.copyOf(elements),
            normalized,
            warnings
        );
    }

    private String runOcr(PDDocument document) throws Exception {
        Tesseract tesseract = new Tesseract();
        if (StringUtils.hasText(properties.getOcr().getDataPath())) {
            tesseract.setDatapath(properties.getOcr().getDataPath());
        }
        tesseract.setLanguage(properties.getOcr().getLanguage());

        PDFRenderer renderer = new PDFRenderer(document);
        StringBuilder text = new StringBuilder();
        for (int page = 0; page < document.getNumberOfPages(); page++) {
            BufferedImage image = renderer.renderImageWithDPI(page, properties.getOcr().getDpi(), ImageType.RGB);
            text.append(tesseract.doOCR(image)).append('\n');
        }
        return text.toString();
    }
}
