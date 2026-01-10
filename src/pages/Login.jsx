import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { auth, db } from "../firebase/firebaseConfig";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import "./Login.css";

export default function Login() {
  const navigate = useNavigate();

  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);

  const catRef = useRef(null);
  const recaptchaRef = useRef(null);

  /* 🔐 Setup reCAPTCHA (SAFE for Firebase v9 + StrictMode) */
  useEffect(() => {
    if (!recaptchaRef.current) return;

    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        recaptchaRef.current,
        {
          size: "invisible",
        }
      );

      window.recaptchaVerifier.render();
    }
  }, []);

  /* 🙈 Cat closes eyes while typing OTP */
  useEffect(() => {
    if (showOtp && otp.length > 0) {
      catRef.current?.classList.add("password-focused");
    } else {
      catRef.current?.classList.remove("password-focused");
    }
  }, [otp, showOtp]);

  /* 📱 SEND OTP */
  const sendOtp = async () => {
    if (!mobile) {
      alert("Enter mobile number");
      return;
    }

    try {
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        mobile,
        window.recaptchaVerifier
      );

      window.confirmationResult = confirmationResult;
      setShowOtp(true);
      alert("OTP Sent");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  /* ✅ VERIFY OTP + FIRESTORE ROLE LOGIC */
  const verifyOtp = async () => {
    if (!otp) {
      alert("Enter OTP");
      return;
    }

    try {
      const result = await window.confirmationResult.confirm(otp);
      const user = result.user;

      const uid = user.uid;
      const phone = user.phoneNumber;

      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);

      // Auto create user on first login
      if (!snap.exists()) {
        await setDoc(userRef, {
          phone,
          role: "ENGINEER", // default
          isActive: true,
          createdAt: serverTimestamp(),
        });
      }

      const userData = (await getDoc(userRef)).data();

      if (!userData.isActive) {
        alert("Access disabled. Contact Admin.");
        return;
      }

      if (userData.role === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/engineer");
      }
    } catch (error) {
      console.error(error);
      alert("Invalid OTP ❌");
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

        {/* 📱 MOBILE */}
        <input
          type="tel"
          placeholder="+91XXXXXXXXXX"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
        />

        {!showOtp && (
          <button onClick={sendOtp}>Send OTP</button>
        )}

        {/* 🔐 OTP */}
        {showOtp && (
          <>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
            />
            <button onClick={verifyOtp}>Verify OTP</button>
          </>
        )}

        {/* Firebase requires this */}
        <div ref={recaptchaRef}></div>
      </div>
    </div>
  );
}
