import { Link } from 'react-router';
import { ArrowRight, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import { STATUS_LABEL, formatDate, formatTime, relativeTime } from '../../lib/format';
import type { BookingStatus } from '../../lib/types';
import { Empty, LoadError, PageHeader, Panel, StatusBadge, useAdmin, useLoad } from '../ui';
import type { AdminBooking } from '../types';
import { cx } from '../../components/ui/primitives';

interface DashboardData {
  today: string;
  bookings: Record<BookingStatus, number> & { total: number };
  vehicles: { active: number; inactive: number; availableToday: number };
  newEnquiries: number;
  upcoming: AdminBooking[];
  recent: AdminBooking[];
  activity: {
    id: number;
    kind: string;
    fromStatus: BookingStatus | null;
    toStatus: BookingStatus | null;
    note: string | null;
    actor: string;
    at: string;
    bookingId: string;
    reference: string;
    customerName: string;
  }[];
}

function Stat({ label, value, to, highlight }: { label: string; value: number; to?: string; highlight?: boolean }) {
  const body = (
    <>
      <p className={cx('eyebrow', highlight ? 'text-ink/70' : 'text-muted')}>{label}</p>
      <p className="display mt-3 text-5xl leading-none">{value}</p>
    </>
  );
  const cls = cx('block rounded-2xl border p-5 transition', highlight ? 'border-plate bg-plate/90' : 'border-line bg-ivory', to && 'hover:-translate-y-0.5 hover:shadow-lg');
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function Dashboard() {
  const { admin, features } = useAdmin();
  const { data, error, loading, reload } = useLoad((signal) => api.get<DashboardData>('/api/admin/dashboard', signal), []);
  const hello = admin.name ? admin.name.split(' ')[0] : 'there';

  return (
    <>
      <PageHeader title={`Hello, ${hello}.`} description={data ? `Today is ${formatDate(data.today, { weekday: 'long', day: 'numeric', month: 'long' })}.` : undefined} actions={<Link to="/admin/bookings?status=pending" className="btn btn-primary btn-sm">Review pending requests</Link>} />

      {!features.email && (
        <p className="mb-6 rounded-xl border border-signal/30 bg-signal/[0.07] px-4 py-3 text-sm">
          Email notifications are <strong>not configured</strong>, so no booking emails are being sent. Add SMTP settings to the server’s environment to enable them (see README).
        </p>
      )}

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Pending requests" value={data.bookings.pending} to="/admin/bookings?status=pending" highlight={data.bookings.pending > 0} />
            <Stat label="Confirmed" value={data.bookings.confirmed} to="/admin/bookings?status=confirmed" />
            <Stat label="Completed" value={data.bookings.completed} to="/admin/bookings?status=completed" />
            <Stat label="Total bookings" value={data.bookings.total} to="/admin/bookings" />
            <Stat label="Available today" value={data.vehicles.availableToday} to="/admin/vehicles" />
            <Stat label="New enquiries" value={data.newEnquiries} to="/admin/enquiries" />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Panel
              className="xl:col-span-3"
              title="Upcoming confirmed trips"
              actions={
                <Link to="/admin/bookings?status=confirmed&sort=trip_asc" className="text-xs font-semibold text-navy">
                  View all
                </Link>
              }
            >
              {data.upcoming.length === 0 ? (
                <Empty title="No upcoming confirmed trips.">Confirmed bookings will appear here.</Empty>
              ) : (
                <ul className="-my-2 divide-y divide-line">
                  {data.upcoming.map((b) => (
                    <li key={b.id}>
                      <Link to={`/admin/bookings/${b.id}`} className="flex items-center gap-4 py-3 hover:text-navy">
                        <div className="w-14 shrink-0 rounded-xl bg-navy py-2 text-center text-ivory">
                          <p className="text-[0.65rem] font-semibold uppercase">{formatDate(b.tripDate, { month: 'short' })}</p>
                          <p className="display text-2xl leading-none">{formatDate(b.tripDate, { day: 'numeric' })}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">
                            {b.pickupLocation} → {b.destination}
                          </p>
                          <p className="truncate text-sm text-muted">
                            {b.customerName} · {formatTime(b.pickupTime)} · {b.vehicle?.name}
                          </p>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel className="xl:col-span-2" title="Fleet">
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="eyebrow text-muted">Active</dt>
                  <dd className="display mt-2 text-4xl">{data.vehicles.active}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-muted">Free today</dt>
                  <dd className="display mt-2 text-4xl">{data.vehicles.availableToday}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-muted">Disabled</dt>
                  <dd className="display mt-2 text-4xl">{data.vehicles.inactive}</dd>
                </div>
              </dl>
              <Link to="/admin/vehicles" className="btn btn-ghost btn-sm mt-6 w-full">
                Manage vehicles
              </Link>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Panel className="xl:col-span-3" title="Latest requests" actions={<Link to="/admin/bookings" className="text-xs font-semibold text-navy">All bookings</Link>}>
              {data.recent.length === 0 ? (
                <Empty title="No bookings yet.">
                  <Inbox className="mx-auto mb-2 size-5" aria-hidden="true" />
                  Requests from the website will appear here.
                </Empty>
              ) : (
                <ul className="-my-2 divide-y divide-line">
                  {data.recent.map((b) => (
                    <li key={b.id}>
                      <Link to={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:text-navy">
                        <span className="font-mono text-xs font-bold">{b.reference}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{b.customerName}</span>
                        <StatusBadge status={b.status} />
                        <span className="w-full text-xs text-muted sm:w-auto">{relativeTime(b.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="xl:col-span-2" title="Recent activity">
              {data.activity.length === 0 ? (
                <p className="text-sm text-muted">Nothing yet.</p>
              ) : (
                <ol className="space-y-4">
                  {data.activity.map((a) => (
                    <li key={a.id} className="text-sm">
                      <Link to={`/admin/bookings/${a.bookingId}`} className="font-semibold hover:text-navy">
                        {a.reference}
                      </Link>{' '}
                      <span className="text-ink/75">
                        {a.kind === 'created' && 'submitted by the customer'}
                        {a.kind === 'status' && `${STATUS_LABEL[a.fromStatus!]} → ${STATUS_LABEL[a.toStatus!]}`}
                        {a.kind === 'edit' && (a.note ?? 'edited')}
                        {a.kind === 'note' && 'note added'}
                      </span>
                      <span className="block text-xs text-muted">
                        {a.actor} · {relativeTime(a.at)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      ) : null}
    </>
  );
}
