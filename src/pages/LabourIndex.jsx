import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import Layout from "../components/Layout";
import Button from "../components/Button";

function LabourIndex() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const [site, setSite] = useState(null);
  const [workTypes, setWorkTypes] = useState(["Tiles", "Bilal", "Department", "RCC"]); // Default dynamic list
  const [newType, setNewType] = useState("");

  useEffect(() => {
    const fetchSite = async () => {
      const snap = await getDoc(doc(db, "sites", siteId));
      if (snap.exists()) setSite(snap.data());
    };
    fetchSite();
  }, [siteId]);

  const addWorkType = () => {
    if (newType.trim() && !workTypes.includes(newType)) {
      setWorkTypes([...workTypes, newType.trim()]);
      setNewType("");
    }
  };

  return (
    <Layout>
      <div className="admin-dashboard">
        <div className="sticky-back-header-v5">
          <button className="btn-back-pro" onClick={() => navigate(`/accountant/site/${siteId}`)}>
            <span className="back-icon">←</span>
            <div className="back-text"><span className="back-label">Back to Site Detail</span></div>
          </button>
          <div className="engineer-badge-pill">
             <div className="badge-content-v5">
               <span className="eng-label-v5">Labour Sheets</span>
               <h2 className="eng-name-v5">{site?.name}</h2>
             </div>
          </div>
        </div>

        <div className="task-creation-panel" style={{ maxWidth: '500px', margin: '2rem auto' }}>
          <div className="panel-header-pro">
            <h3 className="panel-title-pro">Open or Create Work Sheet</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {workTypes.map(type => (
              <button 
                key={type} 
                className="btn-muted-action" 
                style={{ textAlign: 'left', padding: '15px', fontSize: '1rem', background: 'white' }}
                onClick={() => navigate(`/accountant/site/${siteId}/labour/${type}`)}
              >
                📁 {type} Sheet
              </button>
            ))}
          </div>
          
          <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px', display: 'flex', gap: '10px' }}>
            <input 
              className="task-input-pro-v2" 
              placeholder="Add New Type (e.g. Plumbing)" 
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            />
            <Button onClick={addWorkType}>Add</Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default LabourIndex;