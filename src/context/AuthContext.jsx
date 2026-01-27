import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import AppSplash from "../components/AppSplash";
import { getAuth } from "firebase/auth";


const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  // ✅ userDoc will store Firestore users/{uid} data like {name, role, ...}
  const [userDoc, setUserDoc] = useState(null);

  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setUserDoc(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));

        if (snap.exists()) {
          const data = snap.data();
          setUserDoc(data);
          setRole(data.role || null);
        } else {
          setUserDoc(null);
          setRole(null);
        }
      } catch {
        setUserDoc(null);
        setRole(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  if (loading) {
    return <AppSplash />;
  }

  return (
    <AuthContext.Provider value={{ user, role, userDoc }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
