import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import Button from "./Button";
import "./SiteContactsModal.css";

function safeToDate(value) {
  if (!value) return null;
  try {
    if (typeof value?.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function fmtDateTime(value) {
  const d = safeToDate(value);
  if (!d) return "-";
  return d.toLocaleString("en-GB");
}

const EMPTY_FORM = {
  name: "",
  profession: "",
  phoneNumber: "",
  alternatePhoneNumber: "",
  notes: "",
};

export default function SiteContactsModal({
  isOpen,
  onClose,
  siteId,
  siteName,
  canManage = false,
  actorUid = "",
  actorName = "",
}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const modalTitle = useMemo(() => {
    const suffix = siteName ? ` - ${siteName}` : "";
    return `Site Contacts${suffix}`;
  }, [siteName]);

  const loadContacts = async () => {
    if (!siteId || !isOpen) return;
    try {
      setLoading(true);
      const ref = collection(db, "sites", siteId, "contacts");
      const snap = await getDocs(query(ref, orderBy("createdAt", "desc")));
      setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showError(e, "Failed to load site contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadContacts();
  }, [isOpen, siteId]);

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingContact(null);
    setForm(EMPTY_FORM);
  };

  const openAddForm = () => {
    setEditingContact(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (contact) => {
    setEditingContact(contact);
    setForm({
      name: contact?.name || "",
      profession: contact?.profession || "",
      phoneNumber: contact?.phoneNumber || "",
      alternatePhoneNumber: contact?.alternatePhoneNumber || "",
      notes: contact?.notes || "",
    });
    setShowForm(true);
  };

  const saveContact = async () => {
    const payload = {
      name: form.name.trim(),
      profession: form.profession.trim(),
      phoneNumber: form.phoneNumber.trim(),
      alternatePhoneNumber: form.alternatePhoneNumber.trim(),
      notes: form.notes.trim(),
    };

    if (!payload.name || !payload.profession || !payload.phoneNumber) {
      showError(null, "Name, profession and phone number are required");
      return;
    }

    try {
      setSaving(true);
      if (editingContact?.id) {
        const ref = doc(db, "sites", siteId, "contacts", editingContact.id);
        await updateDoc(ref, {
          name: payload.name,
          profession: payload.profession,
          phoneNumber: payload.phoneNumber,
          alternatePhoneNumber: payload.alternatePhoneNumber || "",
          notes: payload.notes || "",
          updatedAt: serverTimestamp(),
        });
        showSuccess("Contact updated");
      } else {
        const ref = collection(db, "sites", siteId, "contacts");
        await addDoc(ref, {
          name: payload.name,
          profession: payload.profession,
          phoneNumber: payload.phoneNumber,
          alternatePhoneNumber: payload.alternatePhoneNumber || "",
          notes: payload.notes || "",
          createdByName: actorName || "USER",
          createdByUid: actorUid || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showSuccess("Contact added");
      }
      closeForm();
      await loadContacts();
    } catch (e) {
      showError(e, "Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (contact) => {
    if (!contact?.id) return;
    if (!window.confirm(`Delete contact "${contact.name || "Unnamed"}"?`)) return;
    try {
      setDeletingId(contact.id);
      const ref = doc(db, "sites", siteId, "contacts", contact.id);
      await deleteDoc(ref);
      showSuccess("Contact deleted");
      await loadContacts();
    } catch (e) {
      showError(e, "Failed to delete contact");
    } finally {
      setDeletingId("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="site-contacts-overlay" onClick={onClose}>
      <div className="site-contacts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="site-contacts-header">
          <h3>{modalTitle}</h3>
          <div className="site-contacts-actions">
            {canManage && (
              <Button className="btn-add-task-pro" onClick={openAddForm}>
                + Add Contact
              </Button>
            )}
            <button className="btn-muted-action" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {loading ? (
          <div className="site-contacts-empty">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="site-contacts-empty">No contacts added for this site.</div>
        ) : (
          <div className="site-contacts-table-wrap">
            <table className="site-contacts-table">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Name</th>
                  <th>Profession</th>
                  <th>Contact Details</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, index) => (
                  <tr key={c.id}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="site-contacts-name">{c.name || "-"}</div>
                      <div className="site-contacts-meta">
                        By {c.createdByName || "-"} | {fmtDateTime(c.createdAt)}
                      </div>
                    </td>
                    <td>{c.profession || "-"}</td>
                    <td>
                      <div>{c.phoneNumber || "-"}</div>
                      {c.alternatePhoneNumber ? (
                        <div className="site-contacts-alt">{c.alternatePhoneNumber}</div>
                      ) : (
                        <div className="site-contacts-alt">-</div>
                      )}
                    </td>
                    <td>{c.notes || "-"}</td>
                    <td>
                      {canManage ? (
                        <div className="site-contacts-row-actions">
                          <button className="btn-muted-action" onClick={() => openEditForm(c)}>
                            Edit
                          </button>
                          <button
                            className="btn-pro-action btn-delete"
                            onClick={() => deleteContact(c)}
                            disabled={deletingId === c.id}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <div className="site-contacts-form-backdrop">
            <div className="site-contacts-form-modal">
              <h4>{editingContact ? "Edit Contact" : "Add Contact"}</h4>
              <div className="site-contacts-form-grid">
                <label>
                  Name *
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Profession *
                  <input
                    value={form.profession}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, profession: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Phone Number *
                  <input
                    value={form.phoneNumber}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Alternate Phone
                  <input
                    value={form.alternatePhoneNumber}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        alternatePhoneNumber: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="site-contacts-notes-field">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="site-contacts-form-actions">
                <button className="btn-muted-action" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <Button className="btn-add-task-pro" loading={saving} onClick={saveContact}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

