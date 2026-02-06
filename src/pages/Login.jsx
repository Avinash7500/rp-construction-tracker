// src/pages/Login.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const circleRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  const redirectByRole = async (uid) => {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        showError(null, "User profile missing. Contact Admin.");
        return;
      }

      const userData = snap.data();
      if (!userData?.isActive) {
        showError(null, "Access pending Admin approval.");
        return;
      }

      const role = userData?.role?.toUpperCase();
      if (role === "ADMIN") navigate("/admin");
      else if (role === "ACCOUNTANT") navigate("/accountant/dashboard");
      else if (role === "ENGINEER") navigate("/engineer");
      else showError(null, "Unknown role. Contact Admin.");
    } catch (e) {
      showError(e, "Role identification failed");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return showError(null, "Missing credentials");

    try {
      setLoadingLogin(true);
      const res = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      showSuccess("Welcome back!");
      await redirectByRole(res.user.uid);
    } catch (error) {
      showError(error, "Login failed");
    } finally {
      setLoadingLogin(false);
    }
  };

  const onForgotPassword = async () => {
    if (!email.trim()) return showError(null, "Enter email first");
    try {
      setLoadingReset(true);
      await sendPasswordResetEmail(auth, email.trim());
      showSuccess("Reset email sent!");
    } catch (error) {
      showError(error, "Reset failed");
    } finally {
      setLoadingReset(false);
    }
  };

  useEffect(() => {
    const circleContainer = circleRef.current;
    if (!circleContainer) return;
    const numBars = 50;
    let activeBars = 0;
    for (let i = 0; i < numBars; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.transform = `rotate(${(360 / numBars) * i}deg) translateY(-170px)`;
      circleContainer.appendChild(bar);
    }
    const intervalId = setInterval(() => {
      const bars = circleContainer.querySelectorAll('.bar');
      if (bars.length > 0) {
        bars[activeBars % numBars].classList.add('active');
        if (activeBars > 8) bars[(activeBars - 8) % numBars].classList.remove('active');
        activeBars++;
      }
    }, 100);
    return () => {
      clearInterval(intervalId);
      while (circleContainer.firstChild) circleContainer.removeChild(circleContainer.firstChild);
    };
  }, []);

  return (
    <div className="container">
      <div className="circle-container" ref={circleRef}></div>
      <div className="login-box">
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <span className="input-icon"><i className="fa-solid fa-envelope"></i></span>
          </div>
          <div className="input-group">
            <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <span className="input-icon toggle-password" onClick={() => setShowPassword(!showPassword)}><i className="fa-solid fa-lock"></i></span>
          </div>
          <div className="forgot-password">
            <button type="button" onClick={onForgotPassword} disabled={loadingReset} className="reset-btn-link">
              {loadingReset ? "Sending..." : "Forgot password?"}
            </button>
          </div>
          <button type="submit" className="login-btn" disabled={loadingLogin}>
            {loadingLogin ? "Logging in..." : "LOGIN"}
          </button>
        </form>
        <div className="signup-link">
          <p style={{color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '10px'}}>New to RP Construction?</p>
          <button type="button" className="signup-btn-link" onClick={() => navigate("/signup")}>Create Account</button>
        </div>
      </div>
    </div>
  );
}