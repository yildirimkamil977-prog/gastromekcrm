import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/LanguageContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, ready } = useAuth();
  const { t } = useT();
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        {t("common.loading")}
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}
