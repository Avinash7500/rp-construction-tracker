package com.rpconstruction.insight.service;

import com.rpconstruction.insight.domain.ExtractedDrawingData;
import com.rpconstruction.insight.domain.InsightFileRecord;

import java.nio.file.Path;

public interface CadParsingService {

    ExtractedDrawingData parse(InsightFileRecord file, Path localFile);
}
