
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const script = `
import os
from PIL import Image, ImageDraw

ROOT = ${JSON.stringify(ROOT)}
SOURCE = os.path.join(ROOT, 'src', 'assets', 'MedScribe_Logo.png')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

GLYPH_BOX = (267, 204, 1069, 886)
LAUNCHER_DENSITIES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
FOREGROUND_DENSITIES = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
BUBBLE_DENSITIES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
BACKGROUND = (255, 255, 255, 255)

source = Image.open(SOURCE).convert('RGBA')

def squared_glyph(padding_ratio):
    left, top, right, bottom = GLYPH_BOX
    glyph = source.crop(GLYPH_BOX)
    side = max(glyph.width, glyph.height)
    canvas_side = int(side * (1.0 + padding_ratio * 2))
    canvas = Image.new('RGBA', (canvas_side, canvas_side), BACKGROUND)
    canvas.paste(
        glyph,
        ((canvas_side - glyph.width) // 2, (canvas_side - glyph.height) // 2),
        glyph,
    )
    return canvas

def circle_masked(image, size):
    scaled = image.resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(scaled, (0, 0), mask)
    return out

def rounded(image, size, radius_ratio):
    scaled = image.resize((size, size), Image.LANCZOS)
    radius = int(size * radius_ratio)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size * 4 - 1, size * 4 - 1), radius=radius * 4, fill=255
    )
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(scaled, (0, 0), mask)
    return out

def write(image, folder, name):
    target = os.path.join(RES, folder)
    os.makedirs(target, exist_ok=True)
    image.save(os.path.join(target, name), 'PNG', optimize=True)

launcher_art = squared_glyph(0.14)
round_art = squared_glyph(0.30)
adaptive_art = squared_glyph(0.52)
bubble_art = squared_glyph(0.28)

written = 0
for density, size in LAUNCHER_DENSITIES.items():
    write(rounded(launcher_art, size, 0.22), 'mipmap-' + density, 'ic_launcher.png')
    write(circle_masked(round_art, size), 'mipmap-' + density, 'ic_launcher_round.png')
    written += 2

for density, size in FOREGROUND_DENSITIES.items():
    foreground = adaptive_art.resize((size, size), Image.LANCZOS)
    transparent = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    transparent.paste(foreground, (0, 0))
    write(transparent, 'mipmap-' + density, 'ic_launcher_foreground.png')
    written += 1

for density, size in BUBBLE_DENSITIES.items():
    write(circle_masked(bubble_art, size), 'drawable-' + density, 'ic_bubble_logo.png')
    written += 1

print('generated', written, 'icon files')
`;

const INTERPRETERS = ['python3', 'python'];
const REQUIREMENT = 'Requires Python 3 with Pillow. Install it with: pip install Pillow';

function run() {
  let missingInterpreter = 0;

  for (const interpreter of INTERPRETERS) {
    try {
      execFileSync(interpreter, ['-c', script], { stdio: 'inherit' });
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        missingInterpreter += 1;
        continue;
      }
      console.error(REQUIREMENT);
      return false;
    }
  }

  if (missingInterpreter === INTERPRETERS.length) {
    console.error(`Python was not found on PATH. ${REQUIREMENT}`);
  }
  return false;
}

if (!run()) {
  process.exit(1);
}
