import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { CATEGORY_LABEL } from '../../lib/format';
import { Img, cx } from '../../components/ui/primitives';
import { Empty, LoadError, PageHeader, useLoad } from '../ui';
import type { AdminVehicle } from '../types';

export default function Vehicles() {
  const { data, error, reload } = useLoad((s) => api.get<{ items: AdminVehicle[] }>('/api/admin/vehicles', s), []);
  return (
    <>
      <PageHeader
        title="Vehicles"
        description="Disabled vehicles are hidden from the website and can’t be booked."
        actions={
          <Link to="/admin/vehicles/new" className="btn btn-primary btn-sm">
            <Plus className="size-4" aria-hidden="true" /> Add vehicle
          </Link>
        }
      />
      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-72 rounded-2xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <Empty title="No vehicles yet.">Add your first vehicle to show it on the website.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((v) => (
            <li key={v.id}>
              <Link to={`/admin/vehicles/${v.id}`} className={cx('group block overflow-hidden rounded-2xl border border-line bg-ivory transition hover:shadow-lg', !v.isActive && 'opacity-70')}>
                <div className="relative aspect-[16/10] bg-fog">
                  {v.images[0] ? <Img img={v.images[0]} sizes="(min-width: 1280px) 25vw, 50vw" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-sm text-muted">No photos</div>}
                  <span className={cx('absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-bold', v.isActive ? 'bg-success text-ivory' : 'bg-ink/75 text-ivory')}>{v.isActive ? 'Live' : 'Disabled'}</span>
                  {v.isFeatured && <span className="absolute top-3 right-3 rounded-full bg-plate px-2.5 py-1 text-xs font-bold">Featured</span>}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="eyebrow text-muted">{CATEGORY_LABEL[v.category]}</p>
                  </div>
                  <p className="mt-2 text-lg font-bold group-hover:text-navy">{v.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {v.seats ? `${v.seats} seats` : 'Seats not set'} · {v.images.length} photo{v.images.length === 1 ? '' : 's'} · {v.upcomingCount} upcoming trip{v.upcomingCount === 1 ? '' : 's'}
                  </p>
                  {(v.dayRate == null && v.ratePerKm == null && !v.priceNote) && <p className="mt-2 text-xs text-warn">No pricing configured (price hidden on the website)</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
