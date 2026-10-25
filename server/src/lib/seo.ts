import { config } from '../config.js';
import { one, query } from '../db.js';
import { getSettings } from '../services/settings.js';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface PageMeta {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: object[];
}

const STATIC: Record<string, { title: string; description?: string }> = {
  '/vehicles': { title: 'Our fleet — tourist travellers & travel cars', description: 'Browse the Elite Travel Hub fleet of tourist travellers and travel cars, photographed as they really are, and request a booking online.' },
  '/services': { title: 'Services', description: 'Tourist bus rental, travel cars, group and family trips, outstation journeys and sightseeing from Thiruvrambu, Kerala.' },
  '/contact': { title: 'Contact', description: 'Call, WhatsApp or email Elite Travel Hub in Thiruvrambu, Kerala.' },
  '/book': { title: 'Book a vehicle', description: 'Send your trip details to Elite Travel Hub and receive a booking reference instantly.' },
  '/booking/status': { title: 'Check booking status' },
  '/terms': { title: 'Booking terms' },
  '/privacy': { title: 'Privacy policy' },
};

/** Resolves page-specific meta for server-rendered <head> tags. Returns null for unknown paths (→ 404 status). */
export async function metaFor(pathname: string): Promise<{ meta: PageMeta; status: number }> {
  const s = await getSettings();
  const t = (title: string) => s.seo.titleTemplate.replace('%s', title);
  const base: PageMeta = { title: s.seo.siteTitle, description: s.seo.description, image: s.seo.ogImage };
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path.startsWith('/admin')) return { meta: { ...base, title: 'Admin · Elite Travel Hub', noindex: true }, status: 200 };

  if (path === '/') {
    return {
      status: 200,
      meta: {
        ...base,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: s.contact.businessName,
            telephone: s.contact.phone,
            email: s.contact.email,
            url: config.PUBLIC_SITE_URL,
            image: new URL(s.seo.ogImage || '/images/og-default.jpg', config.PUBLIC_SITE_URL).href,
            address: { '@type': 'PostalAddress', addressLocality: s.contact.locality, addressRegion: 'Kerala', addressCountry: 'IN' },
          },
        ],
      },
    };
  }

  const vehicleMatch = /^\/vehicles\/([a-z0-9-]+)$/.exec(path);
  if (vehicleMatch) {
    const v = await one<{ name: string; tagline: string | null; description: string | null; seats: number | null; src_base: string | null; widths: number[] | null }>(
      `select v.name, v.tagline, v.description, v.seats, i.src_base, i.widths
         from vehicles v left join lateral (select src_base, widths from vehicle_images where vehicle_id = v.id order by sort_order limit 1) i on true
        where v.slug = $1 and v.is_active`,
      [vehicleMatch[1]],
    );
    if (!v) return { meta: { ...base, title: t('Vehicle not found'), noindex: true }, status: 404 };
    const desc = v.tagline || v.description?.slice(0, 160) || `Book the ${v.name} with Elite Travel Hub, Thiruvrambu, Kerala.`;
    const w = v.widths?.find((x) => x >= 960) ?? v.widths?.at(-1);
    return { status: 200, meta: { title: t(v.name), description: desc, image: v.src_base && w ? `${v.src_base}-${w}.webp` : base.image } };
  }

  const known = STATIC[path];
  if (known) return { status: 200, meta: { ...base, title: t(known.title), description: known.description ?? base.description, noindex: path === '/booking/status' } };
  return { status: 404, meta: { ...base, title: t('Page not found'), noindex: true } };
}

export function renderHead(meta: PageMeta, pathname: string) {
  const abs = (u: string) => new URL(u, config.PUBLIC_SITE_URL).href;
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(abs(pathname))}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Elite Travel Hub" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(abs(pathname))}" />`,
    meta.image ? `<meta property="og:image" content="${esc(abs(meta.image))}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    meta.noindex ? `<meta name="robots" content="noindex, nofollow" />` : '',
    ...(meta.jsonLd ?? []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
  ];
  return tags.filter(Boolean).join('\n    ');
}

export async function sitemapXml() {
  const vehicles = await query<{ slug: string; updated_at: Date }>('select slug, updated_at from vehicles where is_active order by sort_order');
  const urls = [
    { loc: '/', pri: '1.0' },
    { loc: '/vehicles', pri: '0.9' },
    ...vehicles.map((v) => ({ loc: `/vehicles/${v.slug}`, pri: '0.8', mod: v.updated_at.toISOString().slice(0, 10) })),
    { loc: '/services', pri: '0.7' },
    { loc: '/book', pri: '0.7' },
    { loc: '/contact', pri: '0.6' },
    { loc: '/terms', pri: '0.2' },
    { loc: '/privacy', pri: '0.2' },
  ];
  const body = urls
    .map((u) => `  <url><loc>${esc(new URL(u.loc, config.PUBLIC_SITE_URL).href)}</loc>${'mod' in u && u.mod ? `<lastmod>${u.mod}</lastmod>` : ''}<priority>${u.pri}</priority></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt() {
  return `User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /booking/status\n\nSitemap: ${new URL('/sitemap.xml', config.PUBLIC_SITE_URL).href}\n`;
}
