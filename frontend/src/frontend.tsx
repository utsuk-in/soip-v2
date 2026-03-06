import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";

import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import LoginPage from "./pages/LoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import MagicLinkPage from "./pages/MagicLinkPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import BrowsePage from "./pages/BrowsePage";
import OpportunityPage from "./pages/OpportunityPage";
import ChatPage from "./pages/ChatPage";
import UploadStudentsPage from "./pages/admin/UploadStudentsPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminEngagementPage from "./pages/admin/AdminEngagementPage";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-stone-400 font-medium">loading SOIP...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/magic-link" element={<MagicLinkPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Admin routes */}
      {user?.role === "admin" && (
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/upload" element={<UploadStudentsPage />} />
          <Route path="/admin/student_registration" element={<UploadStudentsPage />} />
          <Route path="/admin/engagement" element={<AdminEngagementPage />} />
        </Route>
      )}

      {/* Student routes */}
      {!user && (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}

      {user && !user.is_onboarded && user.role !== "admin" && (
        <>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </>
      )}

      {user && user.is_onboarded && user.role !== "admin" && (
        <>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/browse/:id" element={<OpportunityPage />} />
            <Route path="/chat" element={<ChatPage />} />
          </Route>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>
      )}

      {user?.role === "admin" && (
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      )}
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
