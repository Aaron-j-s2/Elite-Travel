import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Ban, Check, CheckCheck, Mail, Pencil, Phone, RotateCcw, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { CATEGORY_LABEL, STATUS_LABEL, TRIP_LABEL, formatDate, formatDateTime, formatTime, money, telHref, whatsappHref } from '../../lib/format';
import type { BookingStatus, TripType } from '../../lib/types';
import { FormAlert, SelectField, Spinner, TextAreaField, TextField, WhatsAppIcon, cx } from '../../components/ui/primitives';
import { ConfirmDialog, LoadError, PageHeader, Panel, StatusBadge, useLoad, useToast } from '../ui';
import type { AdminBookingDetail, AdminVehicle } from '../types';

const ACTION: Record<BookingStatus, { label: string; icon: typeof Check; tone: 'default' | 'danger'; explain: string }> = {
  confirmed: { label: 'Confirm booking', icon: Check, tone: 'default', explain: 'The vehicle will be reserved for these dates. Overlapping confirmations for the same vehicle are blocked.' },
  rejected: { label: 'Reject request', icon: X, tone: 'danger', explain: 'The customer will see that this request could not be accepted.' },
  cancelled: { label: 'Cancel booking', icon: Ban, tone: 'danger', explain: 'The booking will be cancelled and the vehicle released for these dates.' },
  completed: { label: 'Mark trip completed', icon: CheckCheck, tone: 'default', explain: 'Use this once the trip has taken place. Completed bookings can no longer be edited.' },
  pending: { label: 'Move back to pending', icon: RotateCcw, tone: 'default', explain: 'Re-open this booking for review. A confirmed booking will release its vehicle reservation.' },
};

