import type { BookingStatus, Category, TripType } from './types';

export const CATEGORY_LABEL: Record<Category, string> = { bus: 'Tourist bus', car: 'Travel car' };
export const CATEGORY_PLURAL: Record<Category, string> = { bus: 'Tourist buses', car: 'Travel cars' };

export const TRIP_LABEL: Record<TripType, string> = {
  one_way: 'One way',
  round_trip: 'Round trip',
  multi_day: 'Multi-day tour',
  local: 'Local / sightseeing',
};

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export const CUSTOMER_STATUS: Record<BookingStatus, { title: string; text: string }> = {
  pending: { title: 'Request received', text: 'Your request is with our team. We will call or message you to confirm the vehicle, timing and fare. Your booking is not confirmed yet.' },
  confirmed: { title: 'Confirmed', text: 'Your booking is confirmed by Elite Travel Hub. We’ll be in touch before the trip — call us if anything changes.' },
  rejected: { title: 'Not available', text: 'We’re sorry — we couldn’t take this request. Please call us; we may be able to offer another vehicle or date.' },
  cancelled: { title: 'Cancelled', text: 'This booking has been cancelled. If that’s unexpected, please call us.' },
  completed: { title: 'Completed', text: 'This trip is complete. Thank you for travelling with Elite Travel Hub.' },
};

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const money = (n: number) => inr.format(n);

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  // Dates are calendar days — format at noon UTC so no timezone shifts the day.
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-IN', { ...opts, timeZone: 'UTC' });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

export function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysInclusive(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export function whatsappHref(number: string, message: string) {
  return `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (diff < 60) return 'just now';
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 86400 * 30) return rtf.format(-Math.round(diff / 86400), 'day');
  return formatDate(iso);
}
