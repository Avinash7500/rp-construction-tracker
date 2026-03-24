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
  where,
} from "firebase/firestore";
import AccountantShell from "../components/AccountantShell";
import SkeletonBox from "../components/SkeletonBox";
import { db } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import { generateDealerPdf } from "../utils/pdf/dealerPdf";

function resolveBillAmount(entry) {
  if (typeof entry.billAmount === "number") return entry.billAmount;
  return (entry.qty || 0) * (entry.rate || 0);
}

export default function DealerLedger() {
  const { dealerId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dealer, setDealer] = useState(null);
  const [materialRows, setMaterialRows] = useState([]);
  const [siteMap, setSiteMap] = useState({});
  const [payments, setPayments] = useState([]);
  const [payingEntryId, setPayingEntryId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  const loadLedger = async () => {
    try {
      setLoading(true);
      const dealerSnap = await getDoc(doc(db, "dealers", dealerId));
      if (!dealerSnap.exists()) {
        setDealer(null);
        return;
      }
      const dealerData = { id: dealerSnap.id, ...dealerSnap.data() };
      setDealer(dealerData);

      const [siteSnap, materialSnap, paymentSnap] = await Promise.all([
        getDocs(collection(db, "sites")),
        getDocs(collection(db, "material_entries")),
        getDocs(query(collection(db, "dealer_payments"), where("dealerId", "==", dealerId))),
      ]);

      const map = {};
      siteSnap.forEach((d) => {
        map[d.id] = d.data().name || d.id;
      });
      setSiteMap(map);

      const rows = materialSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((entry) => entry.dealerId === dealerData.id || entry.dealerName === dealerData.name)
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      setMaterialRows(rows);
      setPayments(paymentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showError(e, "Failed to load dealer ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [dealerId]);

  const paidByEntry = useMemo(() => {
    return payments.reduce((acc, p) => {
      const key = p.materialEntryId || "";
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + (p.paymentAmount || 0);
      return acc;
    }, {});
  }, [payments]);

  const decoratedRows = useMemo(() => {
    return materialRows.map((row) => {
      const bill = resolveBillAmount(row);
      const paid = typeof paidByEntry[row.id] === "number" ? paidByEntry[row.id] : (row.paidAmount || 0);
      return {
        ...row,
        billAmount: bill,
        totalPaid: paid,
        pending: bill - paid,
      };
    });
  }, [materialRows, paidByEntry]);

  const summary = useMemo(() => {
    return decoratedRows.reduce((acc, row) => {
      acc.bill += row.billAmount;
      acc.paid += row.totalPaid;
      return acc;
    }, { bill: 0, paid: 0 });
  }, [decoratedRows]);

  const savePayment = async () => {
    const parsedAmount = Number(paymentAmount);
    if (!payingEntryId) return showError(null, "Select a material row for payment");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return showError(null, "Payment amount must be greater than zero");
    }
    try {
      setSaveLoading(true);
      const entry = materialRows.find((r) => r.id === payingEntryId);
      await addDoc(collection(db, "dealer_payments"), {
        dealerId,
        siteId: entry?.siteId || "",
        materialEntryId: payingEntryId,
        paymentAmount: parsedAmount,
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: paymentNote.trim(),
        createdAt: serverTimestamp(),
      });
      showSuccess("Payment added");
      setPayingEntryId("");
      setPaymentAmount("");
      setPaymentNote("");
      await loadLedger();
    } catch (e) {
      showError(e, "Failed to save payment");
    } finally {
      setSaveLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!dealer) return;
    await generateDealerPdf({
      dealerName: dealer.name || "-",
      dealerPhone: dealer.phone || "-",
      rows: decoratedRows.map((row) => ({
        date: row.date || "-",
        site: siteMap[row.siteId] || row.siteId || "-",
        details: row.details || "-",
        bill: row.billAmount,
        paid: row.totalPaid,
        pending: row.pending,
      })),
    });
  };

  if (loading) {
    return (
      <AccountantShell title="Dealer Ledger">
        <SkeletonBox />
      </AccountantShell>
    );
  }

  if (!dealer) {
    return (
      <AccountantShell title="Dealer Ledger">
        <section className="acc-card">
          <div className="acc-card-body">Dealer not found.</div>
        </section>
      </AccountantShell>
    );
  }

  const pending = summary.bill - summary.paid;

  return (
    <AccountantShell
      title={`${dealer.name} Ledger`}
      subtitle="Vendor purchase, payment and pending reconciliation"
      actions={(
        <>
          <button className="btn-muted-action" onClick={() => navigate("/accountant/dealers")}>
            Back
          </button>
          <button className="btn-primary-v5" onClick={exportPdf}>Generate PDF</button>
        </>
      )}
    >
      <section className="acc-grid-3">
        <article className="acc-stat-card">
          <div className="acc-stat-label">Total Material Purchase</div>
          <div className="acc-stat-value">₹ {summary.bill.toLocaleString("en-IN")}</div>
        </article>
        <article className="acc-stat-card">
          <div className="acc-stat-label">Total Paid</div>
          <div className="acc-stat-value">₹ {summary.paid.toLocaleString("en-IN")}</div>
        </article>
        <article className="acc-stat-card">
          <div className="acc-stat-label">Pending Amount</div>
          <div className="acc-stat-value">₹ {pending.toLocaleString("en-IN")}</div>
        </article>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Add Payment</h3>
        </div>
        <div className="acc-card-body" style={{ display: "grid", gap: 10, gridTemplateColumns: "1.3fr 0.7fr 1fr auto" }}>
          <select
            className="stage-select"
            value={payingEntryId}
            onChange={(e) => setPayingEntryId(e.target.value)}
          >
            <option value="">Select Material Entry</option>
            {decoratedRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.date || "-"} | {siteMap[row.siteId] || row.siteId} | Pending ₹ {Math.max(0, row.pending).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
          <input
            className="task-input-pro-v2"
            placeholder="Payment Amount"
            type="number"
            min="0"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
          <input
            className="task-input-pro-v2"
            placeholder="Notes (optional)"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
          />
          <button className="btn-primary-v5" onClick={savePayment} disabled={saveLoading}>
            {saveLoading ? "Saving..." : "Add Payment"}
          </button>
        </div>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Ledger Entries</h3>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0 }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th>Material Details</th>
                <th className="acc-right">Bill</th>
                <th className="acc-right">Paid</th>
                <th className="acc-right">Pending</th>
              </tr>
            </thead>
            <tbody>
              {decoratedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                    No material transactions for this dealer.
                  </td>
                </tr>
              ) : decoratedRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date || "-"}</td>
                  <td>{siteMap[row.siteId] || row.siteId || "-"}</td>
                  <td>{row.details || "-"}</td>
                  <td className="acc-right">₹ {row.billAmount.toLocaleString("en-IN")}</td>
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
