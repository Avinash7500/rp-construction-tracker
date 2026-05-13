package com.rpconstruction.insight.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "rp-insight")
public class RpInsightProperties {

    private final Storage storage = new Storage();
    private final Ingestion ingestion = new Ingestion();
    private final Retrieval retrieval = new Retrieval();
    private final Ai ai = new Ai();
    private final Parsing parsing = new Parsing();
    private final Ocr ocr = new Ocr();

    public Storage getStorage() {
        return storage;
    }

    public Ingestion getIngestion() {
        return ingestion;
    }

    public Retrieval getRetrieval() {
        return retrieval;
    }

    public Ai getAi() {
        return ai;
    }

    public Parsing getParsing() {
        return parsing;
    }

    public Ocr getOcr() {
        return ocr;
    }

    public static class Storage {
        private StorageBackend backend = StorageBackend.LOCAL;
        private String localRoot = "./data/rp-insight";
        private String firebaseBucket;
        private String firebaseCredentialsPath;

        public StorageBackend getBackend() {
            return backend;
        }

        public void setBackend(StorageBackend backend) {
            this.backend = backend;
        }

        public String getLocalRoot() {
            return localRoot;
        }

        public void setLocalRoot(String localRoot) {
            this.localRoot = localRoot;
        }

        public String getFirebaseBucket() {
            return firebaseBucket;
        }

        public void setFirebaseBucket(String firebaseBucket) {
            this.firebaseBucket = firebaseBucket;
        }

        public String getFirebaseCredentialsPath() {
            return firebaseCredentialsPath;
        }

        public void setFirebaseCredentialsPath(String firebaseCredentialsPath) {
            this.firebaseCredentialsPath = firebaseCredentialsPath;
        }
    }

    public static class Ingestion {
        private boolean async = true;
        private int chunkTargetChars = 900;
        private int chunkOverlapChars = 120;
        private int maxExtractedElements = 50000;

        public boolean isAsync() {
            return async;
        }

        public void setAsync(boolean async) {
            this.async = async;
        }

        public int getChunkTargetChars() {
            return chunkTargetChars;
        }

        public void setChunkTargetChars(int chunkTargetChars) {
            this.chunkTargetChars = chunkTargetChars;
        }

        public int getChunkOverlapChars() {
            return chunkOverlapChars;
        }

        public void setChunkOverlapChars(int chunkOverlapChars) {
            this.chunkOverlapChars = chunkOverlapChars;
        }

        public int getMaxExtractedElements() {
            return maxExtractedElements;
        }

        public void setMaxExtractedElements(int maxExtractedElements) {
            this.maxExtractedElements = maxExtractedElements;
        }
    }

    public static class Retrieval {
        private int topK = 5;
        private double minSimilarity = 0.55;

        public int getTopK() {
            return topK;
        }

        public void setTopK(int topK) {
            this.topK = topK;
        }

        public double getMinSimilarity() {
            return minSimilarity;
        }

        public void setMinSimilarity(double minSimilarity) {
            this.minSimilarity = minSimilarity;
        }
    }

    public static class Ai {
        private String provider = "gemini";
        private String geminiApiKey;
        private String geminiModel = "gemini-2.5-flash-lite";
        private String openAiApiKey;
        private String openAiModel = "gpt-4o";
        private String embeddingModel = "gemini-embedding-001";
        private int embeddingDimensions = 768;
        private double temperature = 0.1;

        public String getProvider() {
            return provider;
        }

        public void setProvider(String provider) {
            this.provider = provider;
        }

        public String getGeminiApiKey() {
            return geminiApiKey;
        }

        public void setGeminiApiKey(String geminiApiKey) {
            this.geminiApiKey = geminiApiKey;
        }

        public String getGeminiModel() {
            return geminiModel;
        }

        public void setGeminiModel(String geminiModel) {
            this.geminiModel = geminiModel;
        }

        public String getOpenAiApiKey() {
            return openAiApiKey;
        }

        public void setOpenAiApiKey(String openAiApiKey) {
            this.openAiApiKey = openAiApiKey;
        }

        public String getOpenAiModel() {
            return openAiModel;
        }

        public void setOpenAiModel(String openAiModel) {
            this.openAiModel = openAiModel;
        }

        public String getEmbeddingModel() {
            return embeddingModel;
        }

        public void setEmbeddingModel(String embeddingModel) {
            this.embeddingModel = embeddingModel;
        }

        public int getEmbeddingDimensions() {
            return embeddingDimensions;
        }

        public void setEmbeddingDimensions(int embeddingDimensions) {
            this.embeddingDimensions = embeddingDimensions;
        }

        public double getTemperature() {
            return temperature;
        }

        public void setTemperature(double temperature) {
            this.temperature = temperature;
        }
    }

    public static class Parsing {
        private String asposeLicensePath;

        public String getAsposeLicensePath() {
            return asposeLicensePath;
        }

        public void setAsposeLicensePath(String asposeLicensePath) {
            this.asposeLicensePath = asposeLicensePath;
        }
    }

    public static class Ocr {
        private boolean enabled;
        private String dataPath;
        private String language = "eng+hin+mar";
        private int dpi = 220;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getDataPath() {
            return dataPath;
        }

        public void setDataPath(String dataPath) {
            this.dataPath = dataPath;
        }

        public String getLanguage() {
            return language;
        }

        public void setLanguage(String language) {
            this.language = language;
        }

        public int getDpi() {
            return dpi;
        }

        public void setDpi(int dpi) {
            this.dpi = dpi;
        }
    }

    public enum StorageBackend {
        LOCAL,
        FIREBASE
    }
}
