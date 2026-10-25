import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { MotionConfig } from 'motion/react';
import { SiteProvider } from './lib/site';
import { SiteLayout } from './components/site/Layout';
import Home from './pages/Home';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import Services from './pages/Services';
import Contact from './pages/Contact';
import Book from './pages/Book';
import BookingStatus from './pages/BookingStatus';
import Policy from './pages/Policy';
import NotFound from './pages/NotFound';

// The admin dashboard is a separate bundle — public visitors never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'));

function AdminFallback() {
  return <div className="grid min-h-dvh place-items-center bg-paper text-sm text-muted">Loading dashboard…</div>;
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminApp />
              </Suspense>
            }
          />
          <Route
            element={
              <SiteProvider>
                <SiteLayout />
              </SiteProvider>
            }
          >
            <Route index element={<Home />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="vehicles/:slug" element={<VehicleDetail />} />
            <Route path="services" element={<Services />} />
            <Route path="contact" element={<Contact />} />
            <Route path="book" element={<Book />} />
            <Route path="booking/status" element={<BookingStatus />} />
            <Route path="terms" element={<Policy kind="terms" />} />
            <Route path="privacy" element={<Policy kind="privacy" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
