#!/usr/bin/env node
/**
 * Builds the website's responsive image set from the business's original photographs.
 *
 *   npm run images:process            (originals default to ../elite photos)
 *   ORIGINALS_DIR=/path npm run images:process
 *
 * - Originals are opened read-only and never modified.
 * - Photos → plate-free copies for exteriors (assets/masked), auto-oriented, metadata (incl. GPS)
 *   stripped, WebP at several widths.
 * - Cutouts (assets/cutouts/*.png, produced by scripts/cutouts.py and reviewed by eye)
 *   → transparent WebP at several widths.
 * - Writes client/src/data/photos.json so components can render srcset/sizes/alt.
 * See docs/ASSETS.md for the inventory and review notes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originals = path.resolve(process.env.ORIGINALS_DIR ?? path.join(root, '..', 'elite photos'));
const masked = path.join(root, 'assets', 'masked');
const outPhotos = path.join(root, 'client', 'public', 'images', 'fleet');
const outCutouts = path.join(root, 'client', 'public', 'images', 'cutouts');
const manifestPath = path.join(root, 'client', 'src', 'data', 'photos.json');

const PHOTO_WIDTHS = [480, 960, 1600, 2400];
const CUTOUT_WIDTHS = [480, 960, 1600];

/**
 * Inventory of every supplied photograph. Exterior shots are read from assets/masked/<slug>.jpg —
 * copies with the registration plates blanked by scripts/mask-plates.py — so no plate number ever
 * reaches the website. Names and alt text never mention registration numbers.
 */
export const PHOTOS = [
  { src: '0752EF29-59D0-4E3A-A1C3-0D4534146047.jpeg', slug: 'interior-blue-pushback-seats-kathakali-panels', vehicle: null, kind: 'interior', alt: 'Inside a traveller: blue push-back seats, curtains and lit Kathakali art panels on the ceiling' },
  { src: '0e34c098-3458-4062-a70c-7da7598f33f3.jpeg', slug: 'traveller-black-grille-front-garden', vehicle: 'black-grille', kind: 'exterior', alt: 'White Force Traveller with Elite Travel Hub branding on the windscreen, parked among banana trees' },
  { src: '139fec8f-ac76-4d36-8c5f-96ffd02bdd06.jpeg', slug: 'traveller-black-grille-rear', vehicle: 'black-grille', kind: 'exterior', alt: 'Back of a white Force Traveller with a roof ladder, spare wheel and Elite Travel Hub rear-window sign' },
  { src: '22379A4F-166D-4F17-A2A9-3E2FC159F2C1.jpeg', slug: 'traveller-elite-livery-night-front-quarter', vehicle: 'elite-livery', kind: 'exterior', alt: 'Force Traveller in Elite livery at night, lit with blue lights at the front' },
  { src: '33DFAE56-1E5B-4165-9888-15F1DE3EAB13.jpeg', slug: 'traveller-elite-livery-night-profile', vehicle: 'elite-livery', kind: 'exterior', alt: 'Side view of the Elite Force Traveller at night, with warm light glowing through the curtained windows' },
  { src: '3883603E-BE0B-4999-BD1C-9206A12CC077.jpeg', slug: 'traveller-elite-livery-front', vehicle: 'elite-livery', kind: 'exterior', alt: 'Front of the Elite Force Traveller with Elite Travel Hub branding on the windscreen' },
  { src: '7339CACD-5CBC-4A08-8C62-375321564639.jpeg', slug: 'interior-white-leather-cabin-forward', vehicle: null, kind: 'interior', alt: 'Inside a traveller: white quilted leather captain seats and an overhead screen' },
  { src: '7E9A535C-E139-48AB-82C3-8535F0E6F791.jpeg', slug: 'interior-white-leather-floral-ceiling', vehicle: null, kind: 'interior', alt: 'White quilted leather seats under a lit floral ceiling panel with soft ambient light' },
  { src: '812D0E31-8A89-407B-8174-D39498795541.jpeg', slug: 'traveller-elite-livery-side-quarter', vehicle: 'elite-livery', kind: 'exterior', alt: 'White Force Traveller with the Elite Travel Hub blue-and-red stripes, parked at night' },
  { src: '85d9950b-165e-464d-aa0c-c9e7ceb2d1d8.jpeg', slug: 'fleet-three-travellers-lineup', vehicle: null, kind: 'fleet', alt: 'Three white travellers parked side by side in front of trees at dusk' },
  { src: '899BA67C-7D40-4640-9010-5AAA3FF09DCB.jpeg', slug: 'toyota-innova-front', vehicle: 'innova', kind: 'exterior', alt: 'Silver Toyota Innova decorated with red roses on the bonnet' },
  { src: '9525ED82-1085-4F4B-9B21-92784ECC6EA5.jpeg', slug: 'interior-white-leather-rows-ambient', vehicle: null, kind: 'interior', alt: 'Rows of white leather seats with soft pink and violet lighting and curtained windows' },
  { src: '987898B1-E8F0-4723-B235-7CF8CC729A9B.jpeg', slug: 'interior-blue-seats-led-ceiling', vehicle: null, kind: 'interior', alt: 'Traveller cabin with blue seats, LED ceiling lights and lit art panels' },
  { src: '9A0B4697-4E24-4670-BED3-87DAD4887DD3.jpeg', slug: 'traveller-black-grille-front-street', vehicle: 'black-grille', kind: 'exterior', alt: 'White Force Traveller with a black mesh grille, parked on a town street' },
  { src: 'CFF4D29D-6F69-4E6E-9497-11F106A85C3E.jpeg', slug: 'traveller-elite-livery-rear-night', vehicle: 'elite-livery', kind: 'exterior', alt: 'Back of the Elite Force Traveller at night, with the Elite Travel Hub sign lit in the rear window' },
  { src: 'e2d5f6d2-bad4-4f41-9055-b1535a8179fb.jpeg', slug: 'interior-cream-seats-wood-panels', vehicle: null, kind: 'interior', alt: 'Cream leather seats under wood-finish overhead panels, speakers and a floral ceiling light' },
];

