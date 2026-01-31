// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Engineer from "./pages/Engineer";
import Reports from "./pages/Reports";
import ReportsAdvanced from "./pages/ReportsAdvanced";
import ReportsSnapshots from "./pages/ReportsSnapshots";
import ReportsSnapshotDetails from "./pages/ReportsSnapshotDetails";
import AdminMaster from "./pages/AdminMaster";
import ProtectedRoute from "./components/ProtectedRoute";

// ✅ ADDED THESE IMPORTS (Make sure these files exist in src/pages/)
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

      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Accountant MIS Module */}
      <Route
        path="/accountant/dashboard"
        element={
          <ProtectedRoute allowedRoles={["accountant", "admin"]}>
            <AccountantDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/accountant/site/:siteId"
        element={
          <ProtectedRoute allowedRoles={["accountant", "admin"]}>
            <AccountantSiteDetail />
          </ProtectedRoute>
        }
      />

      {/* Admin Master Management */}
      <Route
        path="/admin/master"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminMaster />
          </ProtectedRoute>
        }
      />

      {/* Admin Dashboard */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Admin />
          </ProtectedRoute>
        }
      />

      {/* Live Reports */}
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <Reports />
          </ProtectedRoute>
        }
      />

      {/* Advanced Reports */}
      <Route
        path="/admin/reports/advanced"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ReportsAdvanced />
          </ProtectedRoute>
        }
      />

      {/* Snapshots list */}
      <Route
        path="/admin/reports/snapshots"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ReportsSnapshots />
          </ProtectedRoute>
        }
      />

      {/* Snapshot details */}
      <Route
        path="/admin/reports/snapshots/:weekKey"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ReportsSnapshotDetails />
          </ProtectedRoute>
        }
      />

      {/* Engineer Dashboard */}
      <Route
        path="/engineer"
        element={
          <ProtectedRoute allowedRoles={["engineer"]}>
            <Engineer />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />

      {/* Labour Sheet Index (Lists Tiles, Department, etc.) */}
      <Route
        path="/accountant/site/:siteId/labour"
        element={<ProtectedRoute allowedRoles={["ACCOUNTANT", "ADMIN"]}><LabourIndex /></ProtectedRoute>}
      />

      {/* The Actual Data Entry Sheet */}
      <Route
        path="/accountant/site/:siteId/labour/:workType"
        element={<ProtectedRoute allowedRoles={["ACCOUNTANT", "ADMIN"]}><LabourSheet /></ProtectedRoute>}
      />

      <Route path="/accountant/site/:siteId/material" 
      element={<ProtectedRoute allowedRoles={["ACCOUNTANT", "ADMIN"]}><MaterialSheet /></ProtectedRoute>} />
    </Routes>
  );
}