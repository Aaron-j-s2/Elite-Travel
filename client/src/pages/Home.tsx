import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { ArrowRight, ArrowUpRight, Phone } from 'lucide-react';
import { useSite } from '../lib/site';
import { useSeo } from '../lib/seo';
import { CUTOUT_BY_VEHICLE, FLEET_LINEUP, INTERIORS, SERVICE_PHOTOS, cutout, photo, pickSrc } from '../lib/media';
import { CATEGORY_PLURAL, addDays, telHref, todayIST, whatsappHref } from '../lib/format';
import type { Category, Service, Vehicle } from '../lib/types';
import { Img, SectionMark, WhatsAppIcon, cx } from '../components/ui/primitives';
import { Reveal, RevealImage } from '../components/ui/Reveal';
import { PriceLine, SeatsLabel } from '../components/site/VehicleCard';
import { ENQUIRY_MESSAGE } from '../components/site/Layout';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Sets a headline with its final word in livery blue — the brand's signature accent. */
export function Headline({ text, light = false, className }: { text: string; light?: boolean; className?: string }) {
  const words = text.trim().split(' ');
  const last = words.pop();
  return (
    <span className={className}>
      {words.join(' ')} <span className={light ? 'text-azure-2' : 'text-azure'}>{last}</span>
    </span>
  );
}

/** Splits an editable headline into two lines: at the first comma, otherwise at the middle word. */
function twoLines(text: string): [string, string] {
  const comma = text.indexOf(',');
  if (comma > 0 && comma < text.length - 2) return [text.slice(0, comma + 1), text.slice(comma + 1).trim()];
  const words = text.trim().split(' ');
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

/** Applies one quiet colour grade to every phone-camera photograph so they sit together. */
const GRADE = 'saturate-[0.88] contrast-[1.06]';

/**
 * From tablet width up, each headline line sits on one row. The headline is editable, so instead of
 * guessing, measure the lines at a reference size and set `--fit` so the longer one fills the width.
 */
function useFitLines(ref: React.RefObject<HTMLElement | null>, max = 10.4) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.setProperty('--fit', '10cqw');
      const lines = [...el.querySelectorAll<HTMLElement>('[data-line]')];
      const widest = Math.max(...lines.map((l) => l.scrollWidth));
      if (widest > 0) el.style.setProperty('--fit', `${Math.min(max, (10 * el.clientWidth * 0.985) / widest).toFixed(3)}cqw`);
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, max]);
}

