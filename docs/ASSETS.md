# Photo assets

All vehicle photography on the website comes from the business's own photos in
`/var/www/html/local/elite-hub/elite photos` (16 JPEGs, 4032–4160 px, from phone cameras).
**The originals are never modified.** Every derived file is written elsewhere.

## Inventory

Vehicles were identified by their registration plates when the fleet was catalogued, but **no registration
number may appear anywhere on the website** — not in images, file names, alt text or data. Interior photos
are not assigned to a specific vehicle because the photos don't show which vehicle they were taken in.

| # | Original | Web name | Subject | Used for |
|---|---|---|---|---|
| 1 | 0752EF29… | interior-blue-pushback-seats-kathakali-panels | Blue push-back seats, illuminated Kathakali panels | Cabins section |
| 2 | 0e34c098… | traveller-black-grille-front-garden | Black-grille Force Traveller, front, among banana trees | Vehicle gallery |
| 3 | 139fec8f… | traveller-black-grille-rear | Black-grille Force Traveller, rear, ladder + spare wheel | Vehicle gallery |
| 4 | 22379A4F… | traveller-elite-livery-night-front-quarter | Elite-livery Force Traveller at night | Vehicle gallery |
| 5 | 33DFAE56… | traveller-elite-livery-night-profile | Elite-livery Force Traveller, side profile, night | Cover photo, experiences band, cutout source |
| 6 | 3883603E… | traveller-elite-livery-front | Elite-livery Force Traveller, front | Gallery, cutout source |
| 7 | 7339CACD… | interior-white-leather-cabin-forward | White quilted captain seats, overhead screen | Cabins, booking page |
| 8 | 7E9A535C… | interior-white-leather-floral-ceiling | White seats, floral ceiling panel | Cabins |
| 9 | 812D0E31… | traveller-elite-livery-side-quarter | Elite-livery Force Traveller, three-quarter | Gallery, cutout source |
| 10 | 85d9950b… | fleet-three-travellers-lineup | Three travellers side by side at dusk | Line-up band, services, social card |
| 11 | 899BA67C… | toyota-innova-front | Silver Toyota Innova, rose decoration | Innova cover, cutout source |
| 12 | 9525ED82… | interior-white-leather-rows-ambient | Rows of white seats, ambient lighting | Cabins |
| 13 | 987898B1… | interior-blue-seats-led-ceiling | Blue seats, LED ceiling | Services page |
| 14 | 9A0B4697… | traveller-black-grille-front-street | Black-grille Force Traveller, front, town street | Cover photo, cutout source |
| 15 | CFF4D29D… | traveller-elite-livery-rear-night | Elite-livery Force Traveller, rear at night | Gallery |
| 16 | e2d5f6d2… | interior-cream-seats-wood-panels | Cream seats, wood-grain panels (portrait) | Cabins |

All 16 photos are in focus, well exposed and high resolution, and all are used. The third vehicle
appears only in photo 10, so it is seeded **disabled** ("Traveller — awaiting photos") until it has its own photos.

## Pipeline

### 1. Background removal (one-off, reviewed by eye)

`scripts/cutouts.py` uses [rembg](https://github.com/danielgatis/rembg) with the `isnet-general-use` model.
It works at a 2000 px maximum and then cleans the mask:
- it keeps only the largest connected shape (the vehicle), which removes stray fragments;
- it trims thin protrusions above the roofline, such as a utility pole touching the black-grille traveller's roof.

```bash
python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]" pillow opencv-python-headless
.venv/bin/python -I scripts/cutouts.py "../elite photos" /tmp/cutouts 812D0E31-…jpeg=force-traveller-side
```

Each cutout was inspected on a tinted background before being copied into `assets/cutouts/`:

| Cutout | Source | Review notes |
|---|---|---|
| traveller-elite-livery-profile.png | #5 | Clean edges; blue accent light preserved. Used on the homepage fleet stage. |
| traveller-elite-livery-side.png | #9 | Clean; the original photo crops the front bumper, so the cut edge sits at a card edge. |
| traveller-elite-livery-front.png | #6 | Clean; bottom of the bumper is cropped by the original frame. Used in the closing call to action. |
| traveller-black-grille-front.png | #14 | A pole touching the roof was trimmed; a very small stub remains at the roof's top-left. |
| toyota-innova-front.png | #11 | Clean after fragment removal; a decoration on the right mirror is part of the car and was kept. |

No vehicle was altered beyond removing its background and blanking its number plate (step 2).
Colour, shape, badges and livery are as photographed.

### 2. Blanking registration plates

`scripts/mask-plates.py` blanks every legible plate (12 on the photos, 3 on the cutouts). Each plate's four
corners were read off gridded close-ups and are listed in the script. The plate face, just inside its frame,
is repainted with the plate's own background colour, averaged from its bright pixels so the photo's lighting
is kept — a clean blank plate, like those on the brand line-up image. Every result was reviewed by eye.

```bash
.venv/bin/python -I scripts/mask-plates.py "../elite photos" assets/masked   # photos → assets/masked/<slug>.jpg
.venv/bin/python -I scripts/mask-plates.py --cutouts assets/cutouts            # cutouts, renamed without plate codes
```

The night profile (#5) and night three-quarter (#9) show no legible plate. Originals are never modified.

### 3. Responsive variants

`npm run images:process` runs `scripts/process-images.mjs` (sharp):
- reads exterior photos from the plate-free copies in `assets/masked/` (interiors from the originals);
- applies EXIF rotation and strips all metadata, including GPS;
- writes WebP photos at 480 / 960 / 1600 / 2400 px to `client/public/images/fleet/` (quality 74–78);
- writes transparent WebP cutouts at 480 / 960 / 1600 px to `client/public/images/cutouts/`;
- creates a 1200×630 social sharing card, `client/public/images/og-default.jpg`;
- writes `client/src/data/photos.json` with dimensions, alt text and dominant colour.

Components render `srcset` + `sizes`, explicit width and height (no layout shift), and `loading="lazy"`
below the fold.

Total output is about 14 MB across all sizes. A phone typically downloads the 480 px versions
(22–73 KB each) or the 960 px versions (62–292 KB each, the busiest night interiors being the largest).

### 3. Uploaded photos (admin)

Photos uploaded in the dashboard go through the same treatment on the server (`server/src/lib/storage.ts`):
- sharp decodes them, rejecting anything that isn't a real image;
- they are rotated, stripped of metadata and stored as WebP at 480 / 960 / 1600 / 2400 px;
- they go to Supabase Storage when it's configured, otherwise to the server disk.

## Brand line-up (homepage hero)

`assets/brand/elite-fleet-lineup.png` is the business's own brand image of the line-up in Elite livery
(Toyota Innova, two Force Travellers, a tourist coach and a Suzuki Dzire), supplied by the owner on 2026-10-24.
Its background was removed with rembg (`isnet-general-use`) → `assets/cutouts/elite-fleet-lineup.png`, cropped to
the vehicles, and exported to `client/public/images/brand/elite-fleet-lineup-{640,1200,1800,2073}.webp`.
The ground shadow is drawn in CSS, so the cut-out can sit on any background.
