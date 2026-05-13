package com.rpconstruction.insight.service;

import com.aspose.cad.License;
import com.aspose.cad.fileformats.cad.CadImage;
import com.aspose.cad.fileformats.cad.cadobjects.CadDimensionBase;
import com.aspose.cad.fileformats.cad.cadobjects.CadEntityBase;
import com.aspose.cad.fileformats.cad.cadobjects.CadMText;
import com.aspose.cad.fileformats.cad.cadobjects.CadText;
import com.aspose.cad.fileformats.cad.cadobjects.CadBlockEntity;
import com.rpconstruction.insight.config.RpInsightProperties;
import com.rpconstruction.insight.domain.DrawingElement;
import com.rpconstruction.insight.domain.ExtractedDrawingData;
import com.rpconstruction.insight.domain.InsightFileRecord;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class AsposeCadParsingService {

    private final DrawingTextInterpreter textInterpreter;
    private final RpInsightProperties properties;

    public AsposeCadParsingService(DrawingTextInterpreter textInterpreter, RpInsightProperties properties) {
        this.textInterpreter = textInterpreter;
        this.properties = properties;
    }

    @PostConstruct
    void configureLicense() {
        String licensePath = properties.getParsing().getAsposeLicensePath();
        if (!StringUtils.hasText(licensePath) || !Files.exists(Path.of(licensePath))) {
            return;
        }
        License license = new License();
        license.setLicense(licensePath);
    }

    public ExtractedDrawingData parse(InsightFileRecord file, Path localFile) {
        Set<String> layers = new LinkedHashSet<>();
        List<DrawingElement> elements = new ArrayList<>();
        List<String> rawText = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        try (CadImage cadImage = (CadImage) CadImage.load(localFile.toString())) {
            for (CadEntityBase entity : cadImage.getEntities()) {
                collectEntity(entity, layers, elements, rawText);
            }
            for (CadBlockEntity blockEntity : cadImage.getBlockEntities().getValues()) {
                for (CadEntityBase entity : blockEntity.getEntities()) {
                    collectEntity(entity, layers, elements, rawText);
                }
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to parse CAD drawing with Aspose.CAD", ex);
        }

        if (elements.isEmpty() && rawText.isEmpty()) {
            warnings.add("No readable CAD text, dimensions or element labels were extracted.");
        }
        if (elements.size() >= properties.getIngestion().getMaxExtractedElements()) {
            warnings.add("CAD extraction was capped at " + properties.getIngestion().getMaxExtractedElements() + " elements.");
        }

        return new ExtractedDrawingData(
            file.siteId(),
            file.id(),
            file.fileType(),
            List.copyOf(layers),
            List.copyOf(elements),
            String.join("\n", rawText),
            warnings
        );
    }

    private void collectEntity(
        CadEntityBase entity,
        Set<String> layers,
        List<DrawingElement> elements,
        List<String> rawText
    ) {
        if (entity == null) {
            return;
        }
        String layer = safe(entity.getLayerName());
        if (StringUtils.hasText(layer)) {
            layers.add(layer);
        }
        if (elements.size() >= properties.getIngestion().getMaxExtractedElements()) {
            return;
        }

        String text = extractText(entity);
        String type = entity.getClass().getSimpleName().replace("Cad", "").toUpperCase();
        String coordinates = extractCoordinates(entity);

        if (StringUtils.hasText(text)) {
            rawText.add(text);
            elements.add(textInterpreter.toElement(type, text, layer, coordinates));
        } else if (entity instanceof CadDimensionBase dimension) {
            String measurement = String.valueOf(dimension.getActualMeasurement());
            rawText.add(type + " measurement " + measurement);
            elements.add(new DrawingElement(type, null, measurement, null, layer, coordinates, type));
        }
    }

    private String extractText(CadEntityBase entity) {
        if (entity instanceof CadText text) {
            return safe(text.getDefaultValue());
        }
        if (entity instanceof CadMText mText) {
            return firstText(mText.getFullClearText(), mText.getFullText(), mText.getText());
        }
        if (entity instanceof CadDimensionBase dimension) {
            return firstText(dimension.getText(), String.valueOf(dimension.getActualMeasurement()));
        }
        return null;
    }

    private String extractCoordinates(CadEntityBase entity) {
        Object point = null;
        if (entity instanceof CadText text) {
            point = text.getFirstAlignment();
        } else if (entity instanceof CadMText mText) {
            point = mText.getInsertionPoint();
        } else if (entity instanceof CadDimensionBase dimension) {
            point = dimension.getDefinitionPoint();
        }
        return pointToString(point);
    }

    private String pointToString(Object point) {
        if (point == null) {
            return null;
        }
        try {
            Object x = point.getClass().getMethod("getX").invoke(point);
            Object y = point.getClass().getMethod("getY").invoke(point);
            Object z = point.getClass().getMethod("getZ").invoke(point);
            return "x=" + x + ", y=" + y + ", z=" + z;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String firstText(String... values) {
        for (String value : values) {
            String safe = safe(value);
            if (StringUtils.hasText(safe)) {
                return safe;
            }
        }
        return null;
    }

    private String safe(String value) {
        return value == null ? null : value.replaceAll("\\s+", " ").trim();
    }
}
