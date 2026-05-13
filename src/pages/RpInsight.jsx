import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import AccountantShell from "../components/AccountantShell";
import Layout from "../components/Layout";
import SkeletonBox from "../components/SkeletonBox";
import { isRpInsightEnabled } from "../config/features";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebaseConfig";
import {
  askRpInsight,
  getRpInsightFile,
  uploadRpInsightFile,
} from "../services/rpInsightApi";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import "./RpInsight.css";

const TERMINAL_FILE_STATUSES = new Set(["INDEXED", "FAILED"]);

function formatConfidence(value) {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 100)}%`;
}

function getSiteLabel(site) {
  if (!site) return "";
  const name = site.name || site.siteName || site.id;
  return site.location ? `${name} - ${site.location}` : name;
}

function StatusBadge({ status }) {
  const label = status || "READY";
  return (
    <span className={`rp-status-badge ${label.toLowerCase()}`}>
      {label}
    </span>
  );
}

function RpInsightContent({
  sites,
  sitesLoading,
  selectedSiteId,
  setSelectedSiteId,
  file,
  setFile,
  uploadState,
  fileStatus,
  onUpload,
  question,
  setQuestion,
  asking,
  onAsk,
  answers,
  onRefreshSites,
}) {
  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) || null,
    [selectedSiteId, sites],
  );
  const canUpload = Boolean(selectedSiteId && file && !uploadState.uploading);
  const canAsk = Boolean(selectedSiteId && question.trim() && !asking);

  return (
    <div className="rp-insight-page">
      <section className="rp-insight-topbar">
        <div>
          <h2>RP Insight</h2>
          <p>{selectedSite ? getSiteLabel(selectedSite) : "No site selected"}</p>
        </div>
        <button className="rp-muted-button" onClick={onRefreshSites} disabled={sitesLoading}>
          Refresh Sites
        </button>
      </section>

      <section className="rp-panel">
        <div className="rp-panel-header">
          <div>
            <h3>Drawing Index</h3>
            <p>DXF, DWG, and PDF files</p>
          </div>
          <StatusBadge status={fileStatus?.status || uploadState.lastUpload?.status} />
        </div>

        {sitesLoading ? (
          <SkeletonBox />
        ) : (
          <div className="rp-upload-grid">
            <label className="rp-field">
              <span>Site</span>
              <select
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
              >
                <option value="">Select site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {getSiteLabel(site)}
                  </option>
                ))}
              </select>
            </label>

            <label className="rp-field">
              <span>Drawing File</span>
              <input
                type="file"
                accept=".dxf,.dwg,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>

            <button
              className="rp-primary-button"
              onClick={onUpload}
              disabled={!canUpload}
            >
              {uploadState.uploading ? "Uploading..." : "Upload and Index"}
            </button>
          </div>
        )}

        {uploadState.lastUpload || fileStatus ? (
          <div className="rp-file-strip">
            <div>
              <span className="rp-kicker">File</span>
              <strong>{fileStatus?.originalFilename || file?.name || "Drawing"}</strong>
            </div>
            <div>
              <span className="rp-kicker">File ID</span>
              <strong>{fileStatus?.fileId || uploadState.lastUpload?.fileId}</strong>
            </div>
            <div>
              <span className="rp-kicker">Chunks</span>
              <strong>{fileStatus?.chunkCount ?? "-"}</strong>
            </div>
            <div>
              <span className="rp-kicker">Status</span>
              <StatusBadge status={fileStatus?.status || uploadState.lastUpload?.status} />
            </div>
          </div>
        ) : null}

        {fileStatus?.errorMessage ? (
          <div className="rp-error-line">{fileStatus.errorMessage}</div>
        ) : null}
      </section>

      <section className="rp-workspace">
        <div className="rp-panel rp-question-panel">
          <div className="rp-panel-header">
            <div>
              <h3>Ask Drawing</h3>
              <p>Answers include confidence and source chunks</p>
            </div>
          </div>

          <textarea
            className="rp-question-input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What is Column P1 size?"
            rows={5}
          />

          <div className="rp-question-actions">
            <button className="rp-muted-button" onClick={() => setQuestion("")} disabled={!question}>
              Clear
            </button>
            <button className="rp-primary-button" onClick={onAsk} disabled={!canAsk}>
              {asking ? "Asking..." : "Ask"}
            </button>
          </div>
        </div>

        <div className="rp-panel rp-answer-panel">
          <div className="rp-panel-header">
            <div>
              <h3>Answers</h3>
              <p>{answers.length ? `${answers.length} response${answers.length === 1 ? "" : "s"}` : "No responses yet"}</p>
            </div>
          </div>

          <div className="rp-answer-list">
            {answers.length === 0 ? (
              <div className="rp-empty-answer">Ask a question after selecting a site.</div>
            ) : (
              answers.map((item) => (
                <article className="rp-answer-item" key={item.id}>
                  <div className="rp-answer-question">{item.question}</div>
                  <div className="rp-answer-main">{item.answer}</div>
                  <div className="rp-answer-meta">
                    <span>Language: {item.language || "-"}</span>
                    <span>Confidence: {formatConfidence(item.confidence)}</span>
                  </div>

                  {item.sourceChunks?.length ? (
                    <details className="rp-sources">
                      <summary>Source chunks</summary>
                      <div className="rp-source-list">
                        {item.sourceChunks.map((chunk) => (
                          <div className="rp-source-row" key={chunk.id}>
                            <div className="rp-source-head">
                              <span>{chunk.fileId}</span>
                              <strong>{formatConfidence(chunk.similarity)}</strong>
                            </div>
                            <p>{chunk.chunkText}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function RpInsightDisabled() {
  return (
    <Layout>
      <div className="rp-insight-page">
        <section className="rp-insight-topbar">
          <div>
            <h2>RP Insight</h2>
            <p>Feature temporarily disabled</p>
          </div>
        </section>
        <section className="rp-panel">
          <div className="rp-disabled-state">
            RP Insight is currently hidden while we finish the remaining work.
          </div>
        </section>
      </div>
    </Layout>
  );
}

function RpInsightEnabled() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [file, setFile] = useState(null);
  const [uploadState, setUploadState] = useState({
    uploading: false,
    lastUpload: null,
  });
  const [fileStatus, setFileStatus] = useState(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answers, setAnswers] = useState([]);

  const loadSites = useCallback(async () => {
    try {
      setSitesLoading(true);
      const sitesRef = collection(db, "sites");
      const q = role === "ENGINEER"
        ? query(
          sitesRef,
          where("assignedEngineerId", "==", user?.uid || ""),
          orderBy("createdAt", "desc"),
        )
        : query(sitesRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const siteList = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((site) => site.isActive !== false);

      setSites(siteList);
      setSelectedSiteId((current) => {
        if (current && siteList.some((site) => site.id === current)) return current;
        return siteList[0]?.id || "";
      });
    } catch (error) {
      showError(error, "Failed to load RP Insight sites");
    } finally {
      setSitesLoading(false);
    }
  }, [role, user?.uid]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  useEffect(() => {
    const fileId = uploadState.lastUpload?.fileId;
    const currentStatus = fileStatus?.status || uploadState.lastUpload?.status;
    if (!fileId || TERMINAL_FILE_STATUSES.has(currentStatus)) return undefined;

    let stopped = false;
    const refreshStatus = async () => {
      try {
        const nextStatus = await getRpInsightFile(fileId);
        if (stopped) return;
        setFileStatus(nextStatus);
      } catch (error) {
        if (!stopped) showError(error, "Failed to refresh drawing status");
      }
    };

    refreshStatus();
    const timer = window.setInterval(refreshStatus, 2500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [uploadState.lastUpload?.fileId, uploadState.lastUpload?.status, fileStatus?.status]);

  const handleUpload = async () => {
    if (!selectedSiteId || !file) return;

    try {
      setUploadState((prev) => ({ ...prev, uploading: true }));
      setFileStatus(null);
      const response = await uploadRpInsightFile({ siteId: selectedSiteId, file });
      setUploadState({ uploading: false, lastUpload: response });
      showSuccess("Drawing upload accepted");
    } catch (error) {
      setUploadState((prev) => ({ ...prev, uploading: false }));
      showError(error, "Drawing upload failed");
    }
  };

  const handleAsk = async () => {
    const trimmedQuestion = question.trim();
    if (!selectedSiteId || !trimmedQuestion) return;

    try {
      setAsking(true);
      const response = await askRpInsight({
        siteId: selectedSiteId,
        question: trimmedQuestion,
      });
      setAnswers((prev) => [
        {
          id: `${Date.now()}-${prev.length}`,
          question: trimmedQuestion,
          ...response,
        },
        ...prev,
      ]);
      setQuestion("");
    } catch (error) {
      showError(error, "RP Insight question failed");
    } finally {
      setAsking(false);
    }
  };

  const content = (
    <RpInsightContent
      sites={sites}
      sitesLoading={sitesLoading}
      selectedSiteId={selectedSiteId}
      setSelectedSiteId={setSelectedSiteId}
      file={file}
      setFile={setFile}
      uploadState={uploadState}
      fileStatus={fileStatus}
      onUpload={handleUpload}
      question={question}
      setQuestion={setQuestion}
      asking={asking}
      onAsk={handleAsk}
      answers={answers}
      onRefreshSites={loadSites}
    />
  );

  if (role === "ACCOUNTANT") {
    return (
      <AccountantShell
        title="RP Insight"
        subtitle="Drawing search and site answers"
        actions={(
          <button className="btn-muted-action" onClick={() => navigate("/accountant/dashboard")}>
            Dashboard
          </button>
        )}
      >
        {content}
      </AccountantShell>
    );
  }

  return <Layout>{content}</Layout>;
}

export default function RpInsight() {
  if (!isRpInsightEnabled) return <RpInsightDisabled />;
  return <RpInsightEnabled />;
}
