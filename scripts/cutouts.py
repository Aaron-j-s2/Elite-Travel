"""Create transparent vehicle cutouts from the original photos.

Usage:  python scripts/cutouts.py <photos_dir> <out_dir> <original_name>=<output_slug> ...

Originals are only read, never modified. Each cutout is written as a lossless PNG
(<out_dir>/<slug>.png) and must be visually reviewed before it is used on the site;
see docs/ASSETS.md for the review notes.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps
from rembg import new_session, remove

MAX_EDGE = 2000  # work at a size that keeps edges clean but memory modest


def keep_largest_shape(cut: Image.Image) -> Image.Image:
    """Drop stray fragments (poles, foliage specks) the model kept: only the biggest
    connected region of the alpha mask — the vehicle — survives."""
    rgba = np.array(cut)
    solid = (rgba[:, :, 3] > 24).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    if count > 2:
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        rgba[:, :, 3] = np.where(labels == biggest, rgba[:, :, 3], 0)
    # Trim thin things sticking up above the roofline (poles, antennas touching the vehicle)
    widths = (rgba[:, :, 3] > 24).sum(axis=1)
    min_width = 0.04 * widths.max()
    for y in range(rgba.shape[0]):
        if widths[y] >= min_width:
            break
        rgba[y, :, 3] = 0
    return Image.fromarray(rgba)


def main() -> None:
    photos, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    session = new_session("isnet-general-use")
    for pair in sys.argv[3:]:
        src, slug = pair.split("=", 1)
        img = ImageOps.exif_transpose(Image.open(photos / src)).convert("RGB")
        img.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        cut = keep_largest_shape(remove(img, session=session, post_process_mask=True))
        bbox = cut.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        if bbox:
            cut = cut.crop(bbox)
        cut.save(out / f"{slug}.png", optimize=True)
        print(f"{src} -> {slug}.png {cut.size}")


if __name__ == "__main__":
    main()