/* ========================================================================== */
/* Hero — a night showroom: the line-up under a spotlight, on a glossy floor  */
/* ========================================================================== */
function Hero() {
  const { site, contact } = useSite();
  const home = site?.settings.home;
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useFitLines(title, 8.8);
  const [line1, line2] = twoLines(home?.heroTitle ?? 'Travel together in comfort.');

  // Scroll: the headline lifts away faster than the fleet, for a little depth.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const titleY = useTransform(scrollYProgress, [0, 1], ['0%', '-35%']);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const fleetY = useTransform(scrollYProgress, [0, 1], ['0%', '-7%']);

  // Pointer: on desktop the spotlight and the fleet drift gently with the cursor.
  const drift = useMediaQuery('(hover: hover) and (pointer: fine)') && !reduce;
  const pointer = useMotionValue(0);
  const smooth = useSpring(pointer, { stiffness: 50, damping: 18 });
  const lightX = useTransform(smooth, (v) => `${50 + v * 14}%`);
  const fleetX = useTransform(smooth, (v) => v * -10);
  const spotlight = useMotionTemplate`radial-gradient(58% 62% at ${lightX} -6%, rgb(174 191 224 / 0.24), rgb(52 85 143 / 0.08) 45%, transparent 72%)`;

  const rise = (delay: number) =>
    reduce ? {} : { initial: { y: '108%' }, animate: { y: '0%' }, transition: { duration: 1.2, delay, ease: EASE } };
  const lineup = {
    src: pickSrc(FLEET_LINEUP, 1200),
    srcSet: FLEET_LINEUP.widths.map((w) => `${FLEET_LINEUP.base}-${w}.webp ${w}w`).join(', '),
    sizes: '(min-width: 1536px) 96rem, 100vw',
  };

  return (
    <>
      <section
        id="hero"
        ref={ref}
        onPointerMove={drift ? (e) => pointer.set((e.clientX / window.innerWidth - 0.5) * 2) : undefined}
        className="grain relative -mt-[4.5rem] overflow-hidden bg-[#070a12] pt-[4.5rem] text-ivory"
        aria-labelledby="hero-title"
      >
        {/* Lights on: the spotlight fades up first, then the fleet rolls into focus */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: spotlight }}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[length:calc(100%/6)_100%] lg:block" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-black/50" />

        <div className="wrap relative pt-6 lg:pt-9">
          <motion.div
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <p className="eyebrow flex items-center gap-3 text-ivory/55">
              <span aria-hidden="true" className="stripe !w-6" />
              {home?.heroEyebrow ?? 'Tourist buses and travel cars · Thiruvrambu, Kerala'}
            </p>
            <p className="eyebrow hidden text-ivory/55 md:block">Book directly — call, WhatsApp or online</p>
          </motion.div>

          <motion.h1
            ref={title}
            id="hero-title"
            style={reduce ? undefined : { y: titleY, opacity: titleOpacity }}
            className="display relative mt-7 [container-type:inline-size] lg:mt-8"
          >
            <span className="block overflow-hidden pb-[0.04em] text-[12.4cqw] leading-[0.92] md:text-[length:var(--fit)] md:whitespace-nowrap">
              <motion.span data-line className="block md:inline-block" {...rise(0.35)}>
                {line1}
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.04em] text-[12.4cqw] leading-[0.92] md:text-right md:text-[length:var(--fit)] md:whitespace-nowrap">
              <motion.span data-line className="block text-azure-2 md:inline-block" {...rise(0.47)}>
                {line2}
              </motion.span>
            </span>
          </motion.h1>
        </div>

        {/* The whole line-up at every screen size, on a glossy showroom floor */}
        <motion.div style={reduce ? undefined : { y: fleetY, x: fleetX }} className="relative z-10 mx-auto mt-8 w-full max-w-[96rem] px-2 sm:mt-6 sm:px-6 lg:-mt-[0.6vw]">
          <motion.div
            className="relative"
            initial={reduce ? false : { opacity: 0, y: 60, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.6, delay: 0.6, ease: EASE }}
          >
            <div aria-hidden="true" className="absolute inset-x-[2%] -bottom-[8%] h-[30%] bg-[radial-gradient(closest-side,rgb(174_191_224/0.20),transparent)] blur-md" />
            <img
              src={lineup.src}
              srcSet={lineup.srcSet}
              sizes={lineup.sizes}
              width={FLEET_LINEUP.width}
              height={FLEET_LINEUP.height}
              alt={FLEET_LINEUP.alt}
              fetchPriority="high"
              decoding="async"
              className="relative w-full drop-shadow-[0_24px_30px_rgb(0_0_0/0.55)]"
            />
            {/* Mirror reflection on the floor, fading out quickly */}
            <div aria-hidden="true" className="relative aspect-[2073/170] overflow-hidden [mask-image:linear-gradient(to_bottom,rgb(0_0_0/0.5),transparent_85%)]">
              <img src={lineup.src} srcSet={lineup.srcSet} sizes={lineup.sizes} alt="" decoding="async" className="w-full -scale-y-100 opacity-40 blur-[1.5px]" />
            </div>
            <span aria-hidden="true" className="absolute inset-x-0 top-[77.6%] h-px bg-gradient-to-r from-transparent via-ivory/25 to-transparent" />
          </motion.div>
        </motion.div>

        <div className="wrap relative z-10 pt-2 pb-28 lg:pb-36">
          <motion.div
            className="grid gap-8 border-t border-ivory/10 pt-7 lg:grid-cols-12 lg:items-start lg:gap-10"
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.1, ease: EASE }}
          >
            <p className="max-w-xl text-[1.05rem] leading-relaxed text-ivory/70 sm:text-[1.15rem] lg:col-span-5">
              {home?.heroText ?? 'Hire a tourist traveller or a car for family trips, group tours, outstation journeys and sightseeing. You book directly with us — the people who own and run the vehicles.'}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:col-span-4 lg:col-start-6">
              <Link to="/book" className="btn btn-light">
                Book your ride <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link to="/vehicles" className="btn btn-ghost-light">
                See our vehicles
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium lg:col-span-3 lg:flex-col lg:items-end lg:text-right">
              <a href={telHref(contact.phone)} className="link-underline inline-flex items-center gap-2 text-ivory/80 hover:text-ivory">
                <Phone className="size-3.5 text-signal-2" aria-hidden="true" />
                {contact.phone}
              </a>
              <a href={whatsappHref(contact.whatsapp, ENQUIRY_MESSAGE)} target="_blank" rel="noopener noreferrer" className="link-underline inline-flex items-center gap-2 text-ivory/80 hover:text-ivory">
                <WhatsAppIcon className="size-3.5 text-[#5fd08a]" />
                WhatsApp us
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The trip planner straddles the edge between the showroom and the page */}
      <section aria-label="Plan a trip" className="relative z-20 -mt-16 pb-16 lg:-mt-20 lg:pb-20">
        <motion.div className="wrap" initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 1.3, ease: EASE }}>
          <QuickBook />
        </motion.div>
      </section>
    </>
  );
}

