import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { db, getMessagingIfSupported } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

const INSTALLATION_KEY = "rp_push_installation_id_v1";
let foregroundBound = false;

function getOrCreateInstallationId() {
  const existing = localStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  const id = `inst_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  localStorage.setItem(INSTALLATION_KEY, id);
  return id;
}

async function getPushToken() {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  const registration = await navigator.serviceWorker.ready;
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("Missing VITE_FIREBASE_VAPID_KEY");
  }

  return getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
}

export async function registerDevicePushToken({ user, userDoc }) {
  if (!user?.uid) return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

  try {
    if (Notification.permission === "denied") return;
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") return;

    const token = await getPushToken();
    if (!token) return;

    const installationId = getOrCreateInstallationId();
    const ref = doc(db, "users", user.uid);
    await setDoc(
      ref,
      {
        pushToken: token,
        pushTokens: {
          [installationId]: {
            token,
            platform: navigator.userAgent || "unknown",
            updatedAt: new Date().toISOString(),
          },
        },
        pushPermission: permission,
        pushTokenUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    // Keep foreground listener lightweight and non-blocking.
    const messaging = await getMessagingIfSupported();
    if (messaging && !foregroundBound) {
      foregroundBound = true;
      onMessage(messaging, (payload) => {
        const title = payload?.notification?.title || "Notification";
        const body = payload?.notification?.body || "";
        showSuccess(body ? `${title}: ${body}` : title);
      });
    }

    // Avoid noisy toasts for repeated login cycles.
    if (!userDoc?.pushToken) {
      showSuccess("Push notifications enabled");
    }
  } catch (e) {
    // Keep app flow stable if push registration fails.
    showError(e, "Push notification setup failed");
  }
}
