import { Link } from 'react-router';
import { ArrowRight, ArrowUpRight, Users } from 'lucide-react';
import { CATEGORY_LABEL, money } from '../../lib/format';
import { CUTOUT_BY_VEHICLE, cutout } from '../../lib/media';
import type { Vehicle } from '../../lib/types';
import { FitImage, Img, cx } from '../ui/primitives';

export function PriceLine({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  const p = vehicle.pricing;
  if (!p) return null;
  const parts = [
    p.dayRate != null ? `${money(p.dayRate)} / day` : null,
    p.ratePerKm != null ? `${money(p.ratePerKm)} / km${p.minKmPerDay ? ` (min ${p.minKmPerDay} km/day)` : ''}` : null,
  ].filter(Boolean);
  return (
    <p className={className}>
      {parts.length > 0 && <span className="font-semibold">From {parts.join(' · ')}</span>}
      {p.note && <span className="block text-sm text-muted">{p.note}</span>}
    </p>
  );
}

export function SeatsLabel({ seats }: { seats: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Users className="size-4 text-signal" aria-hidden="true" />
      {seats ? `Up to ${seats} seats` : 'Seating on request'}
    </span>
  );
}

/**
 * One vehicle as a full-width editorial row: a studio stage (the cut-out, when we have one,
 * otherwise the whole cover photo) and a spec sheet. Rows alternate sides.
 */
export function VehicleCard({ vehicle, index = 0 }: { vehicle: Vehicle; index?: number }) {
  const cover = vehicle.images[0];
  const key = CUTOUT_BY_VEHICLE[vehicle.slug];
  const studio = key ? cutout(key) : null;
  const flip = index % 2 === 1;
  const href = `/vehicles/${vehicle.slug}`;

  return (
    <article className="group grid gap-8 border-t border-ink/15 pt-8 lg:grid-cols-12 lg:gap-12 lg:pt-12">
      <Link to={href} aria-label={`${vehicle.name} — view details`} className={cx('relative block lg:col-span-7', flip && 'lg:order-2 lg:col-start-6')}>
        <div className="relative aspect-[16/11] overflow-hidden bg-[radial-gradient(80%_70%_at_50%_100%,#ffffff,var(--color-fog))]">
          {studio ? (
            <>
              <span aria-hidden="true" className="absolute inset-x-0 bottom-[14%] h-px bg-ink/10" />
              <span aria-hidden="true" className="absolute inset-x-[18%] bottom-[11%] h-[6%] rounded-[50%] bg-ink/25 blur-xl" />
              {/* Parking box: every cut-out, wide or tall, is contained above the floor line */}
              <div className="absolute inset-x-[8%] top-[12%] bottom-[14%] flex items-end justify-center">
                <Img
                  img={studio}
                  sizes="(min-width: 1024px) 50vw, 92vw"
                  className="max-h-full w-auto max-w-full object-contain transition duration-[1.2s] ease-[var(--ease-out-soft)] group-hover:-translate-y-1 group-hover:scale-[1.03]"
                />
              </div>
            </>
          ) : cover ? (
            <FitImage img={cover} sizes="(min-width: 1024px) 50vw, 92vw" className="absolute inset-0" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-sm text-muted">Photo coming soon</span>
          )}
          <span className="eyebrow absolute top-4 left-4 text-ink/45">{CATEGORY_LABEL[vehicle.category]}</span>
        </div>
      </Link>

      <div className={cx('flex flex-col lg:col-span-5', flip && 'lg:order-1 lg:col-start-1')}>
        <p className="font-mono text-xs text-signal">{String(index + 1).padStart(2, '0')}</p>
        <h3 className="headline mt-3 text-h2">
          <Link to={href} className="transition hover:text-navy">
            {vehicle.name}
          </Link>
        </h3>
        {vehicle.tagline && <p className="mt-4 max-w-md text-muted">{vehicle.tagline}</p>}
        <dl className="mt-7 grid grid-cols-2 border-t border-ink/10 text-sm">
          <div className="border-b border-ink/10 py-3 pr-3">
            <dt className="eyebrow text-muted">Seating</dt>
            <dd className="mt-1 font-medium">
              <SeatsLabel seats={vehicle.seats} />
            </dd>
          </div>
          <div className="border-b border-l border-ink/10 py-3 pl-4">
            <dt className="eyebrow text-muted">Model</dt>
            <dd className="mt-1 font-medium">{vehicle.makeModel ?? '—'}</dd>
          </div>
        </dl>
        {vehicle.amenities.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink/70">
            {vehicle.amenities.slice(0, 4).map((a) => (
              <li key={a} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-1 bg-signal" />
                {a}
              </li>
            ))}
          </ul>
        )}
        <PriceLine vehicle={vehicle} className="mt-5 text-sm" />
        <div className="mt-8 flex flex-wrap gap-3 lg:mt-auto lg:pt-8">
          <Link to={`/book?vehicle=${vehicle.slug}`} className="btn btn-primary">
            Book this vehicle <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link to={href} className="btn btn-ghost">
            View details <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function VehicleCardSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-8 border-t border-ink/15 pt-8 lg:grid-cols-12 lg:gap-12 lg:pt-12">
      <div className="skeleton aspect-[16/11] lg:col-span-7" />
      <div className="space-y-4 lg:col-span-5">
        <div className="skeleton h-4 w-10" />
        <div className="skeleton h-12 w-3/4" />
        <div className="skeleton h-4 w-full" />
      </div>
    </div>
  );
}