/** Compact trip planner — carries what's typed into the full booking form. */
function QuickBook() {
  const navigate = useNavigate();
  const [cat, setCat] = useState<Category>('bus');
  const today = todayIST();

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const qs = new URLSearchParams({ category: cat });
    for (const k of ['from', 'to', 'date', 'pax']) {
      const v = String(fd.get(k) ?? '').trim();
      if (v) qs.set(k, v);
    }
    navigate(`/book?${qs}`);
  };

  const fields = [
    { name: 'from', label: 'Pickup', placeholder: 'Thiruvrambu', type: 'text' },
    { name: 'to', label: 'Destination', placeholder: 'Where to?', type: 'text' },
    { name: 'date', label: 'Date', placeholder: '', type: 'date' },
    { name: 'pax', label: 'Passengers', placeholder: '12', type: 'number' },
  ];

  return (
    <form onSubmit={submit} aria-label="Start a booking" className="grid overflow-hidden rounded-[5px] border border-ink/10 bg-ivory shadow-[0_30px_60px_-40px_rgb(10_15_28/0.5)] lg:grid-cols-[auto_1fr_auto]">
      <div className="flex gap-1 p-2 lg:flex-col lg:justify-center lg:p-3">
        {(['bus', 'car'] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
            className={cx('flex-1 rounded-[3px] px-4 py-2.5 text-left text-sm font-semibold transition lg:min-w-36 lg:flex-none', cat === c ? 'bg-navy text-ivory' : 'text-ink/55 hover:bg-fog hover:text-ink')}
          >
            {CATEGORY_PLURAL[c]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 border-t border-ink/10 lg:grid-cols-4 lg:border-t-0 lg:border-l">
        {fields.map((f, i) => (
          <label
            key={f.name}
            className={cx(
              'group relative flex cursor-text flex-col justify-center gap-1.5 px-5 py-4 transition focus-within:bg-fog/60',
              i % 2 === 1 && 'border-l border-ink/10',
              i > 1 && 'border-t border-ink/10 lg:border-t-0',
              i === 2 && 'lg:border-l',
            )}
          >
            <span className="eyebrow flex items-center gap-2 text-muted">
              <span className="font-mono text-[0.6rem] text-signal">0{i + 1}</span> {f.label}
            </span>
            <input
              name={f.name}
              type={f.type}
              placeholder={f.placeholder}
              min={f.type === 'date' ? today : f.type === 'number' ? 1 : undefined}
              max={f.type === 'date' ? addDays(today, 400) : f.type === 'number' ? 80 : undefined}
              inputMode={f.type === 'number' ? 'numeric' : undefined}
              className="w-full min-w-0 bg-transparent text-base font-semibold text-ink placeholder:text-ink/30 focus:outline-none"
            />
            <span aria-hidden="true" className="absolute inset-x-5 bottom-0 h-px origin-left scale-x-0 bg-navy transition-transform duration-500 group-focus-within:scale-x-100" />
          </label>
        ))}
      </div>
      <div className="border-t border-ink/10 p-2 lg:border-t-0 lg:border-l lg:p-3">
        <button type="submit" className="btn btn-primary h-full w-full lg:px-9">
          Start booking <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

/* ========================================================================== */
/* Fleet showcase — a studio stage with a spec sheet                           */
/* ========================================================================== */
function FleetShowcase() {
  const { site, vehicles } = useSite();
  const home = site?.settings.home;
  const reduce = useReducedMotion();
  const groups = useMemo(() => {
    const all = vehicles ?? [];
    return { bus: all.filter((v) => v.category === 'bus'), car: all.filter((v) => v.category === 'car') };
  }, [vehicles]);
  const [cat, setCat] = useState<Category>('bus');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = groups[cat];
  const selected = list.find((v) => v.id === selectedId) ?? list[0] ?? null;
  const index = selected ? list.indexOf(selected) : 0;

  return (
    <section className="grain relative overflow-hidden bg-ink py-24 text-ivory lg:py-32" aria-labelledby="fleet-title">
      <div className="wrap">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionMark n="01" label="The fleet" light />
            <h2 id="fleet-title" className="display mt-7 text-h1">
              <Headline text={home?.fleetTitle ?? 'Choose your vehicle.'} light />
            </h2>
          </div>
          <p className="max-w-md text-ivory/60 lg:col-span-4 lg:justify-self-end">{home?.fleetText}</p>
        </div>

        <div role="tablist" aria-label="Vehicle type" className="mt-14 flex gap-8 border-b border-ivory/10">
          {(['bus', 'car'] as const).map((c) => (
            <button
              key={c}
              role="tab"
              id={`tab-${c}`}
              aria-selected={cat === c}
              aria-controls="fleet-panel"
              onClick={() => {
                setCat(c);
                setSelectedId(null);
              }}
              className={cx('relative -mb-px flex items-baseline gap-2 border-b py-3 text-sm font-semibold transition', cat === c ? 'border-ivory text-ivory' : 'border-transparent text-ivory/45 hover:text-ivory/80')}
            >
              {CATEGORY_PLURAL[c]} <span className="font-mono text-[0.65rem] opacity-60">({groups[c].length})</span>
            </button>
          ))}
        </div>

        <div id="fleet-panel" role="tabpanel" aria-labelledby={`tab-${cat}`} className="mt-10">
          {!vehicles ? (
            <div className="skeleton aspect-[16/8] opacity-10" />
          ) : !selected ? (
            <p className="border border-ivory/15 p-10 text-center text-ivory/70">
              No {CATEGORY_PLURAL[cat].toLowerCase()} are listed right now. Call us and we will help you find the right vehicle.
            </p>
          ) : (
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              {/* Stage */}
              <div className="relative lg:col-span-8">
                <div className="relative isolate flex aspect-[4/3] items-end justify-center overflow-hidden border border-ivory/10 bg-[radial-gradient(70%_60%_at_50%_0%,rgb(141_180_255/0.16),transparent_70%),linear-gradient(#0d1424,#070a12)] sm:aspect-[16/10]">
                  {/* Floor line and spec-sheet corners */}
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-[14%] h-px bg-gradient-to-r from-transparent via-ivory/20 to-transparent" />
                  <span className="eyebrow absolute top-4 left-4 text-ivory/45">
                    {String(index + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}
                  </span>
                  <span className="eyebrow absolute bottom-4 left-4 text-ivory/45">{selected.makeModel ?? CATEGORY_PLURAL[cat]}</span>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`name-${selected.id}`}
                      aria-hidden="true"
                      className="display pointer-events-none absolute inset-x-0 top-[12%] -z-10 text-center text-[clamp(2.6rem,9vw,8rem)] leading-[0.85] whitespace-nowrap text-ivory/[0.06]"
                      initial={reduce ? false : { opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ duration: 0.6 }}
                    >
                      {selected.makeModel ?? selected.name}
                    </motion.p>
                  </AnimatePresence>
                  <div aria-hidden="true" className="absolute inset-x-[14%] bottom-[11%] h-[7%] rounded-[50%] bg-black/70 blur-2xl" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selected.id}
                      className="absolute inset-x-[7%] top-[16%] bottom-[14%] flex items-end justify-center"
                      initial={reduce ? false : { opacity: 0, x: 80 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -80 }}
                      transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
                    >
                      <StageImage vehicle={selected} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Details & selector */}
              <div className="flex flex-col lg:col-span-4">
                <AnimatePresence mode="wait">
                  <motion.div key={selected.id} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45 }}>
                    <p className="eyebrow text-azure-2">{selected.makeModel ?? (selected.category === 'bus' ? 'Tourist bus' : 'Travel car')}</p>
                    <h3 className="headline mt-3 text-h2">{selected.name}</h3>
                    {selected.tagline && <p className="mt-4 text-ivory/65">{selected.tagline}</p>}
                    <dl className="mt-7 grid grid-cols-2 border-t border-ivory/10 text-sm">
                      <div className="border-b border-ivory/10 py-3 pr-3">
                        <dt className="eyebrow text-ivory/40">Seating</dt>
                        <dd className="mt-1 text-ivory/90">
                          <SeatsLabel seats={selected.seats} />
                        </dd>
                      </div>
                      <div className="border-b border-l border-ivory/10 py-3 pl-4">
                        <dt className="eyebrow text-ivory/40">Category</dt>
                        <dd className="mt-1 text-ivory/90">{selected.category === 'bus' ? 'Tourist bus' : 'Travel car'}</dd>
                      </div>
                    </dl>
                    {selected.amenities.length > 0 && (
                      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ivory/70">
                        {selected.amenities.slice(0, 5).map((a) => (
                          <li key={a} className="flex items-center gap-2">
                            <span aria-hidden="true" className="size-1 bg-signal-2" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                    <PriceLine vehicle={selected} className="mt-5 text-ivory/90" />
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link to={`/book?vehicle=${selected.slug}`} className="btn btn-light">
                        Book this vehicle <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                      <Link to={`/vehicles/${selected.slug}`} className="btn btn-ghost-light">
                        Details
                      </Link>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {list.length > 1 && (
                  <ol className="mt-10 border-t border-ivory/10 lg:mt-auto">
                    {list.map((v, i) => (
                      <li key={v.id} className="border-b border-ivory/10">
                        <button
                          type="button"
                          onClick={() => setSelectedId(v.id)}
                          aria-current={v.id === selected.id}
                          className={cx('flex w-full items-center gap-4 py-4 text-left transition', v.id === selected.id ? 'text-ivory' : 'text-ivory/45 hover:text-ivory/85')}
                        >
                          <span className="font-mono text-xs text-ivory/40">{String(i + 1).padStart(2, '0')}</span>
                          <span className="flex-1 font-medium">{v.name}</span>
                          {v.id === selected.id ? <span aria-hidden="true" className="stripe !w-5" /> : <ArrowRight className="size-4 opacity-40" aria-hidden="true" />}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-14">
          <Link to="/vehicles" className="link-arrow text-ivory">
            See all vehicles <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function StageImage({ vehicle }: { vehicle: Vehicle }) {
  const key = CUTOUT_BY_VEHICLE[vehicle.slug];
  if (key) {
    const c = cutout(key);
    return <Img img={c} sizes="(min-width: 1024px) 55vw, 88vw" className="max-h-full w-auto max-w-full object-contain drop-shadow-[0_30px_30px_rgb(0_0_0/0.5)]" />;
  }
  const cover = vehicle.images[0];
  if (!cover) return null;
  return <Img img={cover} sizes="(min-width: 1024px) 55vw, 88vw" className="size-full object-cover" />;
}

/* ========================================================================== */
/* Cabin interiors — a horizontal walk through the cabins                     */
/* ========================================================================== */
function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

function Interiors() {
  const shots = INTERIORS.map((k) => photo(k));
  const reduce = useReducedMotion();
  const wide = useMediaQuery('(min-width: 1024px)');
  const pinned = wide && !reduce;
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  useEffect(() => {
    if (!pinned || !track.current) return;
    const el = track.current;
    const measure = () => setDistance(Math.max(0, el.scrollWidth - window.innerWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pinned]);

  const intro = (
    <div className="flex shrink-0 flex-col justify-between lg:w-[34vw] lg:pr-[4vw]">
      <div>
        <SectionMark n="02" label="Inside our vehicles" light />
        <h2 id="cabins-title" className="display mt-7 text-h1">
          Comfort <span className="text-azure-2">on every trip.</span>
        </h2>
      </div>
      <p className="mt-6 max-w-md text-ivory/60 lg:mt-0">
        Push-back seats, curtains and soft lighting. These photos were taken inside our own vehicles — ask us which one suits your trip.
      </p>
    </div>
  );

  const frames = shots.map((s, i) => (
    <figure key={s.base} className={cx('group shrink-0 snap-start', i === 0 ? 'w-[72vw] sm:w-[44vw] lg:w-[26vw]' : 'w-[84vw] sm:w-[60vw] lg:w-[40vw]')}>
      <div className={cx('overflow-hidden', i === 0 ? 'aspect-[3/4]' : 'aspect-[4/3]')} style={{ backgroundColor: s.tone }}>
        <Img img={s} sizes="(min-width: 1024px) 40vw, 84vw" className={cx('size-full object-cover transition duration-[1.6s] ease-[var(--ease-out-soft)] group-hover:scale-[1.04]', GRADE)} />
      </div>
      <figcaption className="mt-3 flex gap-3 text-[0.8rem] text-ivory/50">
        <span className="font-mono text-ivory/35">{String(i + 1).padStart(2, '0')}</span>
        <span className="line-clamp-2 max-w-sm">{s.alt}</span>
      </figcaption>
    </figure>
  ));

  if (!pinned) {
    return (
      <section className="grain relative bg-ink pt-6 pb-24 text-ivory" aria-labelledby="cabins-title">
        <div className="wrap">{intro}</div>
        <div className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 sm:scroll-px-6 sm:px-6">{frames}</div>
      </section>
    );
  }

  return (
    <section ref={section} className="grain relative bg-ink text-ivory" style={{ height: `calc(100vh + ${distance}px)` }} aria-labelledby="cabins-title">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <motion.div ref={track} style={{ x }} className="flex w-max items-end gap-[3vw] pr-10 pl-10">
          {intro}
          {frames}
        </motion.div>
        <div className="wrap mt-12 flex items-center gap-4">
          <span className="eyebrow text-ivory/40">Scroll</span>
          <div className="relative h-px flex-1 bg-ivory/10">
            <motion.span style={{ scaleX: progress }} className="absolute inset-0 origin-left bg-ivory/60" />
          </div>
          <span className="eyebrow text-ivory/40">{String(shots.length).padStart(2, '0')} cabins</span>
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Services — an index, with a photograph that follows the cursor            */
/* ========================================================================== */
const serviceSrc = (s: Service, i: number) => s.image ?? pickSrc(photo(SERVICE_PHOTOS[i % SERVICE_PHOTOS.length]!), 960);

function Services() {
  const { site } = useSite();
  const services = site?.services ?? [];
  const reduce = useReducedMotion();
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)');
  const [active, setActive] = useState<number | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 26 });
  const sy = useSpring(my, { stiffness: 220, damping: 26 });

  const onMove = (e: MouseEvent) => {
    const r = list.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };

  return (
    <section className="py-24 lg:py-36" aria-labelledby="services-title">
      <div className="wrap">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <SectionMark n="03" label="Services" />
            <h2 id="services-title" className="headline mt-7 text-h2">
              <Headline text={site?.settings.home.servicesTitle ?? 'A vehicle for every kind of trip.'} />
            </h2>
          </div>
          <Link to="/services" className="link-arrow justify-self-start lg:col-span-4 lg:justify-self-end">
            All services <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <ol ref={list} onMouseMove={fine ? onMove : undefined} onMouseLeave={() => setActive(null)} className="relative mt-14 border-t border-ink/15 lg:mt-20">
          {fine && !reduce && (
            <motion.div aria-hidden="true" style={{ x: sx, y: sy }} className="pointer-events-none absolute top-0 left-0 z-20 hidden lg:block">
              <AnimatePresence>
                {active != null && services[active] && (
                  <motion.img
                    key={active}
                    src={serviceSrc(services[active], active)}
                    alt=""
                    className={cx('-translate-x-1/2 -translate-y-[115%] aspect-[4/3] w-[22rem] object-cover shadow-[0_30px_60px_-30px_rgb(10_15_28/0.6)]', GRADE)}
                    initial={{ opacity: 0, scale: 0.92, clipPath: 'inset(30% 30% 30% 30%)' }}
                    animate={{ opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0%)' }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.45, ease: EASE }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}
          {services.map((s, i) => (
            <Reveal as="li" key={s.slug} delay={0.03 * i} className="border-b border-ink/15">
              <Link
                to={`/services#${s.slug}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                className="group grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-x-3 gap-y-2 py-6 sm:grid-cols-[3.5rem_1fr_auto] lg:grid-cols-[4rem_minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-center lg:py-8"
              >
                <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, '0')}</span>
                <span className="headline text-[clamp(1.45rem,1rem+2vw,2.6rem)] leading-[1.05] transition-[color,transform] duration-500 ease-[var(--ease-out-soft)] group-hover:translate-x-2 group-hover:text-navy">
                  {s.title}
                </span>
                <span className="col-start-2 max-w-md text-[0.95rem] text-muted lg:col-start-3">{s.summary}</span>
                <span className="col-start-3 row-start-1 grid size-10 place-items-center rounded-full border border-ink/15 text-ink/60 transition duration-500 group-hover:border-navy group-hover:bg-navy group-hover:text-ivory lg:col-start-4">
                  <ArrowUpRight className="size-4 transition-transform duration-500 group-hover:rotate-45" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          ))}
          {!services.length && <li className="skeleton my-6 h-40" aria-hidden="true" />}
        </ol>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Travel experiences — night photograph, then the itinerary                  */
/* ========================================================================== */
function Experiences() {
  const { site } = useSite();
  const home = site?.settings.home;
  const items = site?.settings.experiences.items ?? [];
  const night = photo('traveller-elite-livery-night-profile');
  const reduce = useReducedMotion();
  const frame = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: frame, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);
  // Parallax needs spare image above and below the frame, so it only runs on wide screens;
  // phones get the whole photo in a landscape frame with the heading underneath.
  const parallax = useMediaQuery('(min-width: 1024px)') && !reduce;

  return (
    <section aria-labelledby="exp-title">
      <div className="relative bg-ink text-ivory">
        <div ref={frame} className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/9] lg:aspect-auto lg:h-[92vh]">
          <motion.div style={parallax ? { y } : undefined} className="absolute inset-0 lg:-inset-y-[10%]">
            <Img img={night} sizes="100vw" className={cx('size-full object-cover', GRADE)} />
          </motion.div>
          <div className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgb(11_15_25/0.35),transparent_35%,rgb(11_15_25/0.85))] lg:block" />
        </div>
        <div className="wrap pt-8 pb-12 lg:absolute lg:inset-x-0 lg:bottom-0 lg:pt-0 lg:pb-16">
          <SectionMark n="04" label="Travel experiences" light />
          <h2 id="exp-title" className="display mt-6 max-w-5xl text-h1">
            <Headline text={home?.experiencesTitle ?? 'Plan the trip your way.'} light />
          </h2>
        </div>
      </div>

      <div className="wrap grid gap-12 py-20 lg:grid-cols-12 lg:py-28">
        <p className="lede lg:col-span-4">{home?.experiencesText}</p>
        <ol className="grid gap-x-10 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
          {items.map((x, i) => (
            <Reveal as="li" key={x.title} delay={0.05 * (i % 2)} className="border-t border-ink/15 py-6">
              <p className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-signal">{String(i + 1).padStart(2, '0')}</span>
                <span className="headline text-xl">{x.title}</span>
              </p>
              <p className="mt-2 pl-8 text-[0.95rem] text-muted">{x.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Why choose us + how booking works                                           */
/* ========================================================================== */
function WhyChoose() {
  const { site } = useSite();
  const items = site?.settings.whyChoose.items ?? [];
  if (!site) return null;
  return (
    <section className="bg-ivory py-24 lg:py-32" aria-labelledby="why-title">
      <div className="wrap">
        <SectionMark n="05" label="Why Elite" />
        <h2 id="why-title" className="headline mt-7 max-w-3xl text-h2">
          <Headline text={site.settings.home.whyTitle} />
        </h2>
        <div className="mt-16 grid border-t border-ink/15 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((x, i) => (
            <Reveal
              key={x.title}
              delay={0.06 * i}
              className={cx('flex flex-col border-b border-ink/15 py-8 sm:px-6 lg:min-h-[24rem] lg:border-b-0 lg:px-7 lg:py-10', i % 2 === 1 && 'sm:border-l', i > 0 && 'lg:border-l', i === 0 && 'sm:pl-0 lg:pl-0')}
            >
              <span className="display text-[3.6rem] leading-none text-navy/15">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="headline mt-8 text-[1.3rem] leading-tight lg:mt-auto">{x.title}</h3>
              <p className="mt-3 text-[0.95rem] text-muted">{x.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { t: 'Choose a vehicle', d: 'Look through our vehicles and pick a traveller or a car. Not sure? We can suggest one.' },
    { t: 'Send your trip details', d: 'Tell us the date, pickup point, destination and number of passengers. You get a booking reference straight away.' },
    { t: 'We confirm with you', d: 'We check your request, agree the vehicle and fare with you, and update your booking status.' },
  ];
  return (
    <section className="py-24 lg:py-32" aria-labelledby="how-title">
      <div className="wrap">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionMark n="06" label="How booking works" />
            <h2 id="how-title" className="headline mt-7 text-h2">
              Book in three <span className="text-azure">simple steps.</span>
            </h2>
          </div>
          <Link to="/booking/status" className="link-arrow self-start lg:self-auto">
            Already booked? Check your booking <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <ol className="relative mt-16 grid gap-12 lg:grid-cols-3 lg:gap-10">
          <span aria-hidden="true" className="route-line absolute top-[1.25rem] right-[10%] left-[2.5rem] hidden text-ink/30 lg:block" />
          <span aria-hidden="true" className="route-line-v absolute top-[2.5rem] bottom-8 left-[1.25rem] text-ink/30 lg:hidden" />
          {steps.map((s, i) => (
            <Reveal as="li" key={s.t} delay={0.1 * i} className="relative grid grid-cols-[2.5rem_1fr] gap-5 lg:block">
              <span className={cx('relative z-10 grid size-10 place-items-center font-mono text-sm font-bold', i === 2 ? 'bg-azure text-ivory' : 'bg-navy text-ivory')}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="lg:mt-8">
                <h3 className="headline text-h3">{s.t}</h3>
                <p className="mt-3 max-w-sm text-muted">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* Testimonials — genuine only. Without them, an editorial fleet photograph.  */
/* ========================================================================== */
function VoicesOrLineup() {
  const { site } = useSite();
  const testimonials = site?.testimonials ?? [];
  if (testimonials.length) {
    return (
      <section className="border-t border-ink/10 py-24 lg:py-32" aria-labelledby="voices-title">
        <div className="wrap">
          <SectionMark n="07" label="From our travellers" />
          <h2 id="voices-title" className="sr-only">
            Customer reviews
          </h2>
          <div className="no-scrollbar mt-12 -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
            {testimonials.map((t) => (
              <figure key={t.id} className="w-[85%] shrink-0 snap-start border-t-2 border-navy pt-8 sm:w-[60%] lg:w-auto">
                <blockquote className="headline text-[1.45rem] leading-snug !font-normal">“{t.quote}”</blockquote>
                <figcaption className="mt-8 text-sm">
                  <span className="font-bold">{t.authorName}</span>
                  {t.authorPlace && <span className="text-muted"> · {t.authorPlace}</span>}
                  {t.tripLabel && <span className="eyebrow mt-1 block text-signal">{t.tripLabel}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }
  const lineup = photo('fleet-three-travellers-lineup');
  return (
    <section aria-label="The Elite Travel Hub line-up" className="relative">
      <RevealImage className="relative bg-ink text-ivory">
        <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/9] lg:aspect-auto lg:h-[86vh]">
          <Img img={lineup} sizes="100vw" className={cx('size-full object-cover', GRADE)} />
          <div className="absolute inset-0 hidden bg-gradient-to-t from-ink/80 via-ink/10 to-transparent lg:block" />
        </div>
        <div className="wrap pt-8 pb-12 lg:absolute lg:inset-x-0 lg:bottom-0 lg:pt-0 lg:pb-16">
          <p className="eyebrow text-ivory/60">Our fleet</p>
          <p className="display mt-4 max-w-4xl text-h2">Ready for your next trip.</p>
        </div>
      </RevealImage>
    </section>
  );
}

/* ========================================================================== */
/* Closing call to action                                                      */
/* ========================================================================== */
export function ClosingCta() {
  const { site, contact } = useSite();
  const home = site?.settings.home;
  const front = cutout('traveller-elite-livery-front');
  return (
    <section className="grain relative overflow-hidden bg-navy text-ivory" aria-labelledby="cta-title">
      <div aria-hidden="true" className="pointer-events-none absolute -right-[8%] -bottom-[30%] h-[80%] w-[70%] bg-[radial-gradient(closest-side,rgb(141_180_255/0.22),transparent)]" />
      <div className="wrap relative grid items-end gap-12 py-24 lg:grid-cols-12 lg:py-32">
        <div className="lg:col-span-8">
          <SectionMark n="—" label="Book your trip" light />
          <h2 id="cta-title" className="display mt-7 text-h1">
            <Headline text={home?.ctaTitle ?? 'Ready to plan your trip?'} light />
          </h2>
          <p className="mt-6 max-w-lg text-ivory/70">{home?.ctaText}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/book" className="btn btn-light">
              Book your ride <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href={whatsappHref(contact.whatsapp, ENQUIRY_MESSAGE)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-light">
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
          </div>
          <div className="mt-12 border-t border-ivory/15 pt-6">
            <p className="eyebrow text-ivory/50">Or call us</p>
            <a href={telHref(contact.phone)} className="display mt-3 inline-block text-[clamp(1.7rem,5vw,3.4rem)] leading-none transition hover:text-azure-2">
              {contact.phone}
            </a>
            <p className="mt-4 text-sm text-ivory/55">
              Email{' '}
              <a href={`mailto:${contact.email}`} className="underline underline-offset-4 hover:text-ivory">
                {contact.email}
              </a>
            </p>
          </div>
        </div>
        <div className="relative hidden lg:col-span-4 lg:block">
          <div aria-hidden="true" className="absolute inset-x-[10%] bottom-[2%] h-10 rounded-[50%] bg-black/50 blur-2xl" />
          <Reveal y={40}>
            <Img img={front} sizes="32vw" className="relative mx-auto w-[92%] drop-shadow-[0_30px_30px_rgb(0_0_0/0.4)]" />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { site } = useSite();
  useSeo(null, site?.settings.seo.description);
  return (
    <>
      <Hero />
      <FleetShowcase />
      <Interiors />
      <Services />
      <Experiences />
      <WhyChoose />
      <HowItWorks />
      <VoicesOrLineup />
      <ClosingCta />
    </>
  );
}
