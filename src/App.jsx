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

export default function App() {
  return (
    <Routes>
      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public */}
      <Route path="/login" element={<Login />} />

      <Route path="/admin/master" element={<AdminMaster />} />
      {/* Admin */}
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

      {/* ✅ Advanced Reports */}
      <Route
        path="/admin/reports/advanced"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ReportsAdvanced />
          </ProtectedRoute>
        }
      />

      {/* ✅ Snapshots list */}
      <Route
        path="/admin/reports/snapshots"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ReportsSnapshots />
          </ProtectedRoute>
        }
      />

      {/* ✅ Snapshot details */}
      <Route
        path="/admin/reports/snapshots/:weekKey"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ReportsSnapshotDetails />
          </ProtectedRoute>
        }
      />

      {/* Engineer */}
      <Route
        path="/engineer"
        element={
          <ProtectedRoute allowedRoles={["engineer"]}>
            <Engineer />
          </ProtectedRoute>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
