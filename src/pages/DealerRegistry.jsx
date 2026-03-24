import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import AccountantShell from "../components/AccountantShell";
import { db } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

function getBillAmount(entry) {
  if (typeof entry.billAmount === "number") return entry.billAmount;
  return (entry.qty || 0) * (entry.rate || 0);
}

export default function DealerRegistry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dealers, setDealers] = useState([]);
  const [materialEntries, setMaterialEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [newDealerName, setNewDealerName] = useState("");
  const [newDealerPhone, setNewDealerPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dealerSnap, materialSnap, paymentSnap] = await Promise.all([
        getDocs(query(collection(db, "dealers"), orderBy("name", "asc"))),
        getDocs(collection(db, "material_entries")),
        getDocs(collection(db, "dealer_payments")),
      ]);
      setDealers(dealerSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMaterialEntries(materialSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPayments(paymentSnap.docs.map((d) => d.data()));
    } catch (e) {
      showError(e, "Failed to load dealers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summaryRows = useMemo(() => {
    const paidByMaterialEntry = payments.reduce((acc, row) => {
      const key = row.materialEntryId || "";
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + (row.paymentAmount || 0);
      return acc;
    }, {});

    return dealers.map((dealer) => {
      const rows = materialEntries.filter((entry) => {
        return entry.dealerId === dealer.id || entry.dealerName === dealer.name;
      });
      const totalPurchase = rows.reduce((sum, entry) => sum + getBillAmount(entry), 0);
      const totalPaid = rows.reduce((sum, entry) => {
        const paidFromPayments = paidByMaterialEntry[entry.id];
        if (typeof paidFromPayments === "number") return sum + paidFromPayments;
        return sum + (entry.paidAmount || 0);
      }, 0);
      return {
        ...dealer,
        totalPurchase,
        totalPaid,
        pending: totalPurchase - totalPaid,
      };
    });
  }, [dealers, materialEntries, payments]);

  const handleAddDealer = async () => {
    const name = newDealerName.trim();
    if (!name) return showError(null, "Dealer name is required");
    try {
      setSaving(true);
      await addDoc(collection(db, "dealers"), {
        name,
        phone: newDealerPhone.trim(),
        createdAt: serverTimestamp(),
      });
      setNewDealerName("");
      setNewDealerPhone("");
      showSuccess("Dealer added");
      await loadData();
    } catch (e) {
      showError(e, "Failed to add dealer");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDealer = async (dealer) => {
    if (!window.confirm("Are you sure you want to delete this dealer?")) return;
    if (!window.confirm("Warning: This action cannot be undone.\nAre you absolutely sure you want to permanently delete this dealer?")) return;
    try {
      await deleteDoc(doc(db, "dealers", dealer.id));
      showSuccess("Dealer deleted");
      await loadData();
    } catch (e) {
      showError(e, "Failed to delete dealer");
    }
  };

  return (
    <AccountantShell
      title="Dealers Ledger"
      subtitle="Vendor purchase and payment summary"
      actions={(
        <button className="btn-primary-v5" onClick={loadData}>
          Refresh
        </button>
      )}
    >
      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Add Dealer</h3>
        </div>
        <div className="acc-card-body" style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto" }}>
          <input
            className="task-input-pro-v2"
            placeholder="Dealer Name"
            value={newDealerName}
            onChange={(e) => setNewDealerName(e.target.value)}
          />
          <input
            className="task-input-pro-v2"
            placeholder="Phone Number"
            value={newDealerPhone}
            onChange={(e) => setNewDealerPhone(e.target.value)}
          />
          <button className="btn-primary-v5" onClick={handleAddDealer} disabled={saving}>
            {saving ? "Saving..." : "Add Dealer"}
          </button>
        </div>
      </section>

      <section className="acc-card">
        <div className="acc-card-header">
          <h3 style={{ margin: 0 }}>Dealers Table</h3>
        </div>
        <div className="acc-card-body" style={{ paddingTop: 0 }}>
          <table className="acc-table">
            <thead>
              <tr>
                <th>Dealer Name</th>
                <th className="acc-right">Total Purchase</th>
                <th className="acc-right">Total Paid</th>
                <th className="acc-right">Pending</th>
                <th className="acc-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5}>Loading...</td>
                </tr>
              ) : summaryRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                    No dealers found.
                  </td>
                </tr>
              ) : summaryRows.map((dealer) => (
                <tr key={dealer.id}>
                  <td>
                    <strong>{dealer.name}</strong>
                    <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{dealer.phone || "-"}</div>
                  </td>
                  <td className="acc-right">₹ {dealer.totalPurchase.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {dealer.totalPaid.toLocaleString("en-IN")}</td>
                  <td className="acc-right">₹ {dealer.pending.toLocaleString("en-IN")}</td>
                  <td className="acc-right">
                    <button
                      className="btn-muted-action"
                      onClick={() => navigate(`/accountant/dealer/${dealer.id}`)}
                      style={{ marginRight: 8 }}
                    >
                      Open
                    </button>
                    <button className="btn-muted-action" onClick={() => handleDeleteDealer(dealer)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AccountantShell>
  );
}
