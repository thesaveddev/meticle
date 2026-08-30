import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import QuoteEngine from './pages/QuoteEngine';
import Services from './pages/Services';
import Contact from './pages/Contact';
import DashboardLayout from './components/dashboard/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import Enquiries from './pages/dashboard/Enquiries';
import StaffPage from './pages/dashboard/StaffPage';
import SchedulePage from './pages/dashboard/SchedulePage';

const API = import.meta.env.VITE_API_URL || '';

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home apiBase={API} />} />
        <Route path="/quote" element={<QuoteEngine apiBase={API} />} />
        <Route path="/services" element={<Services apiBase={API} />} />
        <Route path="/contact" element={<Contact apiBase={API} />} />
      </Route>

      {/* Admin dashboard */}
      <Route path="/admin" element={<DashboardLayout />}>
        <Route index element={<DashboardHome apiBase={API} />} />
        <Route path="enquiries" element={<Enquiries apiBase={API} />} />
        <Route path="staff" element={<StaffPage apiBase={API} />} />
        <Route path="schedule" element={<SchedulePage apiBase={API} />} />
      </Route>
    </Routes>
  );
}
