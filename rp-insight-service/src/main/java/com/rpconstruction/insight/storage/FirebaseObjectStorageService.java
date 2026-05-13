package com.rpconstruction.insight.storage;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.Bucket;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.StorageClient;
import com.rpconstruction.insight.config.RpInsightProperties;
import com.rpconstruction.insight.domain.StoredFile;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.Channels;
import java.nio.file.Path;

public class FirebaseObjectStorageService implements ObjectStorageService {

    private final String bucketName;

    public FirebaseObjectStorageService(RpInsightProperties.Storage storage) {
        if (!StringUtils.hasText(storage.getFirebaseBucket())) {
            throw new IllegalStateException("rp-insight.storage.firebase-bucket must be configured");
        }
        this.bucketName = storage.getFirebaseBucket();
        initializeFirebase(storage);
    }

    @Override
    public StoredFile store(String siteId, String fileId, MultipartFile file) throws IOException {
        String original = StringUtils.cleanPath(file.getOriginalFilename() == null ? "drawing" : file.getOriginalFilename());
        String storageKey = Path.of("rp-insight", siteId, fileId, original).toString().replace('\\', '/');
        Bucket bucket = StorageClient.getInstance().bucket(bucketName);
        try (InputStream input = file.getInputStream()) {
            Blob blob = bucket.create(storageKey, input, file.getContentType());
            return new StoredFile(fileId, storageKey, "gs://" + bucketName + "/" + blob.getName(), file.getSize());
        }
    }

    @Override
    public InputStream open(String storageKey) throws IOException {
        Blob blob = StorageClient.getInstance().bucket(bucketName).get(storageKey);
        if (blob == null) {
            throw new IOException("File not found in Firebase Storage: " + storageKey);
        }
        return Channels.newInputStream(blob.reader());
    }

    private void initializeFirebase(RpInsightProperties.Storage storage) {
        if (!FirebaseApp.getApps().isEmpty()) {
            return;
        }
        try {
            FirebaseOptions.Builder builder = FirebaseOptions.builder()
                .setStorageBucket(bucketName);
            if (StringUtils.hasText(storage.getFirebaseCredentialsPath())) {
                try (InputStream credentials = new FileInputStream(storage.getFirebaseCredentialsPath())) {
                    builder.setCredentials(GoogleCredentials.fromStream(credentials));
                }
            } else {
                builder.setCredentials(GoogleCredentials.getApplicationDefault());
            }
            FirebaseApp.initializeApp(builder.build());
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to initialize Firebase Storage", ex);
        }
    }
}
