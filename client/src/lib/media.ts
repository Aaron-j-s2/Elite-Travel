import photos from '../data/photos.json';
import type { ImageSet } from './types';

type PhotoKey = keyof typeof photos.photos;
type CutoutKey = keyof typeof photos.cutouts;

export const srcSet = (img: Pick<ImageSet, 'base' | 'widths'>) => img.widths.map((w) => `${img.base}-${w}.webp ${w}w`).join(', ');

export const pickSrc = (img: Pick<ImageSet, 'base' | 'widths'>, target = 960) =>
  `${img.base}-${img.widths.find((w) => w >= target) ?? img.widths[img.widths.length - 1]}.webp`;

export function photo(key: PhotoKey): ImageSet & { tone: string } {
  const p = photos.photos[key];
  return { base: p.base, widths: p.widths, width: p.width, height: p.height, alt: p.alt, tone: p.tone };
}

export function cutout(key: CutoutKey): ImageSet {
  const c = photos.cutouts[key];
  return { base: c.base, widths: c.widths, width: c.width, height: c.height, alt: c.alt };
}

/** Background-removed studio shots, keyed by the seeded vehicle slug. */
export const CUTOUT_BY_VEHICLE: Record<string, CutoutKey> = {
  'force-traveller-elite-livery': 'traveller-elite-livery-profile',
  'force-traveller-black-grille': 'traveller-black-grille-front',
  'toyota-innova': 'toyota-innova-front',
};

export const INTERIORS: PhotoKey[] = [
  'interior-cream-seats-wood-panels', // portrait — spans two rows
  'interior-white-leather-cabin-forward',
  'interior-blue-pushback-seats-kathakali-panels',
  'interior-white-leather-floral-ceiling',
  'interior-white-leather-rows-ambient',
];

/** The full line-up — coach, travellers and cars — cut out from the brand photograph. */
export const FLEET_LINEUP: ImageSet = {
  base: '/images/brand/elite-fleet-lineup',
  widths: [640, 1200, 1800, 2073],
  width: 2073,
  height: 590,
  alt: 'The Elite Travel Hub line-up in white livery: a Toyota Innova, two Force Travellers, a tourist coach and a Suzuki Dzire',
};

/** Fleet photographs that rotate alongside the services (admin can set a specific image path per service). */
export const SERVICE_PHOTOS: PhotoKey[] = [
  'traveller-elite-livery-night-profile',
  'toyota-innova-front',
  'fleet-three-travellers-lineup',
  'interior-white-leather-rows-ambient',
  'traveller-black-grille-front-street',
  'interior-blue-seats-led-ceiling',
  'traveller-elite-livery-side-quarter',
];
