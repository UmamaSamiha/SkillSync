import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/common/Sidebar';
import LoginPage from './pages/Login';
import HeatmapPage from './pages/Heatmap';
import FocusPage from './pages/Focus';
import HistoryPage from './pages/History';
import MemberDetailPage from './pages/MemberDetail';
import AdminDashboard from './pages/AdminDashboard';
import Certificates from './pages/Certificates';
import SignupPage from './pages/Signup';


function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function PrivateRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" />;
  return <Layout>{children}</Layout>;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin') return <Navigate to="/admin" />;
  return <Navigate to="/dashboard" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Student Routes */}
      <Route path="/dashboard" element={
        <PrivateRoute><HeatmapPage /></PrivateRoute>
      }/>
      <Route path="/focus" element={
        <PrivateRoute><FocusPage /></PrivateRoute>
      }/>
      <Route path="/history" element={
        <PrivateRoute><HistoryPage /></PrivateRoute>
      }/>
      <Route path="/member/:userId" element={
        <PrivateRoute><MemberDetailPage /></PrivateRoute>
      }/>
      <Route path="/certificates" element={<Certificates />
      }/>

      {/* Admin Routes */}
      <Route path="/admin" element={
        <PrivateRoute adminOnly={true}><AdminDashboard /></PrivateRoute>
      }/>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;