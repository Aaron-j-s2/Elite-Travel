import type { BookingStatus, Category, ImageSet, TripType } from '../lib/types';

export interface AdminBooking {
  id: string;
  reference: string;
  status: BookingStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  vehicleCategory: Category;
  vehicleId: string | null;
  vehicle: { id: string; name: string; slug: string; seats: number | null } | null;
  pickupLocation: string;
  destination: string;
  tripType: TripType;
  tripDate: string;
  returnDate: string | null;
  pickupTime: string;
  passengers: number;
  requirements: string | null;
  estimatedPrice: number | null;
  quotedFare: number | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingEvent {
  id: number;
  kind: 'created' | 'status' | 'edit' | 'note';
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus | null;
  note: string | null;
  actor: string;
  at: string;
}

export interface AdminBookingDetail extends AdminBooking {
  allowedTransitions: BookingStatus[];
  events: BookingEvent[];
}

export interface AdminVehicle {
  id: string;
  slug: string;
  name: string;
  category: Category;
  makeModel: string | null;
  registration: string | null;
  seats: number | null;
  tagline: string | null;
  description: string | null;
  amenities: string[];
  specs: { label: string; value: string }[];
  dayRate: number | null;
  ratePerKm: number | null;
  minKmPerDay: number | null;
  priceNote: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  upcomingCount: number;
  bookingCount: number;
  images: (ImageSet & { id: string; storage: string; sortOrder: number })[];
  blocks?: { id: string; startDate: string; endDate: string; reason: string | null }[];
  updatedAt: string;
}
