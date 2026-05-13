package com.rpconstruction.insight.storage;

import com.rpconstruction.insight.domain.StoredFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

public interface ObjectStorageService {

    StoredFile store(String siteId, String fileId, MultipartFile file) throws IOException;

    InputStream open(String storageKey) throws IOException;
}
