import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Login from './pages/Login';
import Streams from './pages/Streams';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import ErrorBoundary from './components/common/ErrorBoundary';
import { Toaster } from 'sonner';

import { Menu } from 'lucide-react';

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-soft-bg md:pl-64 transition-all">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Mobile Header */}
      <div className="md:hidden bg-white p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-gray-50 rounded-lg text-gray-600">
            <Menu size={24} />
          </button>
          <span className="font-bold text-gray-800 text-lg">Streams Control</span>
        </div>
      </div>

      <main className="p-4 md:p-8 w-full max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
};

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster richColors position="top-right" expand toastOptions={{ style: { zIndex: 9999 } }} />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/streams" element={<PrivateRoute><Streams /></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </DataProvider>
    </ErrorBoundary>
  );
}

export default App;
