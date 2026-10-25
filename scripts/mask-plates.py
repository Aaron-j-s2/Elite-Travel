"""Hide registration numbers on the business's photographs.

Usage:  python scripts/mask-plates.py <photos_dir> <out_dir>
        python scripts/mask-plates.py --cutouts <cutouts_dir>

For every plate listed below, the plate face (given by its four corners, just inside the frame)
is repainted with the plate's own background colour (averaged from the plate's bright pixels,
so the photo's lighting gradient is kept). The result is a clean blank plate with its frame intact —
the same look as the blank plates on the brand line-up image. Originals are only read, never modified.

Every output must be reviewed by eye; see docs/ASSETS.md.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

# original file → (output slug, [(box, corners)]). `box` is (left, top, right, bottom) as fractions of
# the auto-oriented image; `corners` are the plate face's TL, TR, BR, BL as fractions of that box
# (they may fall slightly outside it). Read off gridded crops of each plate.
PHOTOS = {
    '0e34c098-3458-4062-a70c-7da7598f33f3.jpeg': ('traveller-black-grille-front-garden', [
        ((0.19, 0.71, 0.43, 0.80), [(0.09, 0.26), (0.91, 0.41), (0.91, 0.84), (0.09, 0.67)])]),
    '139fec8f-ac76-4d36-8c5f-96ffd02bdd06.jpeg': ('traveller-black-grille-rear', [
        ((0.38, 0.75, 0.63, 0.87), [(0.07, 0.15), (0.92, 0.49), (0.90, 0.83), (0.05, 0.49)])]),
    '22379A4F-166D-4F17-A2A9-3E2FC159F2C1.jpeg': ('traveller-elite-livery-night-front-quarter', [
        ((0.72, 0.69, 0.84, 0.81), [(0.21, 0.49), (0.87, 0.26), (0.82, 0.56), (0.15, 0.79)])]),
    '33DFAE56-1E5B-4165-9888-15F1DE3EAB13.jpeg': ('traveller-elite-livery-night-profile', []),
    '3883603E-BE0B-4999-BD1C-9206A12CC077.jpeg': ('traveller-elite-livery-front', [
        ((0.21, 0.79, 0.49, 0.87), [(0.07, -0.08), (0.93, 0.29), (0.94, 0.67), (0.06, 0.30)])]),
    '812D0E31-8A89-407B-8174-D39498795541.jpeg': ('traveller-elite-livery-side-quarter', []),
    '85d9950b-165e-464d-aa0c-c9e7ceb2d1d8.jpeg': ('fleet-three-travellers-lineup', [
        ((0.095, 0.600, 0.170, 0.645), [(0.15, 0.34), (0.84, 0.34), (0.85, 0.69), (0.16, 0.70)]),
        ((0.418, 0.617, 0.492, 0.660), [(0.11, 0.31), (0.86, 0.33), (0.86, 0.81), (0.11, 0.79)]),
        ((0.776, 0.622, 0.850, 0.662), [(0.14, 0.28), (0.88, 0.28), (0.88, 0.75), (0.14, 0.75)])]),
    '899BA67C-7D40-4640-9010-5AAA3FF09DCB.jpeg': ('toyota-innova-front', [
        ((0.36, 0.53, 0.57, 0.59), [(0.10, 0.20), (0.91, 0.29), (0.91, 0.76), (0.10, 0.69)])]),
    '9A0B4697-4E24-4670-BED3-87DAD4887DD3.jpeg': ('traveller-black-grille-front-street', [
        ((0.59, 0.66, 0.81, 0.745), [(0.08, 0.39), (0.94, 0.16), (0.95, 0.54), (0.08, 0.85)])]),
    'CFF4D29D-6F69-4E6E-9497-11F106A85C3E.jpeg': ('traveller-elite-livery-rear-night', [
        ((0.55, 0.59, 0.67, 0.71), [(0.15, 0.19), (0.83, 0.14), (0.87, 0.76), (0.17, 0.88)])]),
}

# cut-out (assets/cutouts) → (new name, [(box, corners)]); boxes and corners as for PHOTOS, relative
# to the cut-out image. The profile and three-quarter cut-outs show no plate.
CUTOUTS = {
    'force-traveller-kl39-front.png': ('traveller-elite-livery-front.png', [
        ((0.18, 0.76, 0.52, 0.90), [(0.15, 0.28), (0.89, 0.60), (0.89, 0.94), (0.16, 0.58)])]),
    'force-traveller-kl39-profile.png': ('traveller-elite-livery-profile.png', []),
    'force-traveller-kl39-side.png': ('traveller-elite-livery-side.png', []),
    'force-traveller-tn07-front.png': ('traveller-black-grille-front.png', [
        ((0.52, 0.76, 0.86, 0.91), [(0.16, 0.55), (0.85, 0.37), (0.85, 0.69), (0.16, 0.97)])]),
    'toyota-innova-tn02-front.png': ('toyota-innova-front.png', [
        ((0.30, 0.77, 0.67, 0.92), [(0.065, 0.03), (0.905, 0.16), (0.905, 0.70), (0.06, 0.62)])]),
}


def blank_plate(region: np.ndarray, quad: np.ndarray, inset: float) -> np.ndarray:
    """Repaint the inside of `quad` with the plate's own background, following its lighting."""
    h, w = region.shape[:2]
    centre = quad.mean(axis=0)
    inner = (centre + (quad - centre) * (1 - inset)).astype(np.int32)
    face = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(face, inner, 255)
    gray = cv2.cvtColor(region, cv2.COLOR_RGB2GRAY)
    # Background = the brighter pixels of the plate face; characters are the darker ones.
    vals = gray[face > 0]
    thresh, _ = cv2.threshold(vals.reshape(-1, 1), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    bg_px = ((gray > thresh) & (face > 0)).astype(np.float32)
    bg_px = cv2.erode(bg_px, np.ones((3, 3), np.uint8))
    # Masked blur: average only background pixels, so the fill keeps the plate's light gradient.
    k = max(5, int(min(cv2.minAreaRect(inner)[1]) * 0.9)) | 1
    src = region.astype(np.float32)
    num = cv2.GaussianBlur(src * bg_px[..., None], (k, k), 0)
    den = cv2.GaussianBlur(bg_px, (k, k), 0)[..., None]
    fill = num / np.maximum(den, 1e-3)
    fallback = np.median(region[(bg_px > 0)], axis=0) if bg_px.any() else region[face > 0].mean(axis=0)
    fill = np.where(den > 0.02, fill, fallback)
    noise = np.random.default_rng(7).normal(0, 1.6, fill.shape)
    alpha = cv2.GaussianBlur(face.astype(np.float32) / 255, (3, 3), 0)[..., None]
    out = src * (1 - alpha) + (fill + noise) * alpha
    return np.clip(out, 0, 255).astype(np.uint8)


def mask_plates(img: np.ndarray, plates, inset: float = 0.03) -> np.ndarray:
    out = img.copy()
    h, w = img.shape[:2]
    for (left, top, right, bottom), corners in plates:
        quad = np.array([(left + x * (right - left), top + y * (bottom - top)) for x, y in corners]) * [w, h]
        # Work on the plate plus a margin, so the background average has room around the plate.
        pad = (quad.max(axis=0) - quad.min(axis=0)) * 0.25
        x0, y0 = np.maximum(quad.min(axis=0) - pad, 0).astype(int)
        x1, y1 = np.minimum(quad.max(axis=0) + pad, [w, h]).astype(int)
        region = out[y0:y1, x0:x1]
        out[y0:y1, x0:x1] = blank_plate(region, (quad - [x0, y0]).astype(np.float32), inset)
    return out


def main():
    if sys.argv[1] == '--cutouts':
        folder = Path(sys.argv[2])
        for name, (new_name, boxes) in CUTOUTS.items():
            src = Image.open(folder / name).convert('RGBA')
            rgba = np.array(src)
            rgb = mask_plates(rgba[:, :, :3], boxes)
            Image.fromarray(np.dstack([rgb, rgba[:, :, 3]])).save(folder / new_name)
            print(f'cutout  {name} → {new_name} ({len(boxes)} plate(s))')
        return
    photos, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for name, (slug, boxes) in PHOTOS.items():
        img = np.array(ImageOps.exif_transpose(Image.open(photos / name)).convert('RGB'))
        Image.fromarray(mask_plates(img, boxes)).save(out / f'{slug}.jpg', quality=95, subsampling=0)
        print(f'photo   {name} → {slug}.jpg ({len(boxes)} plate(s))')


if __name__ == '__main__':
    main()
