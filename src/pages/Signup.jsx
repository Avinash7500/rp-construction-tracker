// src/pages/Signup.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { showError } from "../utils/showError";
import { showSuccess } from "../utils/showSuccess";
import "./Login.css"; 

export default function Signup() { // This is already a default export
  const navigate = useNavigate();
  const circleRef = useRef(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ENGINEER");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return showError(null, "All fields required");
    if (password.length < 6) return showError(null, "Password too short");

    try {
      setLoading(true);
      const res = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
      
      await setDoc(doc(db, "users", res.user.uid), {
        name: name.trim(),
        email: email.trim(),
        role: role,
        isActive: false, 
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      showSuccess("Request Sent! Admin will approve soon.");
      navigate("/login");
    } catch (error) {
      showError(error, "Registration failed");
    } finally {
      setLoading(false);
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
        <h2>Sign Up</h2>
        <form onSubmit={handleSignup}>
          <div className="input-group">
            <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="input-group">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          
          <div style={{ marginBottom: '25px' }}>
            <p style={{ color: '#ffa500', fontSize: '12px', fontWeight: '600', marginBottom: '10px', textAlign: 'center' }}>SELECT YOUR ROLE</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className={`role-select-btn ${role === 'ENGINEER' ? 'active' : ''}`} onClick={() => setRole("ENGINEER")}>Engineer</button>
              <button type="button" className={`role-select-btn ${role === 'ACCOUNTANT' ? 'active' : ''}`} onClick={() => setRole("ACCOUNTANT")}>Accountant</button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Registering..." : "SUBMIT REQUEST"}
          </button>
        </form>
        <div className="signup-link">
          <button type="button" className="reset-btn-link" onClick={() => navigate("/login")}>Already have an account? Login</button>
        </div>
      </div>
      <style>{`
        .role-select-btn {
          flex: 1;
          padding: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 20px;
          color: white;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.3s;
        }
        .role-select-btn.active {
          background: #ffa500;
          border-color: #ffa500;
          font-weight: bold;
          box-shadow: 0 0 15px rgba(255, 165, 0, 0.4);
        }
      `}</style>
    </div>
  );
}

// REMOVE THE LINE BELOW
// export default Signup;