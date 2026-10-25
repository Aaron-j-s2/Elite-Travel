import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CalendarCheck2, CalendarX2, Check, Copy, Info, Phone } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useSite } from '../../lib/site';
import { zodResolver } from '../../lib/zodResolver';
import {
  CATEGORY_LABEL,
  TRIP_LABEL,
  addDays,
  daysInclusive,
  formatDate,
  formatTime,
  money,
  telHref,
  todayIST,
  whatsappHref,
} from '../../lib/format';
import type { BusyRange, Category, TripType, Vehicle } from '../../lib/types';
import { FormAlert, SelectField, Spinner, TextAreaField, TextField, WhatsAppIcon, cx } from '../ui/primitives';

const needsReturn = (t: TripType) => t === 'round_trip' || t === 'multi_day';

const schema = z
  .object({
    vehicleCategory: z.enum(['bus', 'car'], { error: 'Choose a vehicle type' }),
    vehicleId: z.string(),
    tripType: z.enum(['one_way', 'round_trip', 'multi_day', 'local'], { error: 'Choose a trip type' }),
    pickupLocation: z.string().trim().min(2, 'Where should we pick you up?').max(160),
    destination: z.string().trim().min(2, 'Where are you going?').max(160),
    tripDate: z.string().min(1, 'Choose a date'),
    returnDate: z.string(),
    pickupTime: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a pickup time'),
    passengers: z.coerce.number({ error: 'How many people?' }).int('Whole numbers only').min(1, 'At least 1').max(80, 'At most 80'),
    customerName: z.string().trim().min(2, 'Please enter your name').max(120),
    customerPhone: z
      .string()
      .trim()
      .refine((v) => {
        const d = v.replace(/\D/g, '');
        return /^(?:91|0)?[6-9]\d{9}$/.test(d) || (v.startsWith('+') && d.length >= 8 && d.length <= 15);
      }, 'Enter a valid mobile number'),
    customerEmail: z.union([z.literal(''), z.email('Enter a valid email address')]),
    requirements: z.string().max(1000, 'Please keep it under 1000 characters'),
    website: z.string(),
  })
  .superRefine((v, ctx) => {
    const today = todayIST();
    if (v.tripDate && v.tripDate < today) ctx.addIssue({ code: 'custom', path: ['tripDate'], message: 'Trip date can’t be in the past' });
    if (needsReturn(v.tripType) && !v.returnDate) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'Add a return date' });
    if (v.returnDate && v.tripDate && v.returnDate < v.tripDate) ctx.addIssue({ code: 'custom', path: ['returnDate'], message: 'Return must be on or after the trip date' });
  });

type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

export interface BookingPrefill {
  vehicleId?: string;
  vehicleCategory?: Category;
  pickupLocation?: string;
  destination?: string;
  tripDate?: string;
  passengers?: string;
}

interface Submitted {
  reference: string;
  duplicate: boolean;
  estimatedPrice: number | null;
  values: FormOut;
  vehicle: Vehicle | null;
}

function overlaps(busy: BusyRange[], from: string, to: string) {
  return busy.filter((b) => b.start <= to && b.end >= from);
}

