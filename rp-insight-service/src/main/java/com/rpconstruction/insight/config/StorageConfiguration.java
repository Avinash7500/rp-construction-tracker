package com.rpconstruction.insight.config;

import com.rpconstruction.insight.storage.FirebaseObjectStorageService;
import com.rpconstruction.insight.storage.LocalObjectStorageService;
import com.rpconstruction.insight.storage.ObjectStorageService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StorageConfiguration {

    @Bean
    public ObjectStorageService objectStorageService(RpInsightProperties properties) {
        if (properties.getStorage().getBackend() == RpInsightProperties.StorageBackend.FIREBASE) {
            return new FirebaseObjectStorageService(properties.getStorage());
        }
        return new LocalObjectStorageService(properties.getStorage().getLocalRoot());
    }
}
