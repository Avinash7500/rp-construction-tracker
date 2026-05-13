package com.rpconstruction.insight.service;

import com.rpconstruction.insight.config.RpInsightProperties;
import com.rpconstruction.insight.domain.DrawingElement;
import com.rpconstruction.insight.domain.ExtractedDrawingData;
import com.rpconstruction.insight.domain.InsightFileRecord;
import org.kabeja.dxf.DXFDimension;
import org.kabeja.dxf.DXFEntity;
import org.kabeja.dxf.DXFLayer;
import org.kabeja.dxf.DXFMText;
import org.kabeja.dxf.DXFText;
import org.kabeja.parser.Parser;
import org.kabeja.parser.ParserBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.FileInputStream;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class KabejaDxfFallbackParsingService {

    private final DrawingTextInterpreter textInterpreter;
    private final RpInsightProperties properties;

    public KabejaDxfFallbackParsingService(DrawingTextInterpreter textInterpreter, RpInsightProperties properties) {
        this.textInterpreter = textInterpreter;
        this.properties = properties;
    }

    public ExtractedDrawingData parse(InsightFileRecord file, Path localFile) {
        Set<String> layers = new LinkedHashSet<>();
        List<DrawingElement> elements = new ArrayList<>();
        List<String> rawText = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        try (FileInputStream input = new FileInputStream(localFile.toFile())) {
            Parser parser = ParserBuilder.createDefaultParser();
            parser.parse(input, "UTF-8");

            Iterator<?> layerIterator = parser.getDocument().getDXFLayerIterator();
            while (layerIterator.hasNext()) {
                DXFLayer layer = (DXFLayer) layerIterator.next();
                layers.add(layer.getName());
                collectLayer(layer, elements, rawText, warnings);
            }
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to parse DXF drawing with Kabeja fallback", ex);
        }

        if (elements.isEmpty() && rawText.isEmpty()) {
            warnings.add("Kabeja fallback parsed the DXF but found no readable text or dimensions.");
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

    private void collectLayer(DXFLayer layer, List<DrawingElement> elements, List<String> rawText, List<String> warnings) {
        Iterator<?> typeIterator = layer.getDXFEntityTypeIterator();
        while (typeIterator.hasNext()) {
            if (elements.size() >= properties.getIngestion().getMaxExtractedElements()) {
                warnings.add("DXF fallback extraction was capped at " + properties.getIngestion().getMaxExtractedElements() + " elements.");
                return;
            }
            String type = String.valueOf(typeIterator.next());
            List<?> entities = layer.getDXFEntities(type);
            if (entities == null) {
                continue;
            }
            for (Object object : entities) {
                if (elements.size() >= properties.getIngestion().getMaxExtractedElements()) {
                    warnings.add("DXF fallback extraction was capped at " + properties.getIngestion().getMaxExtractedElements() + " elements.");
                    return;
                }
                if (object instanceof DXFEntity entity) {
                    collectEntity(entity, elements, rawText);
                }
            }
        }
    }

    private void collectEntity(DXFEntity entity, List<DrawingElement> elements, List<String> rawText) {
        String text = extractText(entity);
        String layer = entity.getLayerName();
        String coordinates = pointToString(entity);
        if (!StringUtils.hasText(text)) {
            return;
        }
        rawText.add(text);
        elements.add(textInterpreter.toElement(entity.getType(), text, layer, coordinates));
    }

    private String extractText(DXFEntity entity) {
        if (entity instanceof DXFMText mText) {
            return safe(mText.getText());
        }
        if (entity instanceof DXFText text) {
            return safe(text.getText());
        }
        if (entity instanceof DXFDimension dimension) {
            return safe(dimension.getDimensionText());
        }
        return null;
    }

    private String pointToString(DXFEntity entity) {
        Object point = null;
        if (entity instanceof DXFText text) {
            point = invokeOptional(text, "getInsertPoint");
        } else if (entity instanceof DXFDimension dimension) {
            point = dimension.getTextPoint();
        }
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

    private Object invokeOptional(Object target, String methodName) {
        try {
            return target.getClass().getMethod(methodName).invoke(target);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String safe(String value) {
        return value == null ? null : value.replaceAll("\\s+", " ").trim();
    }
}
