import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

/* ---------- SITES ---------- */

export const addSite = async ({ name, location, createdBy }) => {
  const ref = collection(db, "sites");

  const payload = {
    name: name?.trim(),
    location: location?.trim() || "",
    isCompleted: false,
    createdBy: createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(ref, payload);
  return docRef.id;
};

export const getAllSites = async () => {
  const ref = collection(db, "sites");
  const q = query(ref, orderBy("createdAt", "desc"));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
};

/* ---------- ENGINEER ADD TASK ---------- */

export const addEngineerTask = async ({
  title,
  dayName,
  site,
  engineerUid,
  engineerName,
}) => {
  if (!title || !dayName || !site?.id || !site?.currentWeekKey) {
    throw new Error("Invalid task data");
  }

  const ref = collection(db, "tasks");

  await addDoc(ref, {
    title: title.trim(),
    dayName,

    siteId: site.id,
    siteName: site.name,

    assignedEngineerId: engineerUid,
    assignedEngineerName: engineerName,

    weekKey: site.currentWeekKey,

    status: "PENDING",
    pendingWeeks: 0,

    createdBy: "ENGINEER",
    createdByUid: engineerUid,
    createdByName: engineerName,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    statusUpdatedAt: serverTimestamp(),
  });
};
