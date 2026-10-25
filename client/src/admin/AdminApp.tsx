import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import { Bus, CalendarRange, ExternalLink, FileText, Inbox, LayoutDashboard, LogOut, MoreHorizontal, Quote, Settings2, UserCog, Wrench, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useSeo } from '../lib/seo';
import { FormAlert, Logo, Spinner, TextField, cx } from '../components/ui/primitives';
import { AdminContext, ToastProvider, useAdmin, type Admin, type AdminFeatures } from './ui';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import BookingDetail from './pages/BookingDetail';
import Vehicles from './pages/Vehicles';
import VehicleEdit from './pages/VehicleEdit';
import Enquiries from './pages/Enquiries';
import Content from './pages/Content';
import ServicesAdmin from './pages/ServicesAdmin';
import Testimonials from './pages/Testimonials';
import Account from './pages/Account';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarRange },
  { to: '/admin/vehicles', label: 'Vehicles', icon: Bus },
  { to: '/admin/enquiries', label: 'Enquiries', icon: Inbox },
  { to: '/admin/content', label: 'Site content', icon: FileText },
  { to: '/admin/services', label: 'Services', icon: Wrench },
  { to: '/admin/testimonials', label: 'Testimonials', icon: Quote },
  { to: '/admin/account', label: 'Account', icon: UserCog },
];

function Login({ onSignedIn }: { onSignedIn: (a: Admin) => void }) {
  useSeo('Admin sign in', undefined, { noindex: true });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ admin: Admin }>('/api/admin/auth/login', { email, password });
      onSignedIn(res.admin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="grain relative hidden overflow-hidden bg-navy lg:block">
        <img src="/images/fleet/traveller-elite-livery-night-profile-1600.webp" alt="" className="absolute inset-0 size-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-ivory">
          <Logo light />
          <p className="headline mt-6 max-w-md text-5xl">Every booking, one calm place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-paper px-5 py-16">
        <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-5">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div>
            <h1 className="headline text-4xl">Sign in</h1>
            <p className="mt-2 text-sm text-muted">Elite Travel Hub administration</p>
          </div>
          {error && <FormAlert>{error}</FormAlert>}
          <TextField label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy && <Spinner />} Sign in
          </button>
          <p className="text-center text-xs text-muted">
            <Link to="/" className="underline underline-offset-2">
              Back to the website
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Shell() {
  const { admin, signOut } = useAdmin();
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMore(false), [pathname]);
  useSeo('Admin', undefined, { noindex: true });

  const link = (n: (typeof NAV)[number], dark: boolean) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
          dark ? (isActive ? 'bg-ivory/10 text-ivory' : 'text-ivory/60 hover:bg-ivory/5 hover:text-ivory') : isActive ? 'bg-navy text-ivory' : 'text-ink/75 hover:bg-fog',
        )
      }
    >
      <n.icon className="size-[1.1rem]" aria-hidden="true" />
      {n.label}
    </NavLink>
  );

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-ink p-4 text-ivory lg:flex">
        <Link to="/admin" className="px-3 pt-2 pb-6">
          <Logo light />
        </Link>
        <nav aria-label="Admin" className="flex-1 space-y-1">
          {NAV.map((n) => link(n, true))}
        </nav>
        <div className="space-y-1 border-t border-ivory/10 pt-4">
          <a href="/" target="_blank" rel="noopener" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ivory/60 hover:text-ivory">
            <ExternalLink className="size-[1.1rem]" aria-hidden="true" /> View website
          </a>
          <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ivory/60 hover:text-ivory">
            <LogOut className="size-[1.1rem]" aria-hidden="true" /> Sign out
          </button>
          <p className="truncate px-3 pt-2 text-xs text-ivory/40">{admin.email}</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
        <Link to="/admin">
          <Logo className="scale-90" />
        </Link>
        <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </button>
      </header>

      <main id="main" className="min-w-0 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
        <Outlet />
      </main>

      {/* Mobile bottom tabs */}
      <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.slice(0, 4).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-semibold', isActive ? 'text-navy' : 'text-ink/50')}>
            <n.icon className="size-5" aria-hidden="true" />
            {n.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMore(true)} aria-expanded={more} className="flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-semibold text-ink/50">
          <MoreHorizontal className="size-5" aria-hidden="true" /> More
        </button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setMore(false)}>
          <div role="dialog" aria-modal="true" aria-label="More" className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-paper p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-bold">More</p>
              <button type="button" onClick={() => setMore(false)} aria-label="Close" className="grid size-10 place-items-center rounded-full hover:bg-fog">
                <X className="size-5" />
              </button>
            </div>
            <nav className="space-y-1">{NAV.slice(4).map((n) => link(n, false))}</nav>
            <a href="/" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink/75 hover:bg-fog">
              <Settings2 className="size-[1.1rem]" aria-hidden="true" /> View website
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminApp() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'out' } | { status: 'in'; admin: Admin; features: AdminFeatures }>({ status: 'loading' });
  const navigate = useNavigate();

  const loadMe = useCallback(() => {
    api
      .get<{ admin: Admin; features: AdminFeatures }>('/api/admin/auth/me')
      .then((r) => setState({ status: 'in', admin: r.admin, features: r.features }))
      .catch(() => setState({ status: 'out' }));
  }, []);
  useEffect(loadMe, [loadMe]);

  // Any 401 from an admin API call (expired session) sends the user back to sign in.
  useEffect(() => {
    const onUnauthorized = () => setState({ status: 'out' });
    window.addEventListener('eth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('eth:unauthorized', onUnauthorized);
  }, []);

  const signOut = async () => {
    await api.post('/api/admin/auth/logout').catch(() => {});
    setState({ status: 'out' });
    navigate('/admin');
  };

  if (state.status === 'loading') return <div className="grid min-h-dvh place-items-center bg-paper text-sm text-muted">Checking your session…</div>;
  if (state.status === 'out') return <Login onSignedIn={() => loadMe()} />;

  return (
    <AdminContext.Provider value={{ admin: state.admin, features: state.features, signOut }}>
      <ToastProvider>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="bookings/:id" element={<BookingDetail />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="vehicles/new" element={<VehicleEdit />} />
            <Route path="vehicles/:id" element={<VehicleEdit />} />
            <Route path="enquiries" element={<Enquiries />} />
            <Route path="content" element={<Content />} />
            <Route path="services" element={<ServicesAdmin />} />
            <Route path="testimonials" element={<Testimonials />} />
            <Route path="account" element={<Account />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AdminContext.Provider>
  );
}
