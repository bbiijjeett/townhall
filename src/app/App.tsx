import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ScrollToTop } from './components/ScrollToTop';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { AddPropertyPage } from './pages/AddPropertyPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { PaymentPage } from './pages/PaymentPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <ScrollToTop />
        <Navbar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/property/:id" element={<PropertyDetailPage />} />
            <Route path="/dashboard" element={
              <ProtectedRoute><OwnerDashboard /></ProtectedRoute>
            } />
            <Route path="/owner-dashboard" element={
              <ProtectedRoute><OwnerDashboard /></ProtectedRoute>
            } />
            <Route path="/add-property" element={
              <ProtectedRoute><AddPropertyPage /></ProtectedRoute>
            } />
            <Route path="/payment/:id" element={
              <ProtectedRoute><PaymentPage /></ProtectedRoute>
            } />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
        <Footer />
        <BottomNav />
        <Toaster position="top-center" />
      </div>
    </AppProvider>
  );
}