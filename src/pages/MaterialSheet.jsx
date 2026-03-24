import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
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
import { generateMaterialPdf } from "../utils/pdf/materialPdf";

const EMPTY_ROW = () => ({
  id: "",
  date: new Date().toISOString().slice(0, 10),
  details: "",
  dealerId: "",
  dealerName: "",
  qty: 0,
  rate: 0,
  paidAmount: 0,
});

function getBillAmount(row) {
  if (typeof row.billAmount === "number") return row.billAmount;
  return (row.qty || 0) * (row.rate || 0);
}

export default function MaterialSheet() {
  const { siteId, weekKey } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [site, setSite] = useState(null);
  const [dealers, setDealers] = useState([]);
  const [rows, setRows] = useState([]);
  const [paymentsByEntry, setPaymentsByEntry] = useState({});

  const targetWeekKey = weekKey || site?.currentWeekKey || "";

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

      const effectiveWeek = weekKey || siteData.currentWeekKey;
      const [dealerSnap, matSnap, paymentSnap] = await Promise.all([
        getDocs(collection(db, "dealers")),
        getDocs(query(collection(db, "material_entries"), where("siteId", "==", siteId), where("weekKey", "==", effectiveWeek))),
        getDocs(query(collection(db, "dealer_payments"), where("siteId", "==", siteId))),
      ]);

      const dealerList = dealerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDealers(dealerList);

      const paymentMap = paymentSnap.docs.reduce((acc, d) => {
        const p = d.data();
        const key = p.materialEntryId || "";
        if (!key) return acc;
        acc[key] = (acc[key] || 0) + (p.paymentAmount || 0);
        return acc;
      }, {});
      setPaymentsByEntry(paymentMap);

      const materialRows = matSnap.docs.map((d) => ({ id: d.id, ...d.data(), paidAmount: 0 }));
      setRows(materialRows.length ? materialRows : [EMPTY_ROW()]);
    } catch (e) {
      showError(e, "Failed to load material sheet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [siteId, weekKey]);

  const updateRow = (index, field, value) => {
    const next = [...rows];
    next[index] = { ...next[index], [field]: ["qty", "rate", "paidAmount"].includes(field) ? Number(value || 0) : value };
    if (field === "dealerName") {
      const dealer = dealers.find((d) => (d.name || "").toLowerCase() === String(value || "").trim().toLowerCase());
      next[index].dealerId = dealer?.id || "";
    }
    setRows(next);
  };

  const addRow = () => {
    setRows((prev) => [...prev, EMPTY_ROW()]);
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const totals = useMemo(() => {
    return rows.reduce((acc, row) => {
      const bill = getBillAmount(row);
      const existingPaid = row.id ? (paymentsByEntry[row.id] || row.paidAmount || 0) : 0;
      const newPaid = Number(row.paidAmount || 0);
      acc.totalBill += bill;
      acc.totalPaid += existingPaid + newPaid;
      return acc;
    }, { totalBill: 0, totalPaid: 0 });
  }, [rows, paymentsByEntry]);

  const handleSave = async () => {
    if (!site) return;
    try {
      setSaving(true);
      const effectiveWeek = targetWeekKey;
      const batch = writeBatch(db);
      const paymentsToCreate = [];

      for (const row of rows) {
        if (!row.details && !row.qty && !row.rate) continue;
        const rowId = row.id || doc(collection(db, "material_entries")).id;
        const billAmount = getBillAmount(row);
        const materialRef = doc(db, "material_entries", rowId);

        batch.set(materialRef, {
          siteId,
          weekKey: effectiveWeek,
          date: row.date || new Date().toISOString().slice(0, 10),
          details: row.details || "",
          dealerId: row.dealerId || "",
          dealerName: row.dealerName || "",
          qty: Number(row.qty || 0),
          rate: Number(row.rate || 0),
          billAmount,
          updatedAt: serverTimestamp(),
        }, { merge: true });

        const payNow = Number(row.paidAmount || 0);
        if (payNow > 0) {
          paymentsToCreate.push({
            dealerId: row.dealerId || "",
            siteId,
            materialEntryId: rowId,
            paymentAmount: payNow,
            paymentDate: row.date || new Date().toISOString().slice(0, 10),
            notes: "Payment from material weekly sheet",
            createdAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      for (const pay of paymentsToCreate) {
        await addDoc(collection(db, "dealer_payments"), pay);
      }
      showSuccess("Material sheet saved");
      await loadData();
    } catch (e) {
      showError(e, "Failed to save material sheet");
    } finally {
      setSaving(false);
    }
  };

  const handleWeekCompleted = async () => {
    if (!site) return;
    try {
      const [year, weekPart] = String(targetWeekKey).split("-W");
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
        totalMaterialSpend: totals.totalBill,
        updatedAt: serverTimestamp(),
      });
      showSuccess(`Week completed. Next week: ${next}`);
      navigate(`/accountant/site/${siteId}`);
    } catch (e) {
      showError(e, "Failed to complete week");
    }
  };

  const handlePdf = async () => {
    const pdfRows = rows.map((row) => {
      const bill = getBillAmount(row);
      const existingPaid = row.id ? (paymentsByEntry[row.id] || 0) : 0;
      const paid = existingPaid + Number(row.paidAmount || 0);
      return { ...row, billAmount: bill, paidAmount: paid };
    });
    await generateMaterialPdf({
      siteName: site?.name || "-",
      weekKey: targetWeekKey,
      engineerName: site?.assignedEngineerName || "-",
      rows: pdfRows,
    });
  };

  if (loading) {
    return (
      <AccountantShell title="Material Weekly Sheet">
        <div>Loading...</div>
      </AccountantShell>
    );
  }

  if (!site) {
    return (
      <AccountantShell title="Material Weekly Sheet">
        <div>Site not found.</div>
      </AccountantShell>
    );
  }

  return (
    <AccountantShell
      title={`Material Weekly Sheet (${targetWeekKey})`}
      subtitle={`${site.name} | à¤¤à¤¾à¤°à¥€à¤–, à¤¡à¤¿à¤²à¤°, à¤¬à¤¿à¤² à¤†à¤£à¤¿ à¤ªà¥‡à¤®à¥‡à¤‚à¤Ÿ à¤Ÿà¥à¤°à¥…à¤•à¤¿à¤‚à¤—`}
      actions={(
        <>
          <button className="btn-muted-action" onClick={() => navigate(`/accountant/site/${siteId}`)}>Back</button>
          <button className="btn-primary-v5" onClick={handlePdf}>Generate PDF</button>
        </>
      )}
    >
      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Material Entries</h3>
          <button className="btn-muted-action" onClick={addRow}>+ Add Row</button>
        </div>
        <datalist id="material-dealers-list">
          {dealers.map((dealer) => (
            <option key={dealer.id} value={dealer.name || ""} />
          ))}
        </datalist>
        <div className="acc-card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>à¤¤à¤¾à¤°à¥€à¤–</th>
                <th>à¤¤à¤ªà¤¶à¥€à¤²</th>
                <th>Dealer</th>
                <th className="acc-right">Qty</th>
                <th className="acc-right">Rate</th>
                <th className="acc-right">Bill Amount</th>
                <th className="acc-right">Paid Amount</th>
                <th className="acc-right">Remaining</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const bill = getBillAmount(row);
                const existingPaid = row.id ? (paymentsByEntry[row.id] || 0) : 0;
                const pending = bill - (existingPaid + Number(row.paidAmount || 0));
                return (
                  <tr key={row.id || `row-${idx}`}>
                    <td>
                      <input type="date" value={row.date || ""} onChange={(e) => updateRow(idx, "date", e.target.value)} className="sheet-input-text" />
                    </td>
                    <td>
                      <input value={row.details || ""} onChange={(e) => updateRow(idx, "details", e.target.value)} className="sheet-input-text" />
                    </td>
                    <td>
                      <input
                        list="material-dealers-list"
                        value={row.dealerName || ""}
                        onChange={(e) => updateRow(idx, "dealerName", e.target.value)}
                        className="sheet-input-text"
                        placeholder="Select or type dealer"
                      />
                    </td>
                    <td className="acc-right">
                      <input type="number" value={row.qty || 0} onChange={(e) => updateRow(idx, "qty", e.target.value)} className="sheet-input-num" />
                    </td>
                    <td className="acc-right">
                      <input type="number" value={row.rate || 0} onChange={(e) => updateRow(idx, "rate", e.target.value)} className="sheet-input-num" />
                    </td>
                    <td className="acc-right">â‚¹ {bill.toLocaleString("en-IN")}</td>
                    <td className="acc-right">
                      <input type="number" value={row.paidAmount || 0} onChange={(e) => updateRow(idx, "paidAmount", e.target.value)} className="sheet-input-num" />
                    </td>
                    <td className="acc-right">â‚¹ {pending.toLocaleString("en-IN")}</td>
                    <td className="acc-right">
                      <button className="btn-muted-action" onClick={() => removeRow(idx)}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="acc-grid-3">
        <article className="acc-stat-card">
          <div className="acc-stat-label">Total Bill</div>
          <div className="acc-stat-value">â‚¹ {totals.totalBill.toLocaleString("en-IN")}</div>
        </article>
        <article className="acc-stat-card">
          <div className="acc-stat-label">Total Paid</div>
          <div className="acc-stat-value">â‚¹ {totals.totalPaid.toLocaleString("en-IN")}</div>
        </article>
        <article className="acc-stat-card">
          <div className="acc-stat-label">Pending Amount</div>
          <div className="acc-stat-value">â‚¹ {(totals.totalBill - totals.totalPaid).toLocaleString("en-IN")}</div>
        </article>
      </section>

      <section style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn-muted-action" onClick={handleWeekCompleted}>Week Completed</button>
        <button className="btn-primary-v5" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </section>
    </AccountantShell>
  );
}


