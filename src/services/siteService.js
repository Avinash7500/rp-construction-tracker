import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";

// ✅ Add new Site
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

// ✅ Get all Sites
export const getAllSites = async () => {
  const ref = collection(db, "sites");
  const q = query(ref, orderBy("createdAt", "desc"));

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
};
