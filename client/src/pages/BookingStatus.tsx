import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, Phone, Search } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useSite } from '../lib/site';
import { useSeo } from '../lib/seo';
import { CATEGORY_LABEL, CUSTOMER_STATUS, TRIP_LABEL, formatDate, formatDateTime, formatTime, money, telHref, whatsappHref } from '../lib/format';
import type { BookingStatus as Status, Category, TripType } from '../lib/types';
import { FormAlert, SectionMark, Spinner, TextField, WhatsAppIcon, cx } from '../components/ui/primitives';

interface Lookup {
  reference: string;
  status: Status;
  firstName: string;
  tripType: TripType;
  tripDate: string;
  returnDate: string | null;
  pickupTime: string;
  pickupLocation: string;
  destination: string;
  passengers: number;
  vehicleCategory: Category;
  vehicle: { name: string; slug: string } | null;
  estimatedPrice: number | null;
  quotedFare: number | null;
  submittedAt: string;
  timeline: { status: Status; at: string }[];
}

const TONE: Record<Status, string> = {
  pending: 'bg-plate text-ink',
  confirmed: 'bg-success text-ivory',
  completed: 'bg-navy text-ivory',
  rejected: 'bg-danger text-ivory',
  cancelled: 'bg-ink/70 text-ivory',
};

export default function BookingStatus() {
  useSeo('Check booking status', undefined, { noindex: true });
  const { contact } = useSite();
  const [params] = useSearchParams();
  const [reference, setReference] = useState(params.get('ref') ?? '');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Lookup | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^ETH-\d{4}-[A-Z0-9]{5}$/i.test(reference.trim())) errs.reference = 'Booking references look like ETH-2610-AB2CD';
    if (phone.replace(/\D/g, '').length < 10) errs.phone = 'Enter the mobile number used for the booking';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<{ booking: Lookup }>('/api/bookings/lookup', { reference: reference.trim().toUpperCase(), phone });
      setResult(res.booking);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      if (err instanceof ApiError) setErrors(err.fields);
    } finally {
      setLoading(false);
    }
  };

  const info = result ? CUSTOMER_STATUS[result.status] : null;

  return (
    <section className="py-10 lg:py-16">
      <div className="wrap grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionMark n="—" label="Track a booking" />
          <h1 className="display mt-6 text-h1">
            Check your <span className="text-azure">booking</span>
          </h1>
          <p className="lede mt-6">Enter your booking reference and the mobile number you used. You will see the latest status from our team.</p>
          <form onSubmit={submit} noValidate className="mt-10 space-y-5">
            <TextField
              label="Booking reference"
              value={reference}
              onChange={(e) => setReference(e.target.value.toUpperCase())}
              placeholder="ETH-2610-AB2CD"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono tracking-wider"
              error={errors.reference}
            />
            <TextField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
            {error && <FormAlert>{error}</FormAlert>}
            <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={loading}>
              {loading ? <Spinner /> : <Search className="size-4" aria-hidden="true" />} Check status
            </button>
          </form>
        </div>

        <div className="lg:col-span-6 lg:col-start-7" aria-live="polite">
          {result && info ? (
            <article className="ticket shadow-[0_40px_80px_-40px_rgb(12_23_19/0.4)]" style={{ ['--notch-y' as string]: '150px' }}>
              <div className="bg-navy px-6 pt-7 pb-8 text-ivory sm:px-9">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-lg font-bold tracking-wider text-azure-2">{result.reference}</p>
                  <span className={cx('rounded-full px-3 py-1 text-xs font-bold', TONE[result.status])}>{info.title}</span>
                </div>
                <h2 className="headline mt-6 text-4xl">Hello, {result.firstName}.</h2>
                <p className="mt-3 text-ivory/75">{info.text}</p>
              </div>
              <div className="perforation mx-6" aria-hidden="true" />
              <div className="space-y-8 px-6 py-8 sm:px-9">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
                  {[
                    ['From', result.pickupLocation],
                    ['To', result.destination],
                    ['Date', `${formatDate(result.tripDate)}${result.returnDate ? ` – ${formatDate(result.returnDate)}` : ''}`],
                    ['Pickup', formatTime(result.pickupTime)],
                    ['Vehicle', result.vehicle?.name ?? `Any ${CATEGORY_LABEL[result.vehicleCategory].toLowerCase()} (to be assigned)`],
                    ['Trip', TRIP_LABEL[result.tripType]],
                    ['Passengers', String(result.passengers)],
                    ...(result.quotedFare != null ? [['Agreed fare', money(result.quotedFare)]] : result.estimatedPrice != null ? [['Indicative fare', money(result.estimatedPrice)]] : []),
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="eyebrow text-muted">{k}</dt>
                      <dd className="mt-1 font-semibold break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <h3 className="eyebrow text-muted">History</h3>
                  <ol className="mt-4 space-y-3">
                    {result.timeline.map((t, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm">
                        <span className="grid size-6 place-items-center rounded-full bg-navy text-ivory">
                          <Check className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="font-semibold">{CUSTOMER_STATUS[t.status]?.title ?? t.status}</span>
                        <span className="text-muted">{formatDateTime(t.at)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={telHref(contact.phone)} className="btn btn-ghost btn-sm">
                    <Phone className="size-4" aria-hidden="true" /> Call us
                  </a>
                  <a href={whatsappHref(contact.whatsapp, `Hello Elite Travel Hub, I have a question about booking ${result.reference}.`)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    <WhatsAppIcon className="size-4" /> WhatsApp
                  </a>
                </div>
              </div>
            </article>
          ) : (
            <div className="grid h-full min-h-72 place-items-center rounded-[4px] border border-dashed border-stone p-10 text-center">
              <div>
                <p className="headline text-h3 text-ink/60">Your booking details will appear here.</p>
                <p className="mt-3 text-sm text-muted">
                  Not booked yet?{' '}
                  <Link to="/book" className="font-semibold text-navy underline underline-offset-4">
                    Send a request
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
