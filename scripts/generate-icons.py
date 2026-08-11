"""Generate PWA icon assets for Freeze Fund.

Draws a simple on-brand "coin" mark (navy square, cyan coin, navy $) at the
sizes needed for the web app manifest, apple-touch-icon, and favicon.
Re-run with `python3 scripts/generate-icons.py` after changing the palette.
"""

from PIL import Image, ImageDraw, ImageFont

NAVY = (42, 45, 124, 255)
CYAN = (41, 199, 232, 255)

FONT_PATH = "C:/Windows/Fonts/arialbd.ttf"


def draw_icon(size: int, safe_zone: bool) -> Image.Image:
    img = Image.new("RGBA", (size, size), NAVY)
    draw = ImageDraw.Draw(img)

    # Maskable icons need their content inside the center ~80% safe circle;
    # shrink the coin a bit further for margin of safety.
    radius_ratio = 0.36 if safe_zone else 0.42
    r = int(size * radius_ratio)
    cx = cy = size // 2

    border = max(2, size // 32)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=CYAN, outline=NAVY, width=border)

    font_size = int(r * 1.15)
    font = ImageFont.truetype(FONT_PATH, font_size)
    text = "$"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), text, font=font, fill=NAVY)

    return img


def main():
    out = "public"
    draw_icon(192, safe_zone=False).save(f"{out}/icon-192.png")
    draw_icon(512, safe_zone=False).save(f"{out}/icon-512.png")
    draw_icon(512, safe_zone=True).save(f"{out}/icon-maskable-512.png")

    apple = draw_icon(180, safe_zone=False).convert("RGB")
    apple.save(f"{out}/apple-touch-icon.png")

    fav_sizes = [16, 32, 48]
    fav_imgs = [draw_icon(s, safe_zone=False) for s in fav_sizes]
    fav_imgs[-1].save(
        "src/app/favicon.ico",
        sizes=[(s, s) for s in fav_sizes],
    )
    print("Icons written.")


if __name__ == "__main__":
    main()