export function BookingForm({ prefill, lockVehicle = false }: { prefill?: BookingPrefill; lockVehicle?: boolean }) {
  const { vehicles } = useSite();
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const initialVehicle = vehicles?.find((v) => v.id === prefill?.vehicleId);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    shouldFocusError: true,
    defaultValues: {
      vehicleCategory: initialVehicle?.category ?? prefill?.vehicleCategory ?? 'bus',
      vehicleId: initialVehicle?.id ?? '',
      tripType: 'round_trip',
      pickupLocation: prefill?.pickupLocation ?? '',
      destination: prefill?.destination ?? '',
      tripDate: prefill?.tripDate && prefill.tripDate >= todayIST() ? prefill.tripDate : '',
      returnDate: '',
      pickupTime: '',
      passengers: prefill?.passengers ?? '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      requirements: '',
      website: '',
    },
  });

  // Apply the vehicle once the fleet has loaded (deep links like /book?vehicle=…)
  useEffect(() => {
    if (initialVehicle) {
      setValue('vehicleCategory', initialVehicle.category);
      setValue('vehicleId', initialVehicle.id);
    }
  }, [initialVehicle, setValue]);

  const [category, vehicleId, tripType, tripDate, returnDate, passengers] = useWatch({
    control,
    name: ['vehicleCategory', 'vehicleId', 'tripType', 'tripDate', 'returnDate', 'passengers'],
  });

  const options = useMemo(() => (vehicles ?? []).filter((v) => v.category === category), [vehicles, category]);
  const vehicle = vehicles?.find((v) => v.id === vehicleId) ?? null;

  useEffect(() => {
    if (vehicleId && vehicle && vehicle.category !== category) setValue('vehicleId', '');
  }, [category, vehicle, vehicleId, setValue]);

  useEffect(() => {
    if (!needsReturn(tripType as TripType)) setValue('returnDate', '');
  }, [tripType, setValue]);

  // Live availability hint for the chosen vehicle (the server enforces it again on submit)
  const [busy, setBusy] = useState<BusyRange[] | null>(null);
  useEffect(() => {
    setBusy(null);
    if (!vehicle) return;
    const ctrl = new AbortController();
    api
      .get<{ busy: BusyRange[] }>(`/api/vehicles/${vehicle.slug}/availability?to=${addDays(todayIST(), 400)}`, ctrl.signal)
      .then((r) => setBusy(r.busy))
      .catch(() => {});
    return () => ctrl.abort();
  }, [vehicle]);

  const end = returnDate || tripDate;
  const clashes = busy && tripDate && end >= tripDate ? overlaps(busy, tripDate, end) : [];
  const dayRate = vehicle?.pricing?.dayRate ?? null;
  const days = tripDate && end >= tripDate ? daysInclusive(tripDate, end) : 0;
  const estimate = dayRate && days ? dayRate * days : null;
  const seatsWarning = vehicle?.seats && Number(passengers) > vehicle.seats;

  const onSubmit = async (values: FormOut) => {
    setFormError(null);
    try {
      const res = await api.post<{ reference: string; duplicate: boolean; estimatedPrice: number | null }>('/api/bookings', {
        ...values,
        vehicleId: values.vehicleId || null,
        returnDate: values.returnDate || null,
        customerEmail: values.customerEmail || null,
        requirements: values.requirements || null,
      });
      setSubmitted({ ...res, values, vehicle });
      requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) {
      if (err instanceof ApiError) {
        const entries = Object.entries(err.fields);
        for (const [name, message] of entries) setError(name as keyof FormIn, { message });
        if (entries[0]) setFocus(entries[0][0] as keyof FormIn);
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again, or call us to book.');
      }
    }
  };

  if (submitted) {
    return (
      <div ref={topRef} className="scroll-mt-28">
        <BookingTicket data={submitted} />
      </div>
    );
  }

  const today = todayIST();
  return (
    <div ref={topRef} className="scroll-mt-28">
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-10">
      {formError && <FormAlert>{formError}</FormAlert>}

      {/* 01 — Vehicle */}
      <fieldset className="space-y-5">
        <legend className="mb-5 flex items-baseline gap-3">
          <span className="eyebrow text-signal">01</span>
          <span className="headline text-h3">The vehicle</span>
        </legend>

        {!lockVehicle && (
          <div role="radiogroup" aria-label="Vehicle type" className="grid grid-cols-2 gap-2 rounded-[4px] bg-fog/60 p-1.5">
            {(['bus', 'car'] as const).map((c) => (
              <label key={c} className={cx('cursor-pointer rounded-[3px] px-3 py-3 text-center text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-signal', category === c ? 'bg-ivory text-navy shadow-sm' : 'text-ink/60 hover:text-ink')}>
                <input type="radio" value={c} {...register('vehicleCategory')} className="sr-only" />
                {CATEGORY_LABEL[c]}
              </label>
            ))}
          </div>
        )}

        {lockVehicle && vehicle ? (
          <div className="flex items-center justify-between gap-4 rounded-[4px] border border-line bg-ivory px-5 py-4">
            <div>
              <p className="eyebrow text-muted">{CATEGORY_LABEL[vehicle.category]}</p>
              <p className="mt-1 text-lg font-semibold">{vehicle.name}</p>
            </div>
          </div>
        ) : (
          <SelectField label="Vehicle" {...register('vehicleId')} error={errors.vehicleId?.message} hint={options.length ? undefined : 'Loading the fleet…'}>
            <option value="">Any suitable {CATEGORY_LABEL[category as Category].toLowerCase()} — let us suggest</option>
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.seats ? ` · up to ${v.seats} seats` : ''}
              </option>
            ))}
          </SelectField>
        )}
      </fieldset>

      {/* 02 — Journey */}
      <fieldset className="space-y-5">
        <legend className="mb-5 flex items-baseline gap-3">
          <span className="eyebrow text-signal">02</span>
          <span className="headline text-h3">The journey</span>
        </legend>

        <div role="radiogroup" aria-label="Trip type" className="flex flex-wrap gap-2">
          {(Object.keys(TRIP_LABEL) as TripType[]).map((t) => (
            <label key={t} className={cx('cursor-pointer rounded-[3px] border px-4 py-2.5 text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-signal', tripType === t ? 'border-navy bg-navy text-ivory' : 'border-line bg-ivory text-ink/70 hover:border-stone')}>
              <input type="radio" value={t} {...register('tripType')} className="sr-only" />
              {TRIP_LABEL[t]}
            </label>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Pickup location" autoComplete="street-address" placeholder="e.g. Thiruvrambu" {...register('pickupLocation')} error={errors.pickupLocation?.message} />
          <TextField label="Destination" placeholder="e.g. Munnar" {...register('destination')} error={errors.destination?.message} />
          <TextField label="Trip date" type="date" min={today} max={addDays(today, 400)} {...register('tripDate')} error={errors.tripDate?.message} />
          {needsReturn(tripType as TripType) ? (
            <TextField label="Return date" type="date" min={tripDate || today} max={addDays(today, 400)} {...register('returnDate')} error={errors.returnDate?.message} />
          ) : (
            <input type="hidden" {...register('returnDate')} />
          )}
          <TextField label="Pickup time" type="time" step={900} {...register('pickupTime')} error={errors.pickupTime?.message} />
          <TextField
            label="Passengers"
            type="number"
            inputMode="numeric"
            min={1}
            max={80}
            {...register('passengers')}
            error={errors.passengers?.message}
            hint={vehicle?.seats ? `${vehicle.name} seats up to ${vehicle.seats}` : undefined}
          />
        </div>

        {seatsWarning && (
          <FormAlert tone="info">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Your group is larger than this vehicle’s {vehicle!.seats} seats. Choose a larger vehicle, or send the request and we’ll suggest options.
          </FormAlert>
        )}
        {vehicle && tripDate && busy && (
          clashes.length ? (
            <FormAlert>
              <CalendarX2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {vehicle.name} is already booked or unavailable between {formatDate(clashes[0]!.start)} and {formatDate(clashes[0]!.end)}. Please choose other dates or another vehicle.
              </span>
            </FormAlert>
          ) : (
            <FormAlert tone="success">
              <CalendarCheck2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              No confirmed trips for {vehicle.name} on {end !== tripDate ? 'these dates' : 'this date'} yet. We’ll confirm availability with you.
            </FormAlert>
          )
        )}
      </fieldset>

      {/* 03 — You */}
      <fieldset className="space-y-5">
        <legend className="mb-5 flex items-baseline gap-3">
          <span className="eyebrow text-signal">03</span>
          <span className="headline text-h3">Your details</span>
        </legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Full name" autoComplete="name" {...register('customerName')} error={errors.customerName?.message} />
          <TextField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" {...register('customerPhone')} error={errors.customerPhone?.message} />
          <TextField label="Email" type="email" autoComplete="email" optional wrapClassName="sm:col-span-2" hint="We’ll email you when the status of your booking changes." {...register('customerEmail')} error={errors.customerEmail?.message} />
          <TextAreaField label="Anything else we should know?" optional wrapClassName="sm:col-span-2" placeholder="Stops along the way, luggage, child seats, timings…" {...register('requirements')} error={errors.requirements?.message} />
        </div>
        {/* Honeypot — hidden from people, irresistible to bots */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website <input tabIndex={-1} autoComplete="off" {...register('website')} />
          </label>
        </div>
      </fieldset>

      <div className="ticket grain overflow-hidden bg-navy text-ivory" style={{ ['--notch-y' as string]: '50%' }}>
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="space-y-1.5">
            {estimate ? (
              <>
                <p className="eyebrow text-ivory/60">Indicative fare</p>
                <p className="display text-4xl">{money(estimate)}</p>
                <p className="text-sm text-ivory/65">
                  {days} day{days > 1 ? 's' : ''} × {money(dayRate!)} day rate. Final fare is confirmed by our team.
                </p>
              </>
            ) : (
              <>
                <p className="eyebrow text-ivory/60">Next step</p>
                <p className="max-w-md text-ivory/85">You’ll get a booking reference immediately. Our team reviews every request and confirms the vehicle and fare with you.</p>
              </>
            )}
          </div>
          <button type="submit" disabled={isSubmitting} className="btn btn-light shrink-0">
            {isSubmitting ? (
              <>
                <Spinner /> Sending…
              </>
            ) : (
              <>
                Send booking request <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
      <p className="-mt-6 text-center text-xs text-muted">
        By sending this request you agree to our{' '}
        <Link to="/terms" className="underline underline-offset-2">
          booking terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Submission confirmation — styled as a travel ticket                         */
/* -------------------------------------------------------------------------- */
function BookingTicket({ data }: { data: Submitted }) {
  const { contact } = useSite();
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const v = data.values;
  const msg = `Hello Elite Travel Hub, I just sent booking request ${data.reference} for ${formatDate(v.tripDate)} (${v.pickupLocation} → ${v.destination}).`;

  return (
    <motion.section
      aria-live="polite"
      aria-labelledby="ticket-title"
      initial={reduce ? false : { opacity: 0, y: 30, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ticket shadow-[0_40px_80px_-40px_rgb(12_23_19/0.45)]" style={{ ['--notch-y' as string]: '172px' }}>
        <div className="bg-navy px-6 pt-7 pb-8 text-ivory sm:px-10">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow text-ivory/60">Booking request</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-plate px-3 py-1 text-xs font-bold text-ink">
              <span className="size-1.5 rounded-full bg-ink" /> Pending confirmation
            </span>
          </div>
          <h2 id="ticket-title" className="headline mt-6 text-[2.4rem] leading-none sm:text-5xl">
            {data.duplicate ? 'We already have this request.' : 'Request received.'}
          </h2>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <p className="font-mono text-2xl font-bold tracking-wider text-azure-2 sm:text-3xl">{data.reference}</p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(data.reference).then(() => setCopied(true))}
              className="inline-flex items-center gap-1.5 rounded-full border border-ivory/25 px-3 py-1.5 text-xs font-semibold text-ivory/80 transition hover:bg-ivory hover:text-ink"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="perforation mx-6" aria-hidden="true" />
        <div className="space-y-6 px-6 py-8 sm:px-10">
          <p className="text-ink/80">
            Thank you, {v.customerName.split(' ')[0]}. Keep this reference — our team will contact you on <strong>{v.customerPhone}</strong> to confirm the vehicle, timing and fare.{' '}
            <strong>Your trip is not confirmed until we confirm it.</strong>
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm sm:grid-cols-4">
            {[
              ['From', v.pickupLocation],
              ['To', v.destination],
              ['Date', `${formatDate(v.tripDate)}${v.returnDate ? ` – ${formatDate(v.returnDate)}` : ''}`],
              ['Pickup', formatTime(v.pickupTime)],
              ['Vehicle', data.vehicle?.name ?? `Any ${CATEGORY_LABEL[v.vehicleCategory].toLowerCase()}`],
              ['Trip', TRIP_LABEL[v.tripType]],
              ['Passengers', String(v.passengers)],
              ...(data.estimatedPrice ? [['Indicative fare', money(data.estimatedPrice)]] : []),
            ].map(([k, val]) => (
              <div key={k}>
                <dt className="eyebrow text-muted">{k}</dt>
                <dd className="mt-1 font-semibold break-words">{val}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
            <Link to={`/booking/status?ref=${data.reference}`} className="btn btn-primary">
              Track this booking <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a href={whatsappHref(contact.whatsapp, msg)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              <WhatsAppIcon className="size-4" /> Send reference on WhatsApp
            </a>
            <a href={telHref(contact.phone)} className="btn btn-ghost">
              <Phone className="size-4" aria-hidden="true" /> Call us
            </a>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
