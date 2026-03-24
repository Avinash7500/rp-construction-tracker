import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import AccountantShell from "../components/AccountantShell";
import SkeletonBox from "../components/SkeletonBox";
import { db } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import { formatMarathiWeekFromWeekKey } from "../utils/marathiWeekFormat";
import { generateSiteSummaryPdf } from "../utils/pdf/siteSummaryPdf";

function computeLabourAmount(row) {
  return (row.mistriCount || 0) * (row.mistriRate || 0)
    + (row.labourCount || 0) * (row.labourRate || 0);
}

function computeMaterialBill(row) {
  if (typeof row.billAmount === "number") return row.billAmount;
  return (row.qty || 0) * (row.rate || 0);
}

export default function AccountantSiteDetail() {
  const navigate = useNavigate();
  const { siteId } = useParams();
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState(null);
  const [labourWeekly, setLabourWeekly] = useState([]);
  const [materialWeekly, setMaterialWeekly] = useState([]);
  const [labourTotal, setLabourTotal] = useState(0);
  const [materialTotal, setMaterialTotal] = useState(0);
  const [currentWeekTotals, setCurrentWeekTotals] = useState({ labour: 0, material: 0 });

  const loadDetail = async () => {
    try {
      setLoading(true);
      const siteSnap = await getDoc(doc(db, "sites", siteId));
      if (!siteSnap.exists()) {
        setSite(null);
        return;
      }
      const siteData = { id: siteSnap.id, ...siteSnap.data() };
      setSite(siteData);

      const [labourSnap, materialSnap, paymentSnap] = await Promise.all([
        getDocs(query(collection(db, "labour_entries"), where("siteId", "==", siteId))),
        getDocs(query(collection(db, "material_entries"), where("siteId", "==", siteId))),
        getDocs(query(collection(db, "dealer_payments"), where("siteId", "==", siteId))),
      ]);

      const labourRows = labourSnap.docs.map((d) => d.data());
      const materialRows = materialSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const paymentRows = paymentSnap.docs.map((d) => d.data());

      const paidByMaterialEntry = paymentRows.reduce((acc, p) => {
        const id = p.materialEntryId || "";
        if (!id) return acc;
        acc[id] = (acc[id] || 0) + (p.paymentAmount || 0);
        return acc;
      }, {});

      const labourMap = {};
      let labourSum = 0;
      labourRows.forEach((row) => {
        if (row.isPlaceholder) return;
        const weekKey = row.weekKey || "UNKNOWN";
        const spend = computeLabourAmount(row);
        labourSum += spend;
        if (!labourMap[weekKey]) {
          labourMap[weekKey] = {
            weekKey,
            totalEntries: 0,
            totalLabourSpend: 0,
          };
        }
        labourMap[weekKey].totalEntries += 1;
        labourMap[weekKey].totalLabourSpend += spend;
      });

      const materialMap = {};
      let materialSum = 0;
      materialRows.forEach((row) => {
        if (row.isPlaceholder) return;
        const weekKey = row.weekKey || "UNKNOWN";
        const bill = computeMaterialBill(row);
        const paid = typeof paidByMaterialEntry[row.id] === "number"
          ? paidByMaterialEntry[row.id]
          : (row.paidAmount || 0);
        materialSum += bill;
        if (!materialMap[weekKey]) {
          materialMap[weekKey] = {
            weekKey,
            deliveries: 0,
            totalBill: 0,
            totalPaid: 0,
            pending: 0,
          };
        }
        materialMap[weekKey].deliveries += 1;
        materialMap[weekKey].totalBill += bill;
        materialMap[weekKey].totalPaid += paid;
        materialMap[weekKey].pending += (bill - paid);
      });

      setLabourTotal(labourSum);
      setMaterialTotal(materialSum);
      if (!labourMap[siteData.currentWeekKey]) {
        labourMap[siteData.currentWeekKey] = { weekKey: siteData.currentWeekKey, totalEntries: 0, totalLabourSpend: 0 };
      }
      if (!materialMap[siteData.currentWeekKey]) {
        materialMap[siteData.currentWeekKey] = { weekKey: siteData.currentWeekKey, deliveries: 0, totalBill: 0, totalPaid: 0, pending: 0 };
      }
      setCurrentWeekTotals({
        labour: labourMap[siteData.currentWeekKey]?.totalLabourSpend || 0,
        material: materialMap[siteData.currentWeekKey]?.totalBill || 0,
      });
      setLabourWeekly(
        Object.values(labourMap).sort((a, b) => b.weekKey.localeCompare(a.weekKey)),
      );
      setMaterialWeekly(
        Object.values(materialMap).sort((a, b) => b.weekKey.localeCompare(a.weekKey)),
      );
    } catch (e) {
      showError(e, "Failed to load site financial detail");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [siteId]);

  const grandTotal = useMemo(() => labourTotal + materialTotal, [labourTotal, materialTotal]);
  const currentWeekGrand = useMemo(
    () => (currentWeekTotals.labour || 0) + (currentWeekTotals.material || 0),
    [currentWeekTotals],
  );

  const exportSiteSummaryPdf = async () => {
    await generateSiteSummaryPdf({
      siteName: site?.name || "-",
      engineerName: site?.assignedEngineerName || "-",
      currentWeekKey: site?.currentWeekKey || "",
      totals: {
        labour: labourTotal,
        material: materialTotal,
        grand: grandTotal,
      },
      weekly: {
        labour: currentWeekTotals.labour || 0,
        material: currentWeekTotals.material || 0,
        grand: currentWeekGrand,
      },
      labourHistory: labourWeekly,
      materialHistory: materialWeekly,
    });
  };

  const createNewMaterialWeekSheet = async () => {
    if (!site?.currentWeekKey) return;
    try {
      const existing = await getDocs(
        query(
          collection(db, "material_entries"),
          where("siteId", "==", siteId),
          where("weekKey", "==", site.currentWeekKey),
        ),
      );
      if (existing.empty) {
        const initRef = doc(collection(db, "material_entries"));
        await setDoc(initRef, {
          siteId,
          weekKey: site.currentWeekKey,
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
      showSuccess("Material week is ready");
      navigate(`/accountant/site/${siteId}/material/${encodeURIComponent(site.currentWeekKey)}`);
    } catch (e) {
      showError(e, "Failed to open material week");
    }
  };

  const createNewLabourWeekSheet = async () => {
    if (!site?.currentWeekKey) return;
    try {
      const existing = await getDocs(
        query(
          collection(db, "labour_entries"),
          where("siteId", "==", siteId),
          where("weekKey", "==", site.currentWeekKey),
        ),
      );
      if (existing.empty) {
        const initRef = doc(collection(db, "labour_entries"));
        await setDoc(initRef, {
          siteId,
          weekKey: site.currentWeekKey,
          workType: "GENERAL",
          dayName: "सोमवार",
          details: "",
          mistriCount: 0,
          mistriRate: 0,
          labourCount: 0,
          labourRate: 0,
          isPlaceholder: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      showSuccess("Labour week is ready");
      navigate(`/accountant/site/${siteId}/labour/${encodeURIComponent(site.currentWeekKey)}`);
    } catch (e) {
      showError(e, "Failed to open labour week");
    }
  };

  if (loading) {
    return (
      <AccountantShell title="Site Financial Detail">
        <SkeletonBox />
      </AccountantShell>
    );
  }

  if (!site) {
    return (
      <AccountantShell title="Site Financial Detail">
        <section className="acc-card">
          <div className="acc-card-body">Site not found.</div>
        </section>
      </AccountantShell>
    );
  }

  return (
    <AccountantShell
      title={`${site.name || "Site"} Financials`}
      subtitle={`Current Week: ${formatMarathiWeekFromWeekKey(site.currentWeekKey)} | Status: ${site.status || (site.isActive === false ? "Inactive" : "In Progress" )}`}
      actions={(
        <>
          <button className="btn-muted-action" onClick={() => navigate("/accountant/dashboard")}>
            Back to Dashboard
          </button>
          <button className="btn-primary-v5" onClick={exportSiteSummaryPdf}>
            Generate PDF
          </button>
          <button className="btn-muted-action" onClick={loadDetail}>
            Refresh
          </button>
        </>
      )}
    >
      <section className="acc-card">
        <div className="acc-card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, color: "#475569" }}>Engineer</div>
            <div style={{ marginTop: 6 }}>
              <span className="acc-tag" style={{ background: "#d1fae5", color: "#065f46", fontSize: "0.84rem", padding: "6px 12px" }}>
                {site.assignedEngineerName || "Not Assigned"}
              </span>
            </div>
          </div>
          <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
            Week Key: {site.currentWeekKey || "-"}
          </div>
        </div>
      </section>

      <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Total Financial Summary</h3>
      <section className="acc-grid-3">
        <article className="acc-stat-card">
          <div className="acc-stat-label">Overall Labour</div>
          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Total project labour</div>
          <div className="acc-stat-value">₹ {labourTotal.toLocaleString("en-IN")}</div>
        </article>
        <article className="acc-stat-card">
          <div className="acc-stat-label">Overall Material</div>
          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Total project material</div>
          <div className="acc-stat-value">₹ {materialTotal.toLocaleString("en-IN")}</div>
        </article>
        <article className="acc-stat-card" style={{ background: "#2563eb", color: "#fff" }}>
          <div className="acc-stat-label" style={{ color: "#dbeafe" }}>Project Grand Total</div>
          <div className="acc-stat-value">₹ {grandTotal.toLocaleString("en-IN")}</div>
        </article>
      </section>

      <h3 style={{ margin: 0, fontSize: "1.05rem" }}>Weekly Financial Summary</h3>
      <section className="acc-grid-3">
        <article className="acc-stat-card">
          <div className="acc-stat-label">Labour Total</div>
          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Spent this week</div>
          <div className="acc-stat-value">₹ {(currentWeekTotals.labour || 0).toLocaleString("en-IN")}</div>
        </article>
        <article className="acc-stat-card">
          <div className="acc-stat-label">Material Total</div>
          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Spent this week</div>
          <div className="acc-stat-value">₹ {(currentWeekTotals.material || 0).toLocaleString("en-IN")}</div>
        </article>
        <article className="acc-stat-card">
          <div className="acc-stat-label">Grand Total (Weekly)</div>
          <div className="acc-stat-value">₹ {currentWeekGrand.toLocaleString("en-IN")}</div>
        </article>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Labour Weekly History</h3>
          <button className="btn-primary-v5" onClick={createNewLabourWeekSheet}>
            Create New Week Labour Sheet
          </button>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0 }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Week</th>
                <th className="acc-right" style={{ width: 150 }}>Total Entries</th>
                <th className="acc-right">Total Labour Spend</th>
              </tr>
            </thead>
            <tbody>
              {labourWeekly.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#64748b" }}>No labour entries found.</td>
                </tr>
              ) : labourWeekly.map((row) => (
                <tr
                  key={row.weekKey}
                  onClick={() => navigate(`/accountant/site/${siteId}/labour/${encodeURIComponent(row.weekKey)}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{formatMarathiWeekFromWeekKey(row.weekKey)}</td>
                  <td className="acc-right">{row.totalEntries}</td>
                  <td className="acc-right">₹ {row.totalLabourSpend.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Material Weekly History</h3>
          <button className="btn-primary-v5" onClick={createNewMaterialWeekSheet}>
            Create New Week Sheet
          </button>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0 }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Week</th>
                <th className="acc-right">Deliveries</th>
                <th className="acc-right">Total Bill</th>
                <th className="acc-right">Total Paid</th>
                <th className="acc-right">Pending</th>
              </tr>
            </thead>
            <tbody>
              {materialWeekly.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>No material entries found.</td>
                </tr>
              ) : materialWeekly.map((row) => (
                <tr
                  key={row.weekKey}
                  onClick={() => navigate(`/accountant/site/${siteId}/material/${encodeURIComponent(row.weekKey)}`)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{formatMarathiWeekFromWeekKey(row.weekKey)}</td>
                  <td className="acc-right">{row.deliveries}</td>
                  <td className="acc-right">₹ {row.totalBill.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {row.totalPaid.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {row.pending.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AccountantShell>
  );
}
