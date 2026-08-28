#!/usr/bin/env python3
"""Generate the installer's two WixUI bitmaps.

Windows Installer wants plain BMPs at the sizes the WixUI dialogs were laid out
against: a 493x58 banner across the top of the interior dialogs, and a 493x312
backdrop behind the Welcome and Finish dialogs.

Both dialogs draw their text transparently, in the system window-text colour,
straight over the bitmap. So the areas the text lands on have to stay light:
on the backdrop that is everything right of x=180 (the dialogs put their text
at x=135 of 370 dialog units), and on the banner it is the left two thirds.
Everything here is arranged around that constraint.

The key art is packaging/art/installer-panel.jpg; the wordmark comes from the
launcher's own ui/assets.

  usage: make-bitmaps.py <ui-assets-dir> <out-dir>
"""
import os
import sys

from PIL import Image, ImageDraw

BANNER = (493, 58)
DIALOG = (493, 312)

GOLD = (217, 180, 91)
PAPER = (252, 250, 247)

# The backdrop's art column. The Welcome/Finish text starts at dialog unit 135
# of 370, which is x=180 here; stop short of it.
SPLIT = 176

# The banner's art block, right of where the longest title text reaches.
BANNER_ART = 150

ART = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "art", "installer-panel.jpg")

# Where the interesting part of the key art sits, as a fraction of its width:
# the character, rather than the castle off to the left.
FOCUS_X = 0.58


def _crop_to(art, size, focus_y=0.5):
    """Crop `art` to `size`'s aspect ratio around the focal point, then scale."""
    target = size[0] / size[1]
    if art.width / art.height > target:
        width = round(art.height * target)
        left = min(max(round(art.width * FOCUS_X - width / 2), 0),
                   art.width - width)
        art = art.crop((left, 0, left + width, art.height))
    else:
        height = round(art.width / target)
        top = min(max(round(art.height * focus_y - height / 2), 0),
                  art.height - height)
        art = art.crop((0, top, art.width, top + height))
    return art.resize(size, Image.LANCZOS)


def _paste_fitted(canvas, art, box, pad=0):
    """Paste `art` centred inside `box`, scaled to fit, preserving alpha."""
    left, top, right, bottom = box
    max_w, max_h = right - left - 2 * pad, bottom - top - 2 * pad
    scale = min(max_w / art.width, max_h / art.height)
    art = art.resize((max(1, round(art.width * scale)),
                      max(1, round(art.height * scale))), Image.LANCZOS)
    canvas.paste(art,
                 (left + pad + (max_w - art.width) // 2,
                  top + pad + (max_h - art.height) // 2),
                 art)


def _scrim(img, box, height, strength=235):
    """Darken the bottom `height` px of `box` so a logo over it stays legible."""
    left, top, right, bottom = box
    overlay = Image.new("L", (right - left, height))
    draw = ImageDraw.Draw(overlay)
    for y in range(height):
        draw.line([(0, y), (right - left, y)],
                  fill=round(strength * (y / (height - 1)) ** 1.6))
    img.paste(Image.new("RGB", overlay.size, (10, 6, 18)),
              (left, bottom - height), overlay)


def make_dialog(assets, out):
    img = Image.new("RGB", DIALOG, PAPER)
    img.paste(_crop_to(Image.open(ART).convert("RGB"), (SPLIT, DIALOG[1])),
              (0, 0))
    _scrim(img, (0, 0, SPLIT, DIALOG[1]), 118)
    ImageDraw.Draw(img).line([(SPLIT, 0), (SPLIT, DIALOG[1])], fill=GOLD)

    logo = Image.open(os.path.join(assets, "logo-full.png")).convert("RGBA")
    _paste_fitted(img, logo, (0, DIALOG[1] - 74, SPLIT, DIALOG[1] - 8), pad=16)

    img.save(out)
    return out


def make_banner(assets, out):
    img = Image.new("RGB", BANNER, PAPER)
    art = _crop_to(Image.open(ART).convert("RGB"), (BANNER_ART, BANNER[1]),
                   focus_y=0.34)
    img.paste(art, (BANNER[0] - BANNER_ART, 0))

    # Fade the art's left edge into the paper so the strip has no hard seam and
    # a long dialog title can run under it without hitting a wall of colour.
    fade = 54
    mask = Image.new("L", (fade, BANNER[1]))
    draw = ImageDraw.Draw(mask)
    for x in range(fade):
        draw.line([(x, 0), (x, BANNER[1])], fill=round(255 * (x / (fade - 1))))
    left = BANNER[0] - BANNER_ART
    img.paste(Image.new("RGB", (fade, BANNER[1]), PAPER),
              (left, 0), Image.eval(mask, lambda v: 255 - v))

    ImageDraw.Draw(img).line([(0, BANNER[1] - 1), (BANNER[0], BANNER[1] - 1)],
                             fill=GOLD)
    img.save(out)
    return out


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: make-bitmaps.py <ui-assets-dir> <out-dir>")
    assets, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    for path in (make_dialog(assets, os.path.join(out_dir, "dlgbmp.bmp")),
                 make_banner(assets, os.path.join(out_dir, "bannrbmp.bmp"))):
        print("wrote %s" % path)


if __name__ == "__main__":
    main()
