import { useState } from "react";
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

import "./Login.css"; // Assuming you add the CSS below to Login.css

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [light, setLight] = useState(0); // For slider

  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingCreateEngineer, setLoadingCreateEngineer] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

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
  const handleLogin = async (event) => {
    event.preventDefault();
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
    <div className="login-container" data-light={light}>
      {/* Slider form above lamp */}
      <form className="slider-form">
        <div className="icon sun">
          <div className="ray"></div>
          <div className="ray"></div>
          <div className="ray"></div>
          <div className="ray"></div>
          <div className="ray"></div>
          <div className="ray"></div>
          <div className="ray"></div>
          <div className="ray"></div>
        </div>
        <input
          type="range"
          id="slider"
          value={light}
          min="0"
          max="10"
          onChange={(e) => setLight(e.target.value)}
        />
      </form>

      {/* Lamp in the center */}
      <div className="lamp-wrapper">
        <div className="lamp-rope"></div>
        <div className="lamp">
          <div className="lamp-part -top">
            <div className="lamp-part -top-part"></div>
            <div className="lamp-part -top-part right"></div>
          </div>
          <div className="lamp-part -body"></div>
          <div className="lamp-part -body right"></div>
          <div className="lamp-part -bottom"></div>
          <div className="blub"></div>
        </div>
        <div className="wall-light-shadow"></div>
      </div>

      {/* Login form below lamp */}
      <div className="login-form">
        <h2>Welcome</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-btn" disabled={loadingLogin}>
            {loadingLogin ? "Logging in..." : "Login"}
          </button>
          {/* Additional buttons */}
          <button
            type="button"
            onClick={onForgotPassword}
            disabled={loadingReset}
            className="login-btn"
            style={{ marginTop: 8 }}
          >
            {loadingReset ? "Sending..." : "Forgot Password"}
          </button>
          <button
            type="button"
            onClick={createEngineerAccount}
            disabled={loadingCreateEngineer}
            className="login-btn"
            style={{ marginTop: 8 }}
          >
            {loadingCreateEngineer ? "Creating..." : "Create Engineer Account (Dev)"}
          </button>
        </form>
      </div>
    </div>
  );
}