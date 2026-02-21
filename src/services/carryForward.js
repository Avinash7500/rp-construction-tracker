// ✅ src/services/carryForward.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { getNextWeekKey } from "../utils/weekUtils";

export async function carryForwardToNextWeek(siteId) {
  const siteRef = doc(db, "sites", siteId);
  const siteSnap = await getDoc(siteRef);

  if (!siteSnap.exists()) throw new Error("Site not found");

  const site = siteSnap.data();

  const currentWeekKey = site.currentWeekKey;
  if (!currentWeekKey) throw new Error("Site currentWeekKey missing");

  const nextWeekKey = getNextWeekKey(currentWeekKey);

  const assignedEngineerId = site.assignedEngineerId || null;
  const assignedEngineerName = site.assignedEngineerName || "";
  const siteName = site.name || "";

  // ✅ Only carry PENDING tasks from current week
  const tasksRef = collection(db, "tasks");
  const q = query(
    tasksRef,
    where("siteId", "==", siteId),
    where("weekKey", "==", currentWeekKey),
    where("status", "==", "PENDING")
  );

  const snap = await getDocs(q);

  const batch = writeBatch(db);

  // ✅ Create fresh tasks in next week
  snap.forEach((t) => {
    const task = t.data();

    const newTaskRef = doc(collection(db, "tasks"));

    batch.set(newTaskRef, {
      siteId,
      siteName,
      assignedEngineerId,
      assignedEngineerName,
      title: task.title,
      status: "PENDING",
      priority: task.priority || "NORMAL",
      pendingWeeks: (task.pendingWeeks || 0) + 1,
      dayName: task.dayName || null,
      expectedCompletionDate: task.expectedCompletionDate || null,
      createdBy: task.createdBy || "ENGINEER",
      createdByUid: task.createdByUid || assignedEngineerId || null,
      createdByName: task.createdByName || assignedEngineerName || "",

      weekKey: nextWeekKey,

      carriedFromTaskId: t.id, // optional but useful
      statusUpdatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // ✅ Update site currentWeekKey
  batch.update(siteRef, {
    currentWeekKey: nextWeekKey,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return {
    from: currentWeekKey,
    to: nextWeekKey,
    carriedCount: snap.size,
  };
}
