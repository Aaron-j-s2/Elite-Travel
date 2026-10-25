import { z } from 'zod';
import { query } from '../db.js';
import { optionalText, text } from '../lib/fields.js';

/*
 * Site content the administrator can edit. Every key has a schema (validated on save)
 * and a default (used until the business saves its own copy). Defaults only state facts
 * the business supplied — contact details, location, and what the booking system does.
 */

const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), 'Must be an https:// link')
  .default('');

const listItem = z.object({ title: text(80), text: text(400) });

export const settingSchemas = {
  contact: z.object({
    businessName: text(80),
    phone: text(20),
    whatsapp: z.string().trim().regex(/^\d{10,15}$/, 'Digits only, with country code, e.g. 919047339000'),
    email: z.email().max(160),
    locality: text(80),
    region: text(80),
    addressLine: optionalText(200),
    mapEmbedUrl: url.refine((v) => v === '' || v.startsWith('https://www.google.com/maps/embed'), 'Use the Google Maps “Embed a map” link'),
    mapLink: url,
    hours: optionalText(120),
    instagram: url,
    facebook: url,
    youtube: url,
  }),
  home: z.object({
    heroEyebrow: text(60),
    heroTitle: text(90),
    heroText: text(280),
    fleetTitle: text(90),
    fleetText: text(280),
    servicesTitle: text(90),
    experiencesTitle: text(90),
    experiencesText: text(280),
    whyTitle: text(90),
    ctaTitle: text(90),
    ctaText: text(280),
  }),
  whyChoose: z.object({ items: z.array(listItem).max(8) }),
  experiences: z.object({ items: z.array(listItem).max(10) }),
  seo: z.object({
    siteTitle: text(70),
    titleTemplate: text(70).refine((v) => v.includes('%s'), 'Must contain %s'),
    description: text(170),
    ogImage: z.string().trim().max(300).default(''),
  }),
  policies: z.object({ bookingTerms: text(8000), privacyPolicy: text(8000) }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type Settings = { [K in SettingKey]: z.output<(typeof settingSchemas)[K]> };
export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

export const defaultSettings: Settings = {
  contact: {
    businessName: 'Elite Travel Hub',
    phone: '+91 90473 39000',
    whatsapp: '919047339000',
    email: 'elitetourandtravel2026@gmail.com',
    locality: 'Thiruvrambu',
    region: 'Kerala, India',
    addressLine: null,
    mapEmbedUrl: '',
    mapLink: '',
    hours: null,
    instagram: '',
    facebook: '',
    youtube: '',
  },
  home: {
    heroEyebrow: 'Tourist buses and travel cars · Thiruvrambu, Kerala',
    heroTitle: 'Travel together in comfort.',
    heroText:
      'Hire a tourist traveller or a car for family trips, group tours, outstation journeys and sightseeing. You book directly with us — the people who own and run the vehicles.',
    fleetTitle: 'Choose your vehicle.',
    fleetText: 'These are photos of our own vehicles. Choose the one that suits your group and send us your trip details.',
    servicesTitle: 'A vehicle for every kind of trip.',
    experiencesTitle: 'Plan the trip your way.',
    experiencesText: 'Tell us where you want to go — a temple visit, a hill-station weekend, a wedding or a long trip outside Kerala. We plan the vehicle and timings around you.',
    whyTitle: 'Why customers choose us',
    ctaTitle: 'Ready to plan your trip?',
    ctaText: 'Send us your trip details. We will call you back to confirm the vehicle, timing and fare.',
  },
  whyChoose: {
    items: [
      { title: 'Book directly with the owners', text: 'Your request comes straight to Elite Travel Hub, not to an agent. Call or WhatsApp us any time to talk it through.' },
      { title: 'Real photos of our vehicles', text: 'The vehicle photos on this site show our own fleet, inside and out, so you know what to expect.' },
      { title: 'The right size for your group', text: 'Choose a car for a small family, or a tourist traveller when the whole family, team or wedding party is coming.' },
      { title: 'Clear booking status', text: 'You get a booking reference straight away. Nothing is confirmed until we confirm it, and you can check the status online at any time.' },
    ],
  },
  experiences: {
    items: [
      { title: 'Family trips', text: 'Room for everyone and their luggage. Tell us your stops and we will plan the timing.' },
      { title: 'Pilgrimages and temple visits', text: 'Early starts and routes with several stops, for groups travelling together.' },
      { title: 'Weddings and functions', text: 'Take guests between the venue, the ceremony and the reception in one trip.' },
      { title: 'Hill stations and weekend trips', text: 'Outstation trips with a driver who knows the roads, so everyone can enjoy the view.' },
      { title: 'Office and college groups', text: 'Team outings, study tours and events — one vehicle, one schedule, everyone together.' },
    ],
  },
  seo: {
    siteTitle: 'Elite Travel Hub — Tourist Buses & Travel Cars in Thiruvrambu, Kerala',
    titleTemplate: '%s · Elite Travel Hub',
    description:
      'Book tourist travellers and travel cars for family trips, group tours, outstation journeys and sightseeing with Elite Travel Hub, Thiruvrambu, Kerala.',
    ogImage: '/images/og-default.jpg',
  },
  policies: {
    bookingTerms: [
      'Submitting the booking form sends a request to Elite Travel Hub. It is not a confirmed booking.',
      'A booking is confirmed only when Elite Travel Hub confirms it. You can check the status at any time with your booking reference and mobile number.',
      'Fares, inclusions and payment terms are agreed directly with Elite Travel Hub before confirmation. Any price shown on this website is an indication only.',
      'Please contact us as early as possible if your plans change so we can update or cancel your request.',
      'For any question about a booking, call +91 90473 39000 or email elitetourandtravel2026@gmail.com.',
    ].join('\n\n'),
    privacyPolicy: [
      'Elite Travel Hub collects the details you enter in the booking and contact forms — your name, mobile number, optional email address and trip details — only to respond to your request and arrange your trip.',
      'Your details are stored securely and are visible only to Elite Travel Hub staff. We do not sell or share them with third parties, except where needed to provide the trip you requested or where required by law.',
      'If you provide an email address, we may email you about the status of your booking.',
      'To ask for a copy of your details, or to have them corrected or deleted, contact us at elitetourandtravel2026@gmail.com or +91 90473 39000.',
    ].join('\n\n'),
  },
};

export async function getSettings(): Promise<Settings> {
  const rows = await query<{ key: string; value: unknown }>('select key, value from site_settings');
  const out = structuredClone(defaultSettings) as Settings;
  for (const row of rows) {
    const key = row.key as SettingKey;
    if (!(key in settingSchemas)) continue;
    // Stored values are merged over defaults so new fields added later keep working.
    const merged = { ...(defaultSettings[key] as object), ...(row.value as object) };
    const res = settingSchemas[key].safeParse(merged);
    if (res.success) (out as Record<string, unknown>)[key] = res.data;
  }
  return out;
}

export async function saveSetting(key: SettingKey, value: unknown, adminId: string) {
  const data = settingSchemas[key].parse(value);
  await query(
    `insert into site_settings (key, value, updated_at, updated_by) values ($1, $2, now(), $3)
     on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
    [key, JSON.stringify(data), adminId],
  );
  return data;
}
