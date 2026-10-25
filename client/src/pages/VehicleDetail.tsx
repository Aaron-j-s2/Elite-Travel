import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ChevronLeft, ChevronRight, Expand, Phone, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useSite } from '../lib/site';
import { useSeo } from '../lib/seo';
import { CATEGORY_LABEL, addDays, formatDate, telHref, todayIST, whatsappHref } from '../lib/format';
import type { BusyRange, Vehicle } from '../lib/types';
import { FitImage, Img, WhatsAppIcon, cx } from '../components/ui/primitives';
import { PriceLine, SeatsLabel } from '../components/site/VehicleCard';
import { BookingForm } from '../components/site/BookingForm';
import NotFound from './NotFound';

function Gallery({ vehicle }: { vehicle: Vehicle }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const imgs = vehicle.images;
  const go = (d: number) => setI((x) => (x + d + imgs.length) % imgs.length);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  if (!imgs.length) return <div className="grid aspect-[4/3] place-items-center rounded-[4px] bg-fog text-muted">Photos coming soon</div>;
  const current = imgs[i]!;

  return (
    <div>
      <div className="group relative overflow-hidden rounded-[4px] bg-fog">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={current.base} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <FitImage img={current} priority={i === 0} sizes="(min-width: 1024px) 58vw, 100vw" className="aspect-square w-full sm:aspect-[4/3]" />
          </motion.div>
        </AnimatePresence>
        <button type="button" onClick={() => setOpen(true)} className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-[3px] bg-paper/90 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-paper">
          <Expand className="size-4" aria-hidden="true" /> View larger
        </button>
        {imgs.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 backdrop-blur transition hover:bg-paper">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 backdrop-blur transition hover:bg-paper">
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute top-4 right-4 rounded-[3px] bg-ink/60 px-3 py-1 font-mono text-xs text-ivory backdrop-blur">
              {i + 1} / {imgs.length}
            </span>
          </>
        )}
      </div>
      {imgs.length > 1 && (
        <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" aria-label="Photos">
          {imgs.map((img, idx) => (
            <li key={img.base} className="shrink-0">
              <button
                type="button"
                onClick={() => setI(idx)}
                aria-label={`Show photo ${idx + 1}`}
                aria-current={idx === i}
                className={cx('block overflow-hidden rounded-[3px] ring-2 ring-offset-2 ring-offset-paper transition', idx === i ? 'ring-navy' : 'ring-transparent opacity-60 hover:opacity-100')}
              >
                <Img img={img} sizes="120px" className="h-16 w-24 object-cover sm:h-20 sm:w-28" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1);
          if (e.key === 'ArrowRight') go(1);
        }}
        className="m-auto h-dvh max-h-none w-screen max-w-none bg-ink/95 p-0 text-ivory backdrop:bg-ink/80"
        aria-label={`${vehicle.name} photos`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-4">
            <span className="font-mono text-sm">
              {i + 1} / {imgs.length}
            </span>
            <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full bg-ivory/10 hover:bg-ivory/20" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            <Img img={current} sizes="100vw" className="max-h-full max-w-full object-contain" />
            {imgs.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 grid size-12 place-items-center rounded-full bg-ivory/10 hover:bg-ivory/20">
                  <ChevronLeft />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 grid size-12 place-items-center rounded-full bg-ivory/10 hover:bg-ivory/20">
                  <ChevronRight />
                </button>
              </>
            )}
          </div>
          <p className="px-4 pb-6 text-center text-sm text-ivory/70">{current.alt}</p>
        </div>
      </dialog>
    </div>
  );
}

/** Two-month calendar showing days that already have a confirmed trip. */
function AvailabilityCalendar({ slug }: { slug: string }) {
  const [busy, setBusy] = useState<BusyRange[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    api
      .get<{ busy: BusyRange[] }>(`/api/vehicles/${slug}/availability?to=${addDays(todayIST(), 400)}`)
      .then((r) => setBusy(r.busy))
      .catch(() => setFailed(true));
  }, [slug]);

  const today = todayIST();
  const isBusy = (d: string) => busy?.find((b) => d >= b.start && d <= b.end);
  const months = [0, 1].map((m) => {
    const base = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    base.setUTCMonth(base.getUTCMonth() + offset + m);
    return base;
  });

  if (failed) return <p className="text-sm text-muted">Availability couldn’t be loaded — call us to check dates.</p>;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="eyebrow text-muted">Availability</h3>
        <div className="flex gap-1">
          <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => o - 1)} className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-30" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" disabled={offset >= 10} onClick={() => setOffset((o) => o + 1)} className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-30" aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {months.map((m) => {
          const year = m.getUTCFullYear();
          const month = m.getUTCMonth();
          const first = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday first
          const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
          return (
            <div key={`${year}-${month}`}>
              <p className="mb-2 text-sm font-semibold">{m.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
              <div className="grid grid-cols-7 gap-1 text-center text-xs" role="grid">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, idx) => (
                  <span key={idx} className="py-1 font-mono text-muted" aria-hidden="true">
                    {d}
                  </span>
                ))}
                {Array.from({ length: first }, (_, k) => (
                  <span key={`e${k}`} />
                ))}
                {Array.from({ length: days }, (_, k) => {
                  const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`;
                  const b = isBusy(iso);
                  const past = iso < today;
                  return (
                    <span
                      key={iso}
                      title={b ? (b.kind === 'booked' ? 'Booked' : 'Unavailable') : undefined}
                      aria-label={`${formatDate(iso)}${past ? ', past' : b ? ', not available' : ', open'}`}
                      className={cx(
                        'grid aspect-square place-items-center rounded-[2px]',
                        past ? 'text-ink/25' : b ? 'bg-ink/80 text-ivory line-through decoration-ivory/50' : 'bg-ivory text-ink',
                        iso === today && 'ring-1 ring-navy',
                      )}
                    >
                      {k + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded bg-ivory ring-1 ring-line" /> Open for requests
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded bg-ink/80" /> Already booked / unavailable
        </span>
      </p>
      {!busy && <p className="sr-only">Loading availability…</p>}
    </div>
  );
}

export default function VehicleDetail() {
  const { slug = '' } = useParams();
  const { contact } = useSite();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setVehicle(null);
    setMissing(false);
    setFailed(false);
    const ctrl = new AbortController();
    api
      .get<{ vehicle: Vehicle }>(`/api/vehicles/${slug}`, ctrl.signal)
      .then((r) => setVehicle(r.vehicle))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else if (err.name !== 'AbortError') setFailed(true);
      });
    return () => ctrl.abort();
  }, [slug]);

  useSeo(vehicle?.name ?? (missing ? 'Vehicle not found' : null), vehicle?.tagline ?? undefined, { noindex: missing });

  if (missing) return <NotFound />;
  if (failed)
    return (
      <div className="wrap py-24 text-center">
        <p className="font-semibold">We couldn’t load this vehicle.</p>
        <Link to="/vehicles" className="btn btn-primary btn-sm mt-5">
          Back to the fleet
        </Link>
      </div>
    );
  if (!vehicle)
    return (
      <div className="wrap grid gap-10 py-12 lg:grid-cols-12" aria-busy="true">
        <div className="skeleton aspect-[4/3] rounded-[4px] lg:col-span-7" />
        <div className="space-y-4 lg:col-span-5">
          <div className="skeleton h-6 w-28 rounded" />
          <div className="skeleton h-14 w-3/4 rounded" />
          <div className="skeleton h-24 w-full rounded" />
        </div>
      </div>
    );

  const waMsg = `Hello Elite Travel Hub, I’m interested in booking the ${vehicle.name}. Is it available?`;

  return (
    <>
      <div className="wrap pt-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <ol className="flex items-center gap-2">
            <li>
              <Link to="/vehicles" className="inline-flex items-center gap-1 hover:text-navy">
                <ArrowLeft className="size-4" aria-hidden="true" /> Fleet
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate text-ink">
              {vehicle.name}
            </li>
          </ol>
        </nav>
      </div>

      <section className="wrap grid gap-10 py-8 lg:grid-cols-12 lg:gap-14 lg:py-12">
        <div className="lg:col-span-7">
          <Gallery vehicle={vehicle} />
        </div>
        <div className="lg:col-span-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow text-signal">{CATEGORY_LABEL[vehicle.category]}</span>
          </div>
          <h1 className="headline mt-4 text-[clamp(2.2rem,1.2rem+3.4vw,4.4rem)] leading-[0.98]">{vehicle.name}</h1>
          {vehicle.tagline && <p className="lede mt-5">{vehicle.tagline}</p>}

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line text-sm">
            <div className="bg-ivory p-4">
              <dt className="eyebrow text-muted">Seating</dt>
              <dd className="mt-1.5 font-semibold">
                <SeatsLabel seats={vehicle.seats} />
              </dd>
            </div>
            <div className="bg-ivory p-4">
              <dt className="eyebrow text-muted">Model</dt>
              <dd className="mt-1.5 font-semibold">{vehicle.makeModel ?? '—'}</dd>
            </div>
            {vehicle.specs.map((s) => (
              <div key={s.label} className="bg-ivory p-4">
                <dt className="eyebrow text-muted">{s.label}</dt>
                <dd className="mt-1.5 font-semibold">{s.value}</dd>
              </div>
            ))}
          </dl>

          {vehicle.pricing ? (
            <div className="mt-6 rounded-[4px] bg-fog/70 p-5">
              <p className="eyebrow text-muted">Pricing</p>
              <PriceLine vehicle={vehicle} className="mt-2" />
              <p className="mt-2 text-xs text-muted">Final fare is confirmed by our team before your booking is confirmed.</p>
            </div>
          ) : (
            <p className="mt-6 rounded-[4px] bg-fog/70 p-5 text-sm text-ink/80">Fares depend on your route and dates — send a request or call us for a quote.</p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#book" className="btn btn-primary">
              Book this vehicle
            </a>
            <a href={telHref(contact.phone)} className="btn btn-ghost">
              <Phone className="size-4" aria-hidden="true" /> Call
            </a>
            <a href={whatsappHref(contact.whatsapp, waMsg)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="wrap grid gap-14 border-t border-line py-14 lg:grid-cols-12 lg:py-20">
        <div className="space-y-10 lg:col-span-5">
          {vehicle.description && (
            <div>
              <h2 className="eyebrow text-muted">About this vehicle</h2>
              <p className="mt-4 text-lg leading-relaxed whitespace-pre-line text-ink/85">{vehicle.description}</p>
            </div>
          )}
          {vehicle.amenities.length > 0 && (
            <div>
              <h2 className="eyebrow text-muted">Features</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {vehicle.amenities.map((a) => (
                  <li key={a} className="rounded-[3px] border border-line bg-ivory px-3 py-1.5 text-sm font-medium">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <AvailabilityCalendar slug={vehicle.slug} />
        </div>
        <div id="book" className="scroll-mt-24 lg:col-span-6 lg:col-start-7">
          <p className="eyebrow text-signal">Request this vehicle</p>
          <h2 className="headline mt-3 mb-10 text-h2">Send your trip details.</h2>
          <BookingForm prefill={{ vehicleId: vehicle.id, vehicleCategory: vehicle.category }} lockVehicle />
        </div>
      </section>
    </>
  );
}
