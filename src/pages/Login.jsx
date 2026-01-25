import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { auth, db } from "../firebase/firebaseConfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";

import "./Login.css";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingCreateEngineer, setLoadingCreateEngineer] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  const catRef = useRef(null);

  // ✅ cat animation based on password typing
  useEffect(() => {
    if (password.length > 0) {
      catRef.current?.classList.add("password-focused");
    } else {
      catRef.current?.classList.remove("password-focused");
    }
  }, [password]);

  // ✅ Redirect by Firestore role
  const redirectByRole = async (uid) => {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      showError(null, "User profile missing in Firestore. Contact Admin.");
      return;
    }

    const userData = snap.data();

    if (!userData?.isActive) {
      showError(null, "Access disabled. Contact Admin.");
      return;
    }

    if (userData?.role === "ADMIN") {
      navigate("/admin");
    } else {
      navigate("/engineer");
    }
  };

  // ✅ LOGIN
  const handleLogin = async () => {
    if (!email.trim()) return showError(null, "Enter email");
    if (!password.trim()) return showError(null, "Enter password");

    try {
      setLoadingLogin(true);

      const res = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password.trim()
      );

      showSuccess("Login successful ✅");
      await redirectByRole(res.user.uid);
    } catch (error) {
      console.error(error);
      showError(error, "Login failed ❌");
    } finally {
      setLoadingLogin(false);
    }
  };

  // ✅ Create Engineer Account (Dev only)
  const createEngineerAccount = async () => {
    if (!email.trim()) return showError(null, "Enter email");
    if (!password.trim()) return showError(null, "Enter password");

    if (password.trim().length < 6) {
      return showError(null, "Password should be at least 6 characters");
    }

    try {
      setLoadingCreateEngineer(true);

      const res = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password.trim()
      );

      const user = res.user;

      // ✅ create Firestore profile
      await setDoc(doc(db, "users", user.uid), {
        email: user.email || "",
        role: "ENGINEER", // ✅ default
        name: "",
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showSuccess("Engineer account created ✅");
      navigate("/engineer");
    } catch (error) {
      console.error(error);

      if (error?.code === "auth/email-already-in-use") {
        showError(null, "Email already exists. Please login.");
        return;
      }

      showError(error, "Signup failed ❌");
    } finally {
      setLoadingCreateEngineer(false);
    }
  };

  // ✅ Forgot password reset
  const onForgotPassword = async () => {
    if (!email.trim()) {
      return showError(null, "Enter your email first");
    }

    try {
      setLoadingReset(true);
      await sendPasswordResetEmail(auth, email.trim());
      showSuccess("Password reset email sent ✅");
    } catch (error) {
      console.error(error);
      showError(error, "Failed to send reset email");
    } finally {
      setLoadingReset(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        {/* 🐱 CAT */}
        <div className="cat-container" ref={catRef}>
          <div className="cat-face">
            <div className="cat-ear-left"></div>
            <div className="cat-ear-right"></div>
            <div className="cat-head"></div>
            <div className="cat-eye-left"></div>
            <div className="cat-eye-right"></div>
            <div className="cat-nose"></div>
            <div className="cat-mouth"></div>
            <div className="cat-paw cat-paw-left"></div>
            <div className="cat-paw cat-paw-right"></div>
          </div>
        </div>

        <h2>R.P. CONSTRUCTION</h2>

        <input
          type="email"
          placeholder="Enter email (e.g. admin@rp.com)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* ✅ Login */}
        <button onClick={handleLogin} disabled={loadingLogin}>
          {loadingLogin ? "Logging in..." : "Login"}
        </button>

        {/* ✅ Forgot password */}
        <button
          onClick={onForgotPassword}
          disabled={loadingReset}
          style={{ marginTop: 8 }}
        >
          {loadingReset ? "Sending..." : "Forgot Password"}
        </button>

        {/* ✅ Create Engineer */}
        <button
          onClick={createEngineerAccount}
          disabled={loadingCreateEngineer}
          style={{ marginTop: 8 }}
        >
          {loadingCreateEngineer ? "Creating..." : "Create Engineer Account (Dev)"}
        </button>

        {/* ✅ Phone OTP code kept for future (commented) */}
        {/*
          Phone OTP will be re-enabled after Billing is enabled.
        */}
      </div>
    </div>
  );
}
