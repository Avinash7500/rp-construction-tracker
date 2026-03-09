import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { db, getMessagingIfSupported } from "../firebase/firebaseConfig";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

const INSTALLATION_KEY = "rp_push_installation_id_v1";
let foregroundBound = false;

async function showForegroundSystemNotification(payload) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const title = payload?.notification?.title || payload?.data?.title || "RP Construction Tracker";
  const body = payload?.notification?.body || payload?.data?.body || "";
  const link = payload?.fcmOptions?.link || payload?.data?.link || "/engineer";
  const icon = payload?.notification?.icon || "/icons/icon-192.png";

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon,
      data: { link },
      tag: `rp-foreground-${Date.now()}`,
    });
  } catch {
    // Avoid breaking app flow if browser blocks foreground system notification.
  }
}

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
      onMessage(messaging, async (payload) => {
        const title = payload?.notification?.title || "Notification";
        const body = payload?.notification?.body || "";
        await showForegroundSystemNotification(payload);
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
