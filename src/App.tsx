import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { EventGallery } from './pages/EventGallery';
import { UploadPhoto } from './pages/UploadPhoto';
import { FaceSearch } from './pages/FaceSearch';
import { EventSettings } from './pages/EventSettings';
import { Profile } from './pages/Profile';
import { ClientDashboard } from './pages/ClientDashboard';
import { Navbar } from './components/Navbar';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
          <Navbar />
          <main className="mx-auto w-full max-w-[1720px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/event/:eventId" element={<EventGallery />} />
              <Route path="/event/:eventId/upload" element={<UploadPhoto />} />
              <Route path="/event/:eventId/search" element={<FaceSearch />} />
              <Route path="/event/:eventId/settings" element={<EventSettings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/client" element={<ClientDashboard />} />
            </Routes>
          </main>
          <Toaster position="top-center" />
        </div>
      </Router>
    </AuthProvider>
  );
}
