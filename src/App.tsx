import { useState } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Dashboard from "./pages/Dashboard";
import LeadDetail from "./pages/LeadDetail";
import EmailTemplates from "./pages/EmailTemplates";
import EmailSequences from "./pages/EmailSequences";
import Calendar from "./pages/Calendar";
import Reports from "./pages/Reports";
import Dialer from "./pages/Dialer";
import Workflow from "./pages/Workflow";
import Orbit from "./pages/Orbit";
import Settings from "./pages/Settings";
import Activities from "./pages/Activities";
import Reminders from "./pages/Reminders";
import Performance from "./pages/Performance";
import PendingEmails from "./pages/PendingEmails";
import Search from "./pages/Search";
import BulkImport from "./pages/BulkImport";
import NewLead from "./pages/NewLead";
import Login from "./pages/Login";
import { EmailComposer, ProfileMenu } from "./components";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./App.css";

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#f9fafb',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <p style={{ color: '#6b7280' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link to={to} className={`nav-link ${isActive ? "active" : ""}`}>
        {children}
      </Link>
    </motion.div>
  );
}

function AppContent() {
  const [showComposer, setShowComposer] = useState(false);

  return (
    <div className="app">
      {/* Header */}
      <header className="top-bar">
        <div className="top-bar-left">
          <Link to="/" className="logo">
            <span className="logo-text">DW</span>
            <span className="logo-subtitle">GROWTH & CAPITAL HUB</span>
          </Link>
        </div>
        <nav className="top-bar-nav">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/workflow">Workflow</NavLink>
          <NavLink to="/orbit">Orbit</NavLink>
          <NavLink to="/activities">Activities</NavLink>
          <NavLink to="/reminders">Reminders</NavLink>
          <NavLink to="/performance">Performance</NavLink>
          <NavLink to="/pending-emails">Emails</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="top-bar-right" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: "inline-block" }}>
            <Link
              to="/search"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#f3f4f6",
                color: "#374151",
                border: "none",
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 500,
                textDecoration: "none",
                fontSize: "14px",
              }}
            >
              🔍 Search
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: "inline-block" }}>
            <Link
              to="/bulk-import"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#f3f4f6",
                color: "#374151",
                border: "none",
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 500,
                textDecoration: "none",
                fontSize: "14px",
              }}
            >
              📥 Import
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ display: "inline-block" }}>
            <Link to="/new" className="btn btn-new">
              + New Lead
            </Link>
          </motion.div>
          {/* Profile Menu */}
          <ProfileMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="container">
<Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewLead />} />
            <Route path="/lead/:id" element={<LeadDetail />} />
            <Route path="/templates" element={<EmailTemplates />} />
            <Route path="/sequences" element={<EmailSequences />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/dialer" element={<Dialer />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="/orbit" element={<Orbit />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/pending-emails" element={<PendingEmails />} />
            <Route path="/search" element={<Search />} />
            <Route path="/bulk-import" element={<BulkImport />} />
          </Routes>
      </main>

      {/* Email Composer Modal */}
      <AnimatePresence>
        {showComposer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "24px",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowComposer(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <EmailComposer
                onClose={() => setShowComposer(false)}
                onSent={() => setShowComposer(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #1a2e1f 0%, #3d5a3d 25%, #5a7a5a 50%, #7a9a7a 75%, #9aba9a 100%)',
      }}>
        <div style={{ textAlign: 'center', color: '#f8f5f0' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            background: 'linear-gradient(135deg, #122c21 0%, #1a4d3a 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(18, 44, 33, 0.3)',
          }}>
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 800, 
              fontFamily: "Georgia, 'Times New Roman', serif",
              letterSpacing: '0.1em',
            }}>DW</span>
          </div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, only show login
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated - show full app
  return <AppContent />;
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

export default App;