function EditForm({ booking, onSaved, onCancel }: { booking: AdminBookingDetail; onSaved: (b: AdminBookingDetail) => void; onCancel: () => void }) {
  const toast = useToast();
  const { data: vehicles } = useLoad((s) => api.get<{ items: AdminVehicle[] }>('/api/admin/vehicles', s), []);
  const [v, setV] = useState({
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail ?? '',
    vehicleCategory: booking.vehicleCategory,
    vehicleId: booking.vehicleId ?? '',
    pickupLocation: booking.pickupLocation,
    destination: booking.destination,
    tripType: booking.tripType,
    tripDate: booking.tripDate,
    returnDate: booking.returnDate ?? '',
    pickupTime: booking.pickupTime,
    passengers: String(booking.passengers),
    requirements: booking.requirements ?? '',
    quotedFare: booking.quotedFare != null ? String(booking.quotedFare) : '',
    adminNotes: booking.adminNotes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value })), error: errors[k] });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await api.patch<{ booking: AdminBookingDetail }>(`/api/admin/bookings/${booking.id}`, {
        ...v,
        vehicleId: v.vehicleId || null,
        returnDate: v.returnDate || null,
        customerEmail: v.customerEmail || null,
        requirements: v.requirements || null,
        adminNotes: v.adminNotes || null,
        quotedFare: v.quotedFare === '' ? null : v.quotedFare,
      });
      toast('Booking updated');
      onSaved(res.booking);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.message);
      } else setFormError('Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const options = (vehicles?.items ?? []).filter((x) => x.category === v.vehicleCategory);
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && <FormAlert>{formError}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Customer name" {...field('customerName')} />
        <TextField label="Phone" type="tel" {...field('customerPhone')} />
        <TextField label="Email" type="email" optional {...field('customerEmail')} wrapClassName="sm:col-span-2" />
        <SelectField label="Vehicle type" {...field('vehicleCategory')}>
          <option value="bus">Tourist bus</option>
          <option value="car">Travel car</option>
        </SelectField>
        <SelectField label="Assigned vehicle" {...field('vehicleId')} hint={booking.status === 'confirmed' ? 'Required for confirmed bookings' : undefined}>
          <option value="">Not assigned yet</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.isActive ? '' : ' (disabled)'}
            </option>
          ))}
        </SelectField>
        <TextField label="Pickup location" {...field('pickupLocation')} />
        <TextField label="Destination" {...field('destination')} />
        <SelectField label="Trip type" {...field('tripType')}>
          {(Object.keys(TRIP_LABEL) as TripType[]).map((t) => (
            <option key={t} value={t}>
              {TRIP_LABEL[t]}
            </option>
          ))}
        </SelectField>
        <TextField label="Passengers" type="number" min={1} max={80} {...field('passengers')} />
        <TextField label="Trip date" type="date" {...field('tripDate')} />
        <TextField label="Return date" type="date" optional {...field('returnDate')} />
        <TextField label="Pickup time" type="time" {...field('pickupTime')} />
        <TextField label="Agreed fare (₹)" type="number" min={0} optional hint="Shown to the customer on their status page" {...field('quotedFare')} />
        <TextAreaField label="Customer requirements" optional wrapClassName="sm:col-span-2" {...field('requirements')} />
        <TextAreaField label="Internal notes" optional hint="Only visible to administrators" wrapClassName="sm:col-span-2" {...field('adminNotes')} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy && <Spinner />} Save changes
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function BookingDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data, setData, error, reload } = useLoad((s) => api.get<{ booking: AdminBookingDetail }>(`/api/admin/bookings/${id}`, s), [id]);
  const b = data?.booking;
  const [pending, setPending] = useState<BookingStatus | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [internal, setInternal] = useState('');

  const changeStatus = async () => {
    if (!pending || !b) return;
    setBusy(true);
    try {
      const res = await api.post<{ booking: AdminBookingDetail; email: 'sent' | 'skipped' | 'failed' }>(`/api/admin/bookings/${b.id}/status`, { status: pending, note: note || null });
      setData({ booking: res.booking });
      const emailNote = res.email === 'sent' ? ' Customer emailed.' : res.email === 'failed' ? ' The email to the customer failed to send.' : '';
      toast(`Booking ${STATUS_LABEL[pending].toLowerCase()}.${emailNote}`, res.email === 'failed' ? 'error' : 'success');
      setPending(null);
      setNote('');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update the status.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const addNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!internal.trim() || !b) return;
    try {
      const res = await api.post<{ booking: AdminBookingDetail }>(`/api/admin/bookings/${b.id}/notes`, { note: internal });
      setData(res);
      setInternal('');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not add the note.', 'error');
    }
  };

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!b) return <div className="skeleton h-96 rounded-2xl" aria-busy="true" />;

  const first = b.customerName.split(' ')[0];
  const waText = `Hello ${first}, this is Elite Travel Hub about your booking ${b.reference} on ${formatDate(b.tripDate)}.`;

  return (
    <>
      <Link to="/admin/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> All bookings
      </Link>
      <PageHeader
        title={b.customerName}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-ink">{b.reference}</span> <StatusBadge status={b.status} /> <span>· received {formatDateTime(b.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <a href={telHref(b.customerPhone)} className="btn btn-ghost btn-sm">
              <Phone className="size-4" aria-hidden="true" /> Call
            </a>
            <a href={whatsappHref(b.customerPhone, waText)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
              <WhatsAppIcon className="size-4" /> WhatsApp
            </a>
            {b.customerEmail && (
              <a href={`mailto:${b.customerEmail}?subject=${encodeURIComponent(`Your booking ${b.reference}`)}`} className="btn btn-ghost btn-sm">
                <Mail className="size-4" aria-hidden="true" /> Email
              </a>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {b.allowedTransitions.length > 0 && (
            <Panel title="Update status">
              <div className="flex flex-wrap gap-2">
                {b.allowedTransitions.map((s) => {
                  const a = ACTION[s];
                  return (
                    <button key={s} type="button" onClick={() => setPending(s)} className={cx('btn btn-sm', s === 'confirmed' || s === 'completed' ? 'btn-primary' : a.tone === 'danger' ? 'border border-danger/40 text-danger hover:bg-danger hover:text-ivory' : 'btn-ghost')}>
                      <a.icon className="size-4" aria-hidden="true" /> {a.label}
                    </button>
                  );
                })}
              </div>
              {b.status === 'pending' && !b.vehicleId && <p className="mt-3 text-xs text-muted">Assign a vehicle (Edit booking) before confirming.</p>}
            </Panel>
          )}

          <Panel title="Trip details" actions={!editing && b.status !== 'completed' && (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy">
              <Pencil className="size-3.5" aria-hidden="true" /> Edit booking
            </button>
          )}>
            {editing ? (
              <EditForm booking={b} onCancel={() => setEditing(false)} onSaved={(nb) => { setData({ booking: nb }); setEditing(false); }} />
            ) : (
              <dl className="grid gap-x-6 gap-y-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Pickup', b.pickupLocation],
                  ['Destination', b.destination],
                  ['Trip type', TRIP_LABEL[b.tripType]],
                  ['Date', `${formatDate(b.tripDate)}${b.returnDate ? ` – ${formatDate(b.returnDate)}` : ''}`],
                  ['Pickup time', formatTime(b.pickupTime)],
                  ['Passengers', `${b.passengers}${b.vehicle?.seats && b.passengers > b.vehicle.seats ? ` (vehicle seats ${b.vehicle.seats})` : ''}`],
                  ['Vehicle type', CATEGORY_LABEL[b.vehicleCategory]],
                  ['Assigned vehicle', b.vehicle?.name ?? 'Not assigned'],
                  ['Indicative fare', b.estimatedPrice != null ? money(b.estimatedPrice) : '—'],
                  ['Agreed fare', b.quotedFare != null ? money(b.quotedFare) : '—'],
                  ['Phone', b.customerPhone],
                  ['Email', b.customerEmail ?? '—'],
                ].map(([k, val]) => (
                  <div key={k}>
                    <dt className="eyebrow text-muted">{k}</dt>
                    <dd className="mt-1 font-semibold break-words">{val}</dd>
                  </div>
                ))}
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="eyebrow text-muted">Customer requirements</dt>
                  <dd className="mt-1 whitespace-pre-line">{b.requirements ?? '—'}</dd>
                </div>
                {b.adminNotes && (
                  <div className="rounded-xl bg-fog/60 p-4 sm:col-span-2 lg:col-span-3">
                    <dt className="eyebrow text-muted">Internal notes</dt>
                    <dd className="mt-1 whitespace-pre-line">{b.adminNotes}</dd>
                  </div>
                )}
              </dl>
            )}
          </Panel>
        </div>

        <Panel title="History">
          <ol className="relative space-y-5 border-l border-line pl-5">
            {b.events.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span className={cx('absolute top-1 -left-[1.66rem] size-3 rounded-full ring-4 ring-ivory', e.kind === 'status' ? 'bg-navy' : e.kind === 'created' ? 'bg-plate' : 'bg-stone')} aria-hidden="true" />
                <p className="font-semibold">
                  {e.kind === 'created' && 'Request submitted'}
                  {e.kind === 'status' && `${STATUS_LABEL[e.fromStatus!]} → ${STATUS_LABEL[e.toStatus!]}`}
                  {e.kind === 'edit' && 'Edited'}
                  {e.kind === 'note' && 'Note'}
                </p>
                {e.note && <p className="mt-0.5 whitespace-pre-line text-ink/75">{e.note}</p>}
                <p className="mt-0.5 text-xs text-muted">
                  {e.actor} · {formatDateTime(e.at)}
                </p>
              </li>
            ))}
          </ol>
          <form onSubmit={addNote} className="mt-6 space-y-2 border-t border-line pt-5">
            <label htmlFor="note" className="field-label">
              Add an internal note
            </label>
            <textarea id="note" value={internal} onChange={(e) => setInternal(e.target.value)} rows={2} className="input !min-h-20" placeholder="e.g. Customer called to confirm pickup point" />
            <button type="submit" disabled={!internal.trim()} className="btn btn-ghost btn-sm">
              Add note
            </button>
          </form>
        </Panel>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `${ACTION[pending].label}?` : ''}
        confirmLabel={pending ? ACTION[pending].label : ''}
        tone={pending ? ACTION[pending].tone : 'default'}
        busy={busy}
        onConfirm={changeStatus}
        onClose={() => {
          if (!busy) setPending(null);
        }}
      >
        {pending && (
          <>
            <p>
              {b.reference} · {b.customerName} · {formatDate(b.tripDate)}
            </p>
            <p className="mt-2">{ACTION[pending].explain}</p>
            <label htmlFor="status-note" className="field-label mt-4">
              Message to the customer <span className="font-normal text-muted">(optional{b.customerEmail ? ', included in the email' : ''})</span>
            </label>
            <textarea id="status-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input !min-h-20" />
          </>
        )}
      </ConfirmDialog>
    </>
  );
}
