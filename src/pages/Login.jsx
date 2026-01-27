import { useState, useEffect, useRef } from "react";
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

import "./Login.css"; // Updated CSS below

export default function Login() {
  const navigate = useNavigate();
  const circleRef = useRef(null); // Ref for the circle container

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // New state for password toggle

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

  // Toggle password visibility
  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  // Animate bars on mount
  useEffect(() => {
    const circleContainer = circleRef.current;
    const numBars = 50;
    let activeBars = 0;

    // Create bars
    for (let i = 0; i < numBars; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.transform = `rotate(${(360 / numBars) * i}deg) translateY(-170px)`;
      circleContainer.appendChild(bar);
    }

    // Animation function
    const animateBars = () => {
      const bars = circleContainer.querySelectorAll('.bar');
      const interval = setInterval(() => {
        bars[activeBars % numBars].classList.add('active');
        if (activeBars > 8) {
          bars[(activeBars - 8) % numBars].classList.remove('active');
        }
        activeBars++;
      }, 100);
      return interval;
    };

    const intervalId = animateBars();

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
      // Remove bars to prevent duplicates on re-render
      while (circleContainer.firstChild) {
        circleContainer.removeChild(circleContainer.firstChild);
      }
    };
  }, []);

  return (
    <div className="container">
      <div className="circle-container" ref={circleRef}></div>

      <div className="login-box">
        <h2>Login</h2>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <span className="input-icon">
              <i className="fa-solid fa-envelope" style={{ color: '#ffffff' }}></i>
            </span>
          </div>

          <div className="input-group">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span className="input-icon toggle-password" onClick={togglePassword}>
              <i className="fa-solid fa-lock" style={{ color: '#ffffff' }}></i>
            </span>
          </div>

          <div className="forgot-password">
            <button
              type="button"
              onClick={onForgotPassword}
              disabled={loadingReset}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                textDecoration: 'none',
                fontSize: '12px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.target.style.color = '#ffa500')}
              onMouseLeave={(e) => (e.target.style.color = 'rgba(255, 255, 255, 0.6)')}
            >
              {loadingReset ? "Sending..." : "Forgot your password ?"}
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loadingLogin}>
            {loadingLogin ? "Logging in..." : "LOGIN"}
          </button>
        </form>

        <div className="social-login">
          <p>log in with</p>
          <div className="social-icons">
            <div className="social-icon facebook">f</div>
            <div className="social-icon twitter">𝕏</div>
            <div className="social-icon google">G</div>
          </div>
        </div>

        <div className="signup-link">
          <button
            type="button"
            onClick={createEngineerAccount}
            disabled={loadingCreateEngineer}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffa500',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.target.style.color = '#ff8c00')}
            onMouseLeave={(e) => (e.target.style.color = '#ffa500')}
          >
            {loadingCreateEngineer ? "Creating..." : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}