/** Background-removed shots (plates already blanked — see scripts/mask-plates.py --cutouts). */
export const CUTOUTS = [
  { file: 'traveller-elite-livery-profile.png', vehicle: 'elite-livery', alt: 'Force Traveller in Elite livery, side view' },
  { file: 'traveller-elite-livery-side.png', vehicle: 'elite-livery', alt: 'Force Traveller in Elite livery, seen from the front corner' },
  { file: 'traveller-elite-livery-front.png', vehicle: 'elite-livery', alt: 'Force Traveller in Elite livery, front view' },
  { file: 'traveller-black-grille-front.png', vehicle: 'black-grille', alt: 'Force Traveller with a black mesh grille, front view' },
  { file: 'toyota-innova-front.png', vehicle: 'innova', alt: 'Silver Toyota Innova, front view' },
];

async function exists(p) {
  return fs.access(p).then(() => true, () => false);
}

async function main() {
  await fs.mkdir(outPhotos, { recursive: true });
  await fs.mkdir(outCutouts, { recursive: true });
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  sharp.concurrency(2);

  const manifest = { photos: {}, cutouts: {} };

  for (const photo of PHOTOS) {
    const plateFree = path.join(masked, `${photo.slug}.jpg`);
    if (photo.kind !== 'interior' && !(await exists(plateFree))) throw new Error(`Missing plate-free copy: ${plateFree} — run scripts/mask-plates.py`);
    const input = photo.kind === 'interior' ? path.join(originals, photo.src) : plateFree;
    if (!(await exists(input))) throw new Error(`Missing original: ${input}`);
    const meta = await sharp(input).rotate().toBuffer({ resolveWithObject: true }).then((r) => r.info);
    const widths = PHOTO_WIDTHS.filter((w) => w < meta.width).concat(Math.min(meta.width, PHOTO_WIDTHS.at(-1)));
    const unique = [...new Set(widths)].sort((a, b) => a - b);
    for (const w of unique) {
      const out = path.join(outPhotos, `${photo.slug}-${w}.webp`);
      if (!(await exists(out))) {
        await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: w > 1000 ? 74 : 78, effort: 5 }).toFile(out);
      }
    }
    const { dominant } = await sharp(input).rotate().resize(64).stats();
    manifest.photos[photo.slug] = {
      base: `/images/fleet/${photo.slug}`,
      widths: unique,
      width: meta.width,
      height: meta.height,
      alt: photo.alt,
      kind: photo.kind,
      vehicle: photo.vehicle,
      tone: `rgb(${dominant.r} ${dominant.g} ${dominant.b})`,
    };
    console.log(`photo   ${photo.slug} ${meta.width}x${meta.height} → ${unique.join(', ')}`);
  }

  for (const cut of CUTOUTS) {
    const input = path.join(root, 'assets', 'cutouts', cut.file);
    const slug = cut.file.replace(/\.png$/, '');
    const meta = await sharp(input).metadata();
    const widths = [...new Set(CUTOUT_WIDTHS.filter((w) => w < meta.width).concat(Math.min(meta.width, CUTOUT_WIDTHS.at(-1))))].sort((a, b) => a - b);
    for (const w of widths) {
      const out = path.join(outCutouts, `${slug}-${w}.webp`);
      if (!(await exists(out))) await sharp(input).resize({ width: w }).webp({ quality: 82, alphaQuality: 90, effort: 5 }).toFile(out);
    }
    manifest.cutouts[slug] = { base: `/images/cutouts/${slug}`, widths, width: meta.width, height: meta.height, alt: cut.alt, vehicle: cut.vehicle };
    console.log(`cutout  ${slug} ${meta.width}x${meta.height} → ${widths.join(', ')}`);
  }

  // Social sharing card (1200×630) from the fleet line-up
  await sharp(path.join(masked, 'fleet-three-travellers-lineup.jpg'))
    .rotate()
    .resize(1200, 630, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(root, 'client', 'public', 'images', 'og-default.jpg'));

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`manifest → ${path.relative(root, manifestPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
