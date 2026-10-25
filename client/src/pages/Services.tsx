import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useSite } from '../lib/site';
import { useSeo } from '../lib/seo';
import { SERVICE_PHOTOS, photo } from '../lib/media';
import { FitImage, SectionMark, cx, isPortrait } from '../components/ui/primitives';
import { Reveal, RevealImage } from '../components/ui/Reveal';
import { ServiceIcon } from '../components/site/ServiceIcon';
import { ClosingCta } from './Home';

// Fleet photographs rotate alongside the services (admin can set a specific image path per service).
const ROTATION = SERVICE_PHOTOS.map((k) => photo(k));

export default function Services() {
  useSeo('Services', 'Tourist bus rental, travel cars, group and family trips, outstation journeys and sightseeing from Thiruvrambu, Kerala.');
  const { site } = useSite();
  const services = site?.services ?? [];

  return (
    <>
      <section className="pt-10 pb-16 lg:pt-16 lg:pb-24">
        <div className="wrap">
          <SectionMark n="03" label="Services" />
          <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:items-end">
            <h1 className="display text-h1 lg:col-span-7">
              Our <span className="text-azure">services</span>
            </h1>
            <p className="lede lg:col-span-5">Tourist travellers and cars for every kind of trip — from a family day out to a group tour across states.</p>
          </div>
          <nav aria-label="Services on this page" className="mt-12 border-t border-ink/15">
            <ol className="grid sm:grid-cols-2 lg:grid-cols-4">
              {services.map((s, i) => (
                <li key={s.slug} className="border-b border-ink/15">
                  <a href={`#${s.slug}`} className="group flex items-baseline gap-3 py-3.5 pr-4 text-[0.95rem] font-medium text-ink/70 transition hover:text-ink">
                    <span className="font-mono text-[0.65rem] text-signal">{String(i + 1).padStart(2, '0')}</span>
                    <span className="link-underline">{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      <div className="wrap space-y-24 pb-24 lg:space-y-36 lg:pb-36">
        {!site && <div className="skeleton h-96 rounded-[var(--radius-card)]" aria-busy="true" />}
        {services.map((s, i) => {
          const img = ROTATION[i % ROTATION.length]!;
          const flip = i % 2 === 1;
          return (
            <article key={s.slug} id={s.slug} className="grid scroll-mt-28 items-center gap-10 lg:grid-cols-12 lg:gap-16">
              <RevealImage className={cx('overflow-hidden lg:col-span-6', flip && 'lg:order-2 lg:col-start-7')}>
                {s.image ? (
                  <img src={s.image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <FitImage img={img} sizes="(min-width: 1024px) 45vw, 100vw" className={cx('w-full', isPortrait(img) ? 'aspect-[4/5] sm:aspect-[4/3]' : 'aspect-[4/3]')} imgClassName="saturate-[0.9] contrast-[1.05]" />
                )}
              </RevealImage>
              <Reveal className={cx('lg:col-span-5', flip ? 'lg:order-1 lg:col-start-1' : 'lg:col-start-8')}>
                <p className="flex items-center gap-3">
                  <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, '0')}</span>
                  <span aria-hidden="true" className="h-px w-8 bg-ink/20" />
                  <ServiceIcon name={s.icon} className="size-4 text-ink/50" />
                </p>
                <h2 className="headline mt-6 text-h2">{s.title}</h2>
                <p className="mt-5 text-lg font-medium text-ink/85">{s.summary}</p>
                {s.body && <p className="mt-4 leading-relaxed whitespace-pre-line text-muted">{s.body}</p>}
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to={`/book?category=${s.icon === 'car' ? 'car' : 'bus'}`} className="btn btn-primary btn-sm">
                    Book this service <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <Link to="/vehicles" className="btn btn-ghost btn-sm">
                    See vehicles
                  </Link>
                </div>
              </Reveal>
            </article>
          );
        })}
      </div>
      <ClosingCta />
    </>
  );
}
