import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  where,
} from "firebase/firestore";
import Layout from "../components/Layout";
import Button from "../components/Button";
import SkeletonBox from "../components/SkeletonBox";
import EmptyState from "../components/EmptyState";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import "./Admin.css";
import "./AdminMaster.css";
import "./ContactDetails.css";

const EMPTY_FORM = {
  name: "",
  profession: "",
  phoneNumber: "",
  alternatePhoneNumber: "",
  notes: "",
};

function isExact10Digits(value) {
  return /^\d{10}$/.test((value || "").trim());
}

function isUpTo15Digits(value) {
  const v = (value || "").trim();
  if (!v) return true;
  return /^\d{1,15}$/.test(v);
}

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

export default function ContactDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user, userDoc } = useAuth();

  const actorUid = user?.uid || "";
  const actorName = userDoc?.name || user?.email || "USER";
  const isAdmin = role === "ADMIN";
  const isEngineer = role === "ENGINEER";
  const isAccountant = role === "ACCOUNTANT";
  const canManage = isAdmin || isEngineer;

  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(
    location.state?.siteId || "",
  );
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editorCategory, setEditorCategory] = useState("LABOUR");
  const [editingContact, setEditingContact] = useState(null);
  const [editorForm, setEditorForm] = useState(EMPTY_FORM);
  const [editorErrors, setEditorErrors] = useState({
    phoneNumber: "",
    alternatePhoneNumber: "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteContact, setConfirmDeleteContact] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const desktopModalOpen = (showEditor || !!confirmDeleteContact)
    && typeof window !== "undefined"
    && window.innerWidth >= 768;

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) || null,
    [sites, selectedSiteId],
  );

  const labourContacts = useMemo(
    () => contacts.filter((c) => c.category === "LABOUR"),
    [contacts],
  );

  const materialContacts = useMemo(
    () => contacts.filter((c) => c.category === "MATERIAL"),
    [contacts],
  );

  const loadSites = async () => {
    try {
      setLoading(true);
      if (isEngineer) {
        const qy = query(
          collection(db, "sites"),
          where("assignedEngineerId", "==", actorUid),
          orderBy("createdAt", "desc"),
        );
        const snap = await getDocs(qy);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSites(list);
        if (!selectedSiteId && list.length > 0) {
          setSelectedSiteId(list[0].id);
        }
        return;
      }

      if (isAdmin || isAccountant) {
        const qy = query(collection(db, "sites"), orderBy("createdAt", "desc"));
        const snap = await getDocs(qy);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSites(list);
        return;
      }

      setSites([]);
    } catch (e) {
      showError(e, "Failed to load sites");
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (siteId) => {
    if (!siteId) {
      setContacts([]);
      return;
    }
    try {
      setContactsLoading(true);
      const ref = collection(db, "sites", siteId, "contacts");
      const snap = await getDocs(query(ref, orderBy("createdAt", "desc")));
      setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showError(e, "Failed to load contacts");
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, [role, actorUid]);

  useEffect(() => {
    if (!selectedSiteId) {
      setContacts([]);
      return;
    }
    loadContacts(selectedSiteId);
  }, [selectedSiteId]);

  useEffect(() => {
    if (!desktopModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [desktopModalOpen]);

  const openAddModal = (category) => {
    setEditorCategory(category);
    setEditingContact(null);
    setEditorForm(EMPTY_FORM);
    setEditorErrors({ phoneNumber: "", alternatePhoneNumber: "" });
    setShowEditor(true);
  };

  const openEditModal = (contact) => {
    setEditorCategory(contact.category || "LABOUR");
    setEditingContact(contact);
    setEditorForm({
      name: contact.name || "",
      profession: contact.profession || "",
      phoneNumber: contact.phoneNumber || "",
      alternatePhoneNumber: contact.alternatePhoneNumber || "",
      notes: contact.notes || "",
    });
    setEditorErrors({ phoneNumber: "", alternatePhoneNumber: "" });
    setShowEditor(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setShowEditor(false);
    setEditingContact(null);
    setEditorForm(EMPTY_FORM);
    setEditorErrors({ phoneNumber: "", alternatePhoneNumber: "" });
  };

  const validateContactForm = (form) => {
    const next = {
      phoneNumber: "",
      alternatePhoneNumber: "",
    };
    if (!isExact10Digits(form.phoneNumber)) {
      next.phoneNumber = "Mobile number must be exactly 10 digits.";
    }
    if (!isUpTo15Digits(form.alternatePhoneNumber)) {
      next.alternatePhoneNumber = "Alternate number can be up to 15 digits only.";
    }
    return next;
  };

  const hasValidationErrors = useMemo(() => {
    return !!(editorErrors.phoneNumber || editorErrors.alternatePhoneNumber);
  }, [editorErrors]);

  const submitEditor = async () => {
    if (!selectedSiteId) return showError(null, "Select site first");
    const payload = {
      name: editorForm.name.trim(),
      profession: editorForm.profession.trim(),
      phoneNumber: editorForm.phoneNumber.trim(),
      alternatePhoneNumber: editorForm.alternatePhoneNumber.trim(),
      notes: editorForm.notes.trim(),
    };
    if (!payload.name || !payload.profession || !payload.phoneNumber) {
      return showError(null, "Name, profession and phone number are required");
    }
    const validation = validateContactForm(payload);
    setEditorErrors(validation);
    if (validation.phoneNumber || validation.alternatePhoneNumber) return;
    try {
      setSaving(true);
      if (editingContact?.id) {
        await updateDoc(doc(db, "sites", selectedSiteId, "contacts", editingContact.id), {
          name: payload.name,
          profession: payload.profession,
          phoneNumber: payload.phoneNumber,
          alternatePhoneNumber: payload.alternatePhoneNumber || "",
          notes: payload.notes || "",
          category: editorCategory,
          updatedAt: serverTimestamp(),
        });
        showSuccess("Contact updated");
      } else {
        await addDoc(collection(db, "sites", selectedSiteId, "contacts"), {
          name: payload.name,
          profession: payload.profession,
          phoneNumber: payload.phoneNumber,
          alternatePhoneNumber: payload.alternatePhoneNumber || "",
          notes: payload.notes || "",
          category: editorCategory,
          createdByName: actorName,
          createdByUid: actorUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showSuccess("Contact added");
      }
      closeEditor();
      await loadContacts(selectedSiteId);
    } catch (e) {
      showError(e, "Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteContact?.id || !selectedSiteId) return;
    try {
      setDeleting(true);
      await deleteDoc(doc(db, "sites", selectedSiteId, "contacts", confirmDeleteContact.id));
      setConfirmDeleteContact(null);
      showSuccess("Contact deleted");
      await loadContacts(selectedSiteId);
    } catch (e) {
      showError(e, "Failed to delete contact");
    } finally {
      setDeleting(false);
    }
  };

  const renderTable = (title, category, rows) => (
    <section className="master-section-card contact-section-card" key={category}>
      <div className="section-header-v3">
        <div className="header-title-group">
          <span className="section-icon">{category === "LABOUR" ? "👷" : "🏗️"}</span>
          <h2 className="section-heading-v3">{title}</h2>
        </div>
        {canManage && (
          <Button className="btn-add-task-pro" onClick={() => openAddModal(category)}>
            {category === "LABOUR" ? "+ Add Labour Contact" : "+ Add Material Contact"}
          </Button>
        )}
      </div>
      <table className="master-data-table">
        <thead>
          <tr>
            <th>Sr No</th>
            <th>Name</th>
            <th>Profession</th>
            <th>Phone</th>
            <th>Alternate</th>
            <th>Notes</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="contact-empty-cell">
                No contacts added yet.
              </td>
            </tr>
          ) : (
            rows.map((contact, index) => (
              <tr key={contact.id}>
                <td data-label="Sr No">{index + 1}</td>
                <td data-label="Name">
                  <div className="contact-name-cell">{contact.name || "-"}</div>
                  <div className="contact-meta-cell">
                    {safeToDate(contact.createdAt)?.toLocaleString("en-GB") || "-"}
                  </div>
                </td>
                <td data-label="Profession">{contact.profession || "-"}</td>
                <td data-label="Phone">{contact.phoneNumber || "-"}</td>
                <td data-label="Alternate">{contact.alternatePhoneNumber || "-"}</td>
                <td data-label="Notes">{contact.notes || "-"}</td>
                <td data-label="Actions" className="actions-cell">
                  {canManage ? (
                    <>
                      <button
                        className="action-icon-btn edit"
                        onClick={() => openEditModal(contact)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-icon-btn delete"
                        onClick={() => setConfirmDeleteContact(contact)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </>
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );

  if (loading) {
    return (
      <Layout>
        <SkeletonBox />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin-dashboard master-page contact-details-page">
        <header className="admin-header-card">
          <div className="header-info">
            <h1 className="header-title">Contact Details</h1>
            <p className="header-subtitle-v3">Site-specific labour and supplier directory</p>
          </div>
          <div className="header-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button
              className="btn-secondary-header"
              onClick={() => navigate(isAdmin ? "/admin" : isEngineer ? "/engineer" : "/accountant/dashboard")}
            >
              ← Dashboard
            </Button>
          </div>
        </header>

        {(isAdmin || isAccountant) && (
          <section className="master-section-card contact-site-selector-card">
            <div className="section-header-v3">
              <div className="header-title-group">
                <span className="section-icon">📍</span>
                <h2 className="section-heading-v3">Site Selection</h2>
              </div>
            </div>
            <div className="contact-site-selector-body">
              <select
                className="stage-select contact-site-select"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
              >
                <option value="">Select site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name || site.id}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {isEngineer && selectedSite && (
          <section className="master-section-card contact-site-selector-card">
            <div className="section-header-v3">
              <div className="header-title-group">
                <span className="section-icon">📍</span>
                <h2 className="section-heading-v3">Assigned Site</h2>
              </div>
            </div>
            <div className="contact-site-selector-body contact-assigned-site">
              <b>{selectedSite.name}</b>
            </div>
          </section>
        )}

        {!selectedSiteId ? (
          <div className="contact-empty-block">
            <EmptyState
              title="Please select a site to view contact details."
              subtitle="Select a site to load labour and material supplier contacts."
            />
          </div>
        ) : contactsLoading ? (
          <SkeletonBox />
        ) : (
          <main className="master-grid contact-grid">
            {renderTable("Labour Contact Details", "LABOUR", labourContacts)}
            {renderTable("Material Supplier Contact Details", "MATERIAL", materialContacts)}
          </main>
        )}
      </div>

      {showEditor && (
        <div className="modal-overlay" onClick={closeEditor}>
          <div className="modal-content modal-contact-editor" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-pro">
              <h3 className="modal-title-main">
                {editingContact ? "Edit Contact" : `Add ${editorCategory === "LABOUR" ? "Labour" : "Material"} Contact`}
              </h3>
              <button
                className="contact-modal-close"
                onClick={closeEditor}
                aria-label="Close"
                type="button"
              >
                ×
              </button>
            </div>
            <div className="form-container-pro">
              <div className="form-group-pro">
                <label className="form-label-pro">Name *</label>
                <input
                  className="form-input-pro"
                  value={editorForm.name}
                  onChange={(e) => setEditorForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="form-group-pro">
                <label className="form-label-pro">Profession *</label>
                <input
                  className="form-input-pro"
                  value={editorForm.profession}
                  onChange={(e) => setEditorForm((p) => ({ ...p, profession: e.target.value }))}
                />
              </div>
              <div className="form-group-pro">
                <label className="form-label-pro">Phone Number *</label>
                <input
                  className="form-input-pro"
                  value={editorForm.phoneNumber}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditorForm((p) => ({ ...p, phoneNumber: value }));
                    setEditorErrors((prev) => ({
                      ...prev,
                      ...validateContactForm({
                        ...editorForm,
                        phoneNumber: value,
                      }),
                    }));
                  }}
                />
                {editorErrors.phoneNumber && (
                  <span className="contact-input-error">{editorErrors.phoneNumber}</span>
                )}
              </div>
              <div className="form-group-pro">
                <label className="form-label-pro">Alternate Phone</label>
                <input
                  className="form-input-pro"
                  value={editorForm.alternatePhoneNumber}
                  onChange={(e) =>
                    {
                      const value = e.target.value;
                      setEditorForm((p) => ({ ...p, alternatePhoneNumber: value }));
                      setEditorErrors((prev) => ({
                        ...prev,
                        ...validateContactForm({
                          ...editorForm,
                          alternatePhoneNumber: value,
                        }),
                      }));
                    }
                  }
                />
                {editorErrors.alternatePhoneNumber && (
                  <span className="contact-input-error">{editorErrors.alternatePhoneNumber}</span>
                )}
              </div>
              <div className="form-group-pro">
                <label className="form-label-pro">Notes</label>
                <textarea
                  className="form-input-pro contact-notes-input"
                  value={editorForm.notes}
                  onChange={(e) => setEditorForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-actions-pro">
              <Button className="btn-ghost-pro" onClick={closeEditor} disabled={saving}>
                Cancel
              </Button>
              <Button
                className="btn-confirm-pro"
                onClick={submitEditor}
                loading={saving}
                disabled={hasValidationErrors}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteContact && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteContact(null)}>
          <div className="modal-content modal-contact-editor confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-pro">
              <h3 className="modal-title-main">Confirm Delete</h3>
              <p className="modal-subtitle">Delete contact "{confirmDeleteContact.name}" permanently?</p>
              <button
                className="contact-modal-close"
                onClick={() => setConfirmDeleteContact(null)}
                aria-label="Close"
                type="button"
              >
                ×
              </button>
            </div>
            <div className="modal-actions-pro">
              <Button
                className="btn-ghost-pro"
                onClick={() => setConfirmDeleteContact(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button className="btn-confirm-pro" onClick={confirmDelete} loading={deleting}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
