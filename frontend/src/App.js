import "@/App.css";
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Products from "./pages/Products";
import Quotes from "./pages/Quotes";
import QuoteForm from "./pages/QuoteForm";
import QuoteView from "./pages/QuoteView";
import Settings from "./pages/Settings";
import Users from "./pages/Users";

function useRemoveEmergentBadge() {
  useEffect(() => {
    const remove = () => {
      const el = document.getElementById("emergent-badge");
      if (el) el.remove();
    };
    remove();
    const observer = new MutationObserver(remove);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}

function Protected({ children, adminOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  useRemoveEmergentBadge();
  return (
    <div className="App">
      <ErrorBoundary>
        <LanguageProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Protected><Dashboard /></Protected>} />
                <Route path="/musteriler" element={<Protected><Customers /></Protected>} />
                <Route path="/musteriler/:id" element={<Protected><CustomerDetail /></Protected>} />
                <Route path="/urunler" element={<Protected><Products /></Protected>} />
                <Route path="/teklifler" element={<Protected><Quotes /></Protected>} />
                <Route path="/teklifler/yeni" element={<Protected><QuoteForm /></Protected>} />
                <Route path="/teklifler/:id" element={<Protected><QuoteView /></Protected>} />
                <Route path="/teklifler/:id/duzenle" element={<Protected><QuoteForm /></Protected>} />
                <Route path="/ayarlar" element={<Protected adminOnly><Settings /></Protected>} />
                <Route path="/kullanicilar" element={<Protected adminOnly><Users /></Protected>} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </div>
  );
}

export default App;
