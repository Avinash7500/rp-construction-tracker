import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { registerDevicePushToken } from "../services/pushNotifications";

export default function NotificationBootstrap() {
  const { user, userDoc } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;
    registerDevicePushToken({ user, userDoc });
  }, [user?.uid]);

  return null;
}
