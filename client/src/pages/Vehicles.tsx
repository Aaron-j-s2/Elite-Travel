import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Search, X } from 'lucide-react';
import { useSite } from '../lib/site';
import { useSeo } from '../lib/seo';
import { CATEGORY_PLURAL } from '../lib/format';
import type { Category } from '../lib/types';
import { SectionMark, cx } from '../components/ui/primitives';
import { Reveal } from '../components/ui/Reveal';
import { VehicleCard, VehicleCardSkeleton } from '../components/site/VehicleCard';

const SEAT_BANDS = [
  { value: '', label: 'Any group size' },
  { value: '4', label: '4+ passengers' },
  { value: '8', label: '8+ passengers' },
  { value: '12', label: '12+ passengers' },
  { value: '20', label: '20+ passengers' },
];

export default function Vehicles() {
  useSeo('Our fleet', 'Browse tourist travellers and travel cars from Elite Travel Hub, photographed as they really are.');
  const { vehicles, error, reload } = useSite();
  const [params, setParams] = useSearchParams();
  const cat = (params.get('type') as Category | null) ?? null;
  const q = params.get('q') ?? '';
  const seats = params.get('seats') ?? '';

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const hasSeatData = vehicles?.some((v) => v.seats != null) ?? false;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (vehicles ?? []).filter((v) => {
      if (cat && v.category !== cat) return false;
      if (needle && ![v.name, v.makeModel, v.tagline].some((f) => f?.toLowerCase().includes(needle))) return false;
      if (seats && (v.seats == null || v.seats < Number(seats))) return false;
      return true;
    });
  }, [vehicles, cat, q, seats]);
  const filtersOn = Boolean(cat || q || seats);

  return (
    <>
      <section className="pt-10 pb-12 lg:pt-16">
        <div className="wrap">
          <SectionMark n="01" label="The fleet" />
          <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:items-end">
            <h1 className="display text-h1 lg:col-span-7">
              Our <span className="text-azure">vehicles</span>
            </h1>
            <p className="lede lg:col-span-5">These are photos of our own vehicles. Choose one to see the details and request your dates.</p>
          </div>
        </div>
      </section>

      <div className="sticky top-[4.5rem] z-20 border-y border-line bg-paper/95 backdrop-blur-md">
        <div className="wrap flex flex-col gap-3 py-3 md:flex-row md:items-center">
          <div role="group" aria-label="Vehicle type" className="no-scrollbar flex gap-1 overflow-x-auto">
            {([null, 'bus', 'car'] as const).map((c) => (
              <button
                key={c ?? 'all'}
                type="button"
                aria-pressed={cat === c}
                onClick={() => update('type', c ?? '')}
                className={cx('shrink-0 rounded-[3px] px-4 py-2.5 text-sm font-semibold transition', cat === c ? 'bg-navy text-ivory' : 'text-ink/60 hover:bg-fog hover:text-ink')}
              >
                {c ? CATEGORY_PLURAL[c] : 'All vehicles'}
              </button>
            ))}
          </div>
          <div className="flex flex-1 gap-2 md:justify-end">
            <label className="relative flex-1 md:max-w-xs">
              <span className="sr-only">Search by name or model</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => update('q', e.target.value)} placeholder="Search name or model" className="input !min-h-11 pl-10" />
            </label>
            {hasSeatData && (
              <label className="w-40 shrink-0">
                <span className="sr-only">Group size</span>
                <select value={seats} onChange={(e) => update('seats', e.target.value)} className="input !min-h-11 text-sm">
                  {SEAT_BANDS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>

      <section className="py-14 lg:py-20" aria-live="polite">
        <div className="wrap">
          {error ? (
            <div className="border border-line bg-ivory p-10 text-center">
              <p className="font-semibold">We could not load the vehicles just now.</p>
              <button type="button" onClick={reload} className="btn btn-primary btn-sm mt-5">
                Try again
              </button>
            </div>
          ) : !vehicles ? (
            <div className="space-y-16 lg:space-y-24">
              {[0, 1].map((i) => (
                <VehicleCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mx-auto max-w-md py-10 text-center">
              <p className="headline text-h3">No vehicles match.</p>
              <p className="mt-3 text-muted">Try a different search, or tell us about your trip and we will suggest the right vehicle.</p>
              <div className="mt-6 flex justify-center gap-3">
                {filtersOn && (
                  <button type="button" onClick={() => setParams({}, { replace: true })} className="btn btn-ghost btn-sm">
                    <X className="size-4" aria-hidden="true" /> Clear filters
                  </button>
                )}
                <Link to="/book" className="btn btn-primary btn-sm">
                  Send trip details
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="eyebrow mb-8 text-muted">
                Showing {filtered.length} of {vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}
              </p>
              <div className="space-y-16 lg:space-y-24">
                {filtered.map((v, i) => (
                  <Reveal key={v.id}>
                    <VehicleCard vehicle={v} index={i} />
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
