export type Category = 'bus' | 'car';
export type TripType = 'one_way' | 'round_trip' | 'multi_day' | 'local';
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';

export interface ImageSet {
  id?: string;
  base: string;
  widths: number[];
  width: number;
  height: number;
  alt: string;
}

export interface Vehicle {
  id: string;
  slug: string;
  name: string;
  category: Category;
  makeModel: string | null;
  seats: number | null;
  tagline: string | null;
  description: string | null;
  amenities: string[];
  specs: { label: string; value: string }[];
  pricing: { dayRate: number | null; ratePerKm: number | null; minKmPerDay: number | null; note: string | null } | null;
  isFeatured: boolean;
  images: ImageSet[];
}

export interface ListItem {
  title: string;
  text: string;
}

export interface Settings {
  contact: {
    businessName: string;
    phone: string;
    whatsapp: string;
    email: string;
    locality: string;
    region: string;
    addressLine: string | null;
    mapEmbedUrl: string;
    mapLink: string;
    hours: string | null;
    instagram: string;
    facebook: string;
    youtube: string;
  };
  home: {
    heroEyebrow: string;
    heroTitle: string;
    heroText: string;
    fleetTitle: string;
    fleetText: string;
    servicesTitle: string;
    experiencesTitle: string;
    experiencesText: string;
    whyTitle: string;
    ctaTitle: string;
    ctaText: string;
  };
  whyChoose: { items: ListItem[] };
  experiences: { items: ListItem[] };
  seo: { siteTitle: string; titleTemplate: string; description: string; ogImage: string };
  policies: { bookingTerms: string; privacyPolicy: string };
}

export interface Service {
  slug: string;
  title: string;
  summary: string;
  body: string;
  icon: string;
  image: string | null;
}

export interface Testimonial {
  id: string;
  authorName: string;
  authorPlace: string | null;
  quote: string;
  tripLabel: string | null;
}

export interface SiteData {
  settings: Settings;
  services: Service[];
  testimonials: Testimonial[];
}

export interface BusyRange {
  start: string;
  end: string;
  kind: 'booked' | 'unavailable';
}
