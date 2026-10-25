import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, Phone, Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { STATUS_LABEL, TRIP_LABEL, formatDate, formatTime, relativeTime, telHref, whatsappHref } from '../../lib/format';
import type { BookingStatus } from '../../lib/types';
import { WhatsAppIcon, cx } from '../../components/ui/primitives';
import { Empty, LoadError, PageHeader, StatusBadge, useLoad } from '../ui';
import type { AdminBooking } from '../types';

const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'completed', 'rejected', 'cancelled'];

export default function Bookings() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get('q') ?? '');
  const status = params.get('status') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const sort = params.get('sort') ?? 'created_desc';
  const page = Number(params.get('page') ?? '1') || 1;

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Debounce the search box into the URL
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== q.trim()) set({ q: q.trim() });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const query = new URLSearchParams({ q: params.get('q') ?? '', status, from, to, sort, page: String(page), pageSize: '20' });
  const { data, error, loading, reload } = useLoad((signal) => api.get<{ items: AdminBooking[]; total: number; page: number; pageSize: number }>(`/api/admin/bookings?${query}`, signal), [query.toString()]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(params.get('q') || status || from || to);

  return (
    <>
      <PageHeader title="Bookings" description={data ? `${data.total} booking${data.total === 1 ? '' : 's'}${filtered ? ' match your filters' : ''}` : ' '} />

      <div className="mb-5 space-y-3">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter by status">
          {['', ...STATUSES].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              aria-pressed={status === s}
              onClick={() => set({ status: s })}
              className={cx('shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition', status === s ? 'bg-navy text-ivory' : 'bg-ivory text-ink/70 ring-1 ring-line hover:ring-stone')}
            >
              {s ? STATUS_LABEL[s as BookingStatus] : 'All'}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Search bookings</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or reference" className="input !min-h-11 pl-10" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-10 shrink-0 text-muted lg:w-auto">From</span>
            <input type="date" value={from} onChange={(e) => set({ from: e.target.value })} className="input !min-h-11" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-10 shrink-0 text-muted lg:w-auto">To</span>
            <input type="date" value={to} onChange={(e) => set({ to: e.target.value })} className="input !min-h-11" />
          </label>
          <label>
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => set({ sort: e.target.value })} className="input !min-h-11 text-sm">
              <option value="created_desc">Newest requests</option>
              <option value="trip_asc">Trip date (soonest)</option>
              <option value="trip_desc">Trip date (latest)</option>
            </select>
          </label>
          {filtered && (
            <button type="button" onClick={() => { setQ(''); setParams({}, { replace: true }); }} className="btn btn-ghost btn-sm !min-h-11">
              <X className="size-4" aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <Empty title={filtered ? 'No bookings match these filters.' : 'No bookings yet.'}>{filtered ? 'Try clearing a filter.' : 'Requests submitted on the website will appear here.'}</Empty>
      ) : (
        <div className={cx('transition-opacity', loading && 'opacity-60')}>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-ivory lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-fog/40 text-xs text-muted">
                <tr>
                  {['Reference', 'Customer', 'Trip', 'Vehicle', 'Pax', 'Status', 'Received', ''].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((b) => (
                  <tr key={b.id} className="cursor-pointer align-top transition hover:bg-fog/30" onClick={() => navigate(`/admin/bookings/${b.id}`)}>
                    <td className="px-4 py-3.5">
                      <Link to={`/admin/bookings/${b.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-bold hover:text-navy">
                        {b.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold">{b.customerName}</p>
                      <p className="text-xs text-muted">{b.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium">
                        {formatDate(b.tripDate)}
                        {b.returnDate && ` – ${formatDate(b.returnDate)}`} · {formatTime(b.pickupTime)}
                      </p>
                      <p className="max-w-64 truncate text-xs text-muted">
                        {b.pickupLocation} → {b.destination}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">{b.vehicle?.name ?? <span className="text-muted">Any {b.vehicleCategory === 'bus' ? 'bus' : 'car'}</span>}</td>
                    <td className="px-4 py-3.5">{b.passengers}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs whitespace-nowrap text-muted">{relativeTime(b.createdAt)}</td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <a href={telHref(b.customerPhone)} aria-label={`Call ${b.customerName}`} className="grid size-8 place-items-center rounded-full hover:bg-fog">
                          <Phone className="size-4" />
                        </a>
                        <a href={whatsappHref(b.customerPhone, `Hello ${b.customerName.split(' ')[0]}, this is Elite Travel Hub about your booking ${b.reference}.`)} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${b.customerName}`} className="grid size-8 place-items-center rounded-full hover:bg-fog">
                          <WhatsAppIcon className="size-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 lg:hidden">
            {data.items.map((b) => (
              <li key={b.id} className="rounded-2xl border border-line bg-ivory">
                <Link to={`/admin/bookings/${b.id}`} className="block p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold">{b.reference}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="mt-2 font-semibold">{b.customerName}</p>
                  <p className="mt-1 text-sm">
                    {formatDate(b.tripDate)}
                    {b.returnDate && ` – ${formatDate(b.returnDate)}`} · {formatTime(b.pickupTime)} · {TRIP_LABEL[b.tripType]}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {b.pickupLocation} → {b.destination}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {b.vehicle?.name ?? `Any ${b.vehicleCategory}`} · {b.passengers} pax · {relativeTime(b.createdAt)}
                  </p>
                </Link>
                <div className="flex border-t border-line text-sm font-semibold">
                  <a href={telHref(b.customerPhone)} className="flex flex-1 items-center justify-center gap-2 py-2.5">
                    <Phone className="size-4" aria-hidden="true" /> Call
                  </a>
                  <a href={whatsappHref(b.customerPhone, `Hello ${b.customerName.split(' ')[0]}, this is Elite Travel Hub about your booking ${b.reference}.`)} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2 border-l border-line py-2.5">
                    <WhatsAppIcon className="size-4" /> WhatsApp
                  </a>
                </div>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} className="btn btn-ghost btn-sm">
                <ChevronLeft className="size-4" aria-hidden="true" /> Previous
              </button>
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              <button type="button" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })} className="btn btn-ghost btn-sm">
                Next <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      )}
    </>
  );
}
