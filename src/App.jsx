// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup"; // ✅ Added Signup import
import Admin from "./pages/Admin";
import Engineer from "./pages/Engineer";
import Reports from "./pages/Reports";
import ReportsAdvanced from "./pages/ReportsAdvanced";
import ReportsSnapshots from "./pages/ReportsSnapshots";
import ReportsSnapshotDetails from "./pages/ReportsSnapshotDetails";
import AdminMaster from "./pages/AdminMaster";
import ProtectedRoute from "./components/ProtectedRoute";

// ✅ Accountant MIS Module Imports
import AccountantDashboard from "./pages/AccountantDashboard";
import AccountantSiteDetail from "./pages/AccountantSiteDetail";
import LabourIndex from "./pages/LabourIndex";
import LabourSheet from "./pages/LabourSheet";
import MaterialSheet from "./pages/MaterialSheet";

export default function App() {
  return (
    <Routes>
      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} /> {/* ✅ Added Signup Route */}

      {/* Accountant MIS Module */}
      <Route
        path="/accountant/dashboard"
        element={
          <ProtectedRoute allowedRoles={["ACCOUNTANT", "ADMIN"]}>
            <AccountantDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/accountant/site/:siteId"
        element={
          <ProtectedRoute allowedRoles={["ACCOUNTANT", "ADMIN"]}>
            <AccountantSiteDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/accountant/site/:siteId/labour"
        element={
          <ProtectedRoute allowedRoles={["ACCOUNTANT", "ADMIN"]}>
            <LabourIndex />
          </ProtectedRoute>
        }
      />

      <Route
        path="/accountant/site/:siteId/labour/:workType"
        element={
          <ProtectedRoute allowedRoles={["ACCOUNTANT", "ADMIN"]}>
            <LabourSheet />
          </ProtectedRoute>
        }
      />

      <Route 
        path="/accountant/site/:siteId/material" 
        element={
          <ProtectedRoute allowedRoles={["ACCOUNTANT", "ADMIN"]}>
            <MaterialSheet />
          </ProtectedRoute>
        } 
      />

      {/* Admin Master Management */}
      <Route
        path="/admin/master"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminMaster />
          </ProtectedRoute>
        }
      />

      {/* Admin Dashboard */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <Admin />
          </ProtectedRoute>
        }
      />

      {/* Live Reports */}
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <Reports />
          </ProtectedRoute>
        }
      />

      {/* Advanced Reports */}
      <Route
        path="/admin/reports/advanced"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <ReportsAdvanced />
          </ProtectedRoute>
        }
      />

      {/* Snapshots list */}
      <Route
        path="/admin/reports/snapshots"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <ReportsSnapshots />
          </ProtectedRoute>
        }
      />

      {/* Snapshot details */}
      <Route
        path="/admin/reports/snapshots/:weekKey"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <ReportsSnapshotDetails />
          </ProtectedRoute>
        }
      />

      {/* Engineer Dashboard */}
      <Route
        path="/engineer"
        element={
          <ProtectedRoute allowedRoles={["ENGINEER"]}>
            <Engineer />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}