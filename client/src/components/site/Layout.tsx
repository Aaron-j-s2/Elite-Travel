import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, Phone } from 'lucide-react';
import { useSite } from '../../lib/site';
import { telHref, whatsappHref } from '../../lib/format';
import { Logo, WhatsAppIcon, cx } from '../ui/primitives';

const NAV = [
  { to: '/vehicles', label: 'Fleet' },
  { to: '/services', label: 'Services' },
  { to: '/booking/status', label: 'Track booking' },
  { to: '/contact', label: 'Contact' },
];

export const ENQUIRY_MESSAGE = 'Hello Elite Travel Hub, I would like to enquire about booking a vehicle.';

const EASE = [0.22, 1, 0.36, 1] as const;

function Header() {
  const { contact } = useSite();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const location = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);
  // The home page opens on a dark showroom hero: the header turns light while it sits over it.
  const overHero = location.pathname === '/' && !pastHero;
  const light = open || overHero;

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      const hero = document.getElementById('hero');
      setPastHero(!hero || hero.getBoundingClientRect().bottom < 72);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header
      className={cx(
        'sticky top-0 z-40 transition-[background,box-shadow,color] duration-500',
        open
          ? 'bg-ink text-ivory'
          : overHero
            ? cx('text-ivory', scrolled ? 'bg-ink/75 shadow-[0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-md' : 'bg-ink/0')
            : scrolled
              ? 'bg-paper/[0.97] shadow-[0_1px_0_rgb(10_15_28/0.08)] backdrop-blur-md'
              : 'bg-paper/0',
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      <div className="wrap flex h-[4.5rem] items-center justify-between gap-6">
        <Link to="/" aria-label="Elite Travel Hub — home" className="shrink-0">
          <Logo light={light} />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-9 lg:flex">
          {NAV.map((n, i) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) =>
                cx('group relative flex items-baseline gap-1.5 py-2 text-[0.9rem] font-medium transition', light ? (isActive ? 'text-ivory' : 'text-ivory/65 hover:text-ivory') : isActive ? 'text-ink' : 'text-ink/60 hover:text-ink')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cx('font-mono text-[0.6rem]', light ? 'text-ivory/40' : 'text-ink/35')}>0{i + 1}</span>
                  {n.label}
                  <span
                    aria-hidden="true"
                    className={cx('absolute inset-x-0 -bottom-0.5 h-px origin-left bg-signal transition-transform duration-500 ease-[var(--ease-drive)]', isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100')}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <a href={telHref(contact.phone)} className={cx('link-underline hidden items-center gap-2 py-1 text-sm font-medium transition xl:inline-flex', light ? 'text-ivory/80 hover:text-ivory' : 'text-ink/75 hover:text-ink')}>
            <Phone className={cx('size-3.5', light ? 'text-signal-2' : 'text-signal')} aria-hidden="true" />
            {contact.phone}
          </a>
          <Link to="/book" className={cx('btn btn-sm hidden sm:inline-flex', light ? 'btn-light' : 'btn-primary')}>
            Book your ride <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="group relative -mr-2 inline-flex h-11 items-center gap-3 px-2 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="eyebrow hidden min-[400px]:inline">{open ? 'Close' : 'Menu'}</span>
            <span aria-hidden="true" className="relative block h-3 w-7">
              <span className={cx('absolute left-0 h-[1.5px] bg-current transition-all duration-500 ease-[var(--ease-drive)]', open ? 'top-1/2 w-7 -translate-y-1/2 rotate-[20deg]' : 'top-0 w-7')} />
              <span className={cx('absolute left-0 h-[1.5px] bg-current transition-all duration-500 ease-[var(--ease-drive)]', open ? 'top-1/2 w-7 -translate-y-1/2 -rotate-[20deg]' : 'bottom-0 w-[1.1rem] group-hover:w-7')} />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-x-0 top-[4.5rem] bottom-0 z-40 overflow-y-auto bg-ink text-ivory lg:hidden"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
          >
            <nav aria-label="Mobile" className="wrap flex min-h-full flex-col pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
              <ul>
                {[{ to: '/', label: 'Home' }, ...NAV, { to: '/book', label: 'Book a ride' }].map((n, i) => (
                  <li key={n.to} className="overflow-hidden border-b border-ivory/10">
                    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ delay: 0.18 + 0.05 * i, duration: 0.7, ease: EASE }}>
                      <NavLink
                        to={n.to}
                        end={n.to === '/'}
                        className={({ isActive }) => cx('flex items-center justify-between gap-4 py-4', isActive ? 'text-ivory' : 'text-ivory/55 hover:text-ivory')}
                      >
                        {({ isActive }) => (
                          <>
                            <span className="flex items-baseline gap-3">
                              <span className="font-mono text-[0.65rem] text-ivory/35">0{i + 1}</span>
                              <span className="display text-[clamp(1.6rem,8.4vw,2.6rem)] leading-none">{n.label}</span>
                            </span>
                            {isActive ? <span aria-hidden="true" className="stripe" /> : <ArrowUpRight className="size-5 text-ivory/40" aria-hidden="true" />}
                          </>
                        )}
                      </NavLink>
                    </motion.div>
                  </li>
                ))}
              </ul>
              <motion.div className="mt-auto grid gap-3 pt-12" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6, ease: EASE }}>
                <p className="eyebrow text-ivory/45">Talk to us directly</p>
                <a href={telHref(contact.phone)} className="display text-[clamp(1.5rem,7.5vw,2.2rem)] leading-none text-ivory">
                  {contact.phone}
                </a>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={whatsappHref(contact.whatsapp, ENQUIRY_MESSAGE)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-light">
                    <WhatsAppIcon className="size-4" /> WhatsApp
                  </a>
                  <a href={`mailto:${contact.email}`} className="btn btn-ghost-light">
                    Email
                  </a>
                </div>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Footer() {
  const { contact, site } = useSite();
  const services = site?.services ?? [];
  const socials = [
    ['Instagram', contact.instagram],
    ['Facebook', contact.facebook],
    ['YouTube', contact.youtube],
  ].filter(([, url]) => url);

  return (
    <footer className="grain relative overflow-hidden bg-ink text-ivory">
      <div className="wrap pt-20 pb-28 lg:pt-28 lg:pb-10">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo light />
            <a href={telHref(contact.phone)} className="link-underline mt-8 flex w-fit items-center gap-2 text-lg font-medium text-ivory">
              <Phone className="size-4 text-signal-2" aria-hidden="true" /> {contact.phone}
            </a>
            <p className="mt-6 max-w-sm text-ivory/60">
              Tourist buses and travel cars for family trips, group tours, outstation journeys and sightseeing — from {contact.locality}, {contact.region}.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={whatsappHref(contact.whatsapp, ENQUIRY_MESSAGE)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-light btn-sm">
                <WhatsAppIcon className="size-4" /> WhatsApp
              </a>
              <Link to="/book" className="btn btn-light btn-sm">
                Book your ride <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <nav aria-label="Footer — services" className="lg:col-span-3 lg:col-start-7">
            <h2 className="eyebrow text-ivory/45">Services</h2>
            <ul className="mt-5 space-y-2.5 text-ivory/75">
              {services.map((s) => (
                <li key={s.slug}>
                  <Link to={`/services#${s.slug}`} className="link-underline transition hover:text-ivory">
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid gap-10 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-1">
            <nav aria-label="Footer — explore">
              <h2 className="eyebrow text-ivory/45">Explore</h2>
              <ul className="mt-5 space-y-2.5 text-ivory/75">
                {[
                  ['/vehicles', 'Our fleet'],
                  ['/book', 'Book a vehicle'],
                  ['/booking/status', 'Track a booking'],
                  ['/contact', 'Contact'],
                ].map(([to, label]) => (
                  <li key={to}>
                    <Link to={to} className="link-underline transition hover:text-ivory">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              <h2 className="eyebrow text-ivory/45">Reach us</h2>
              <address className="mt-5 space-y-2.5 text-ivory/75 not-italic">
                <p>
                  {contact.addressLine ? <>{contact.addressLine}<br /></> : null}
                  {contact.locality}, {contact.region}
                </p>
                <p>
                  <a href={`mailto:${contact.email}`} className="break-all transition hover:text-ivory">
                    {contact.email}
                  </a>
                </p>
                {contact.hours && <p>{contact.hours}</p>}
              </address>
              {socials.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  {socials.map(([name, url]) => (
                    <li key={name}>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="link-arrow text-ivory/80">
                        {name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* The windscreen wordmark, set across the full measure */}
        <div aria-hidden="true" className="pointer-events-none mt-20 flex items-end gap-[2vw] select-none lg:mt-28">
          <span className="display text-[clamp(4.5rem,24vw,23rem)] leading-[0.74] text-ivory/[0.07] italic">Elite</span>
          <span className="stripe mb-[1.2vw] !h-[1.4vw] !w-[8vw] shrink-0" />
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-ivory/10 pt-6 text-sm text-ivory/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {contact.businessName}. All rights reserved.</p>
          <ul className="flex gap-6">
            <li>
              <Link to="/terms" className="hover:text-ivory">
                Booking terms
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-ivory">
                Privacy policy
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

/** Mobile-only bottom bar with the actions people need most. */
function MobileActionBar() {
  const { contact } = useSite();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const hidden = pathname.startsWith('/book');

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (hidden) return null;
  return (
    <div
      className={cx(
        'fixed inset-x-3 z-30 transition-transform duration-500 ease-[var(--ease-out-soft)] lg:hidden',
        'bottom-[max(0.75rem,env(safe-area-inset-bottom))]',
        visible ? 'translate-y-0' : 'translate-y-[calc(100%+2rem)]',
      )}
    >
      <div className="mx-auto grid max-w-lg grid-cols-[3rem_3rem_1fr] gap-1 rounded-[5px] bg-ink p-1 shadow-[0_20px_40px_-16px_rgb(10_15_28/0.55)]">
        <a href={telHref(contact.phone)} className="grid h-12 place-items-center text-ivory" aria-label={`Call ${contact.phone}`} tabIndex={visible ? 0 : -1}>
          <Phone className="size-[1.1rem]" aria-hidden="true" />
        </a>
        <a href={whatsappHref(contact.whatsapp, ENQUIRY_MESSAGE)} target="_blank" rel="noopener noreferrer" className="grid h-12 place-items-center border-x border-ivory/10 text-ivory" aria-label="WhatsApp" tabIndex={visible ? 0 : -1}>
          <WhatsAppIcon className="size-[1.1rem]" />
        </a>
        <Link to="/book" className="btn btn-light !min-h-12" tabIndex={visible ? 0 : -1}>
          Book your ride <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export function SiteLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileActionBar />
    </div>
  );
}
