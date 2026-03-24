import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import AccountantShell from "../components/AccountantShell";
import { db } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import { generateLabourPdf } from "../utils/pdf/labourPdf";

const DAY_ROWS = ["à¤¸à¥‹à¤®à¤µà¤¾à¤°", "à¤®à¤‚à¤—à¤³à¤µà¤¾à¤°", "à¤¬à¥à¤§à¤µà¤¾à¤°", "à¤—à¥à¤°à¥à¤µà¤¾à¤°", "à¤¶à¥à¤•à¥à¤°à¤µà¤¾à¤°", "à¤¶à¤¨à¤¿à¤µà¤¾à¤°", "à¤°à¤µà¤¿à¤µà¤¾à¤°"];

function createEmptyRows() {
  return DAY_ROWS.map((dayName) => ({
    id: "",
    dayName,
    details: "",
    mistriCount: 0,
    mistriRate: 0,
    labourCount: 0,
    labourRate: 0,
  }));
}

function rowTotal(row) {
  return (row.mistriCount || 0) * (row.mistriRate || 0)
    + (row.labourCount || 0) * (row.labourRate || 0);
}

export default function LabourSheet() {
  const { siteId, weekKey, workType } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [site, setSite] = useState(null);
  const [rows, setRows] = useState(createEmptyRows());

  const effectiveWeekKey = weekKey || site?.currentWeekKey || "";
  const effectiveWorkType = workType || "GENERAL";

  const loadData = async () => {
    try {
      setLoading(true);
      const siteSnap = await getDoc(doc(db, "sites", siteId));
      if (!siteSnap.exists()) {
        setSite(null);
        return;
      }
      const siteData = { id: siteSnap.id, ...siteSnap.data() };
      setSite(siteData);

      const targetWeek = weekKey || siteData.currentWeekKey;
      const snap = await getDocs(
        query(
          collection(db, "labour_entries"),
          where("siteId", "==", siteId),
          where("weekKey", "==", targetWeek),
        ),
      );

      if (snap.empty) {
        setRows(createEmptyRows());
        return;
      }

      const mapByDay = {};
      snap.docs.forEach((d) => {
        const row = { id: d.id, ...d.data() };
        mapByDay[row.dayName] = row;
      });

      const merged = DAY_ROWS.map((day) => mapByDay[day] || {
        id: "",
        dayName: day,
        details: "",
        mistriCount: 0,
        mistriRate: 0,
        labourCount: 0,
        labourRate: 0,
      });
      setRows(merged);
    } catch (e) {
      showError(e, "Failed to load labour sheet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [siteId, weekKey, workType]);

  const updateRow = (index, field, value) => {
    const next = [...rows];
    next[index] = {
      ...next[index],
      [field]: ["details"].includes(field) ? value : Number(value || 0),
    };
    setRows(next);
  };

  const weeklyTotal = useMemo(() => rows.reduce((sum, row) => sum + rowTotal(row), 0), [rows]);

  const handleSave = async () => {
    if (!site) return;
    try {
      setSaving(true);
      const batch = writeBatch(db);
      rows.forEach((row, index) => {
        const docId = row.id || `${siteId}_${effectiveWeekKey}_${effectiveWorkType}_${index}`;
        const ref = doc(db, "labour_entries", docId);
        batch.set(ref, {
          siteId,
          weekKey: effectiveWeekKey,
          workType: effectiveWorkType,
          dayName: row.dayName,
          details: row.details || "",
          mistriCount: Number(row.mistriCount || 0),
          mistriRate: Number(row.mistriRate || 0),
          labourCount: Number(row.labourCount || 0),
          labourRate: Number(row.labourRate || 0),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      await batch.commit();
      showSuccess("Labour sheet saved");
      await loadData();
    } catch (e) {
      showError(e, "Failed to save labour sheet");
    } finally {
      setSaving(false);
    }
  };

  const handleWeekCompleted = async () => {
    if (!site) return;
    try {
      const [year, weekPart] = String(effectiveWeekKey).split("-W");
      const next = `${year}-W${String(Number(weekPart || 0) + 1).padStart(2, "0")}`;
      const [nextLabourSnap, nextMaterialSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "labour_entries"),
            where("siteId", "==", siteId),
            where("weekKey", "==", next),
          ),
        ),
        getDocs(
          query(
            collection(db, "material_entries"),
            where("siteId", "==", siteId),
            where("weekKey", "==", next),
          ),
        ),
      ]);

      const initBatch = writeBatch(db);
      if (nextLabourSnap.empty) {
        const labourInitRef = doc(collection(db, "labour_entries"));
        initBatch.set(labourInitRef, {
          siteId,
          weekKey: next,
          workType: "GENERAL",
          dayName: "à¤¸à¥‹à¤®à¤µà¤¾à¤°",
          details: "",
          mistriCount: 0,
          mistriRate: 0,
          labourCount: 0,
          labourRate: 0,
          isPlaceholder: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      if (nextMaterialSnap.empty) {
        const materialInitRef = doc(collection(db, "material_entries"));
        initBatch.set(materialInitRef, {
          siteId,
          weekKey: next,
          date: new Date().toISOString().slice(0, 10),
          details: "",
          dealerId: "",
          dealerName: "",
          qty: 0,
          rate: 0,
          billAmount: 0,
          isPlaceholder: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      await initBatch.commit();

      await updateDoc(doc(db, "sites", siteId), {
        currentWeekKey: next,
        totalLabourSpend: weeklyTotal,
        updatedAt: serverTimestamp(),
      });
      showSuccess(`Week completed. Next week: ${next}`);
      navigate(`/accountant/site/${siteId}`);
    } catch (e) {
      showError(e, "Failed to complete week");
    }
  };

  const handlePdf = async () => {
    await generateLabourPdf({
      siteName: site?.name || "-",
      weekKey: effectiveWeekKey,
      engineerName: site?.assignedEngineerName || "-",
      rows,
    });
  };

  if (loading) {
    return (
      <AccountantShell title="Labour Weekly Sheet">
        <div>Loading...</div>
      </AccountantShell>
    );
  }

  if (!site) {
    return (
      <AccountantShell title="Labour Weekly Sheet">
        <div>Site not found.</div>
      </AccountantShell>
    );
  }

  return (
    <AccountantShell
      title={`Labour Weekly Sheet (${effectiveWeekKey})`}
      subtitle={`${site.name} | à¤®à¤œà¥‚à¤° à¤–à¤°à¥à¤š à¤Ÿà¥à¤°à¥…à¤•à¤¿à¤‚à¤—`}
      actions={(
        <>
          <button className="btn-muted-action" onClick={() => navigate(`/accountant/site/${siteId}`)}>
            Back
          </button>
          <button className="btn-primary-v5" onClick={handlePdf}>
            Generate PDF
          </button>
        </>
      )}
    >
      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Labour Entries</h3>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>à¤µà¤¾à¤°</th>
                <th>à¤¤à¤ªà¤¶à¥€à¤²</th>
                <th className="acc-right">Mistri Count</th>
                <th className="acc-right">Mistri Rate</th>
                <th className="acc-right">Labour Count</th>
                <th className="acc-right">Labour Rate</th>
                <th className="acc-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={row.dayName}>
                  <td>{row.dayName}</td>
                  <td>
                    <input
                      className="sheet-input-text"
                      value={row.details || ""}
                      onChange={(e) => updateRow(idx, "details", e.target.value)}
                    />
                  </td>
                  <td className="acc-right">
                    <input className="sheet-input-num" type="number" value={row.mistriCount || 0} onChange={(e) => updateRow(idx, "mistriCount", e.target.value)} />
                  </td>
                  <td className="acc-right">
                    <input className="sheet-input-num" type="number" value={row.mistriRate || 0} onChange={(e) => updateRow(idx, "mistriRate", e.target.value)} />
                  </td>
                  <td className="acc-right">
                    <input className="sheet-input-num" type="number" value={row.labourCount || 0} onChange={(e) => updateRow(idx, "labourCount", e.target.value)} />
                  </td>
                  <td className="acc-right">
                    <input className="sheet-input-num" type="number" value={row.labourRate || 0} onChange={(e) => updateRow(idx, "labourRate", e.target.value)} />
                  </td>
                  <td className="acc-right">â‚¹ {rowTotal(row).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="acc-right" style={{ fontWeight: 800 }}>Weekly Total</td>
                <td className="acc-right" style={{ fontWeight: 800 }}>â‚¹ {weeklyTotal.toLocaleString("en-IN")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn-muted-action" onClick={handleWeekCompleted}>
          Week Completed
        </button>
        <button className="btn-primary-v5" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </section>
    </AccountantShell>
  );
}


