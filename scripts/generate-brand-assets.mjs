import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const MARK_SIZE = 128;

const script = `
import os
from PIL import Image

root = os.path.abspath(${JSON.stringify(ROOT)})
source = os.path.join(root, 'src', 'assets', 'anuvadini-icon.png')
target = os.path.join(root, 'src', 'assets', 'anuvadini-mark.png')

image = Image.open(source).convert('RGBA')
bounds = image.getbbox()
if bounds:
    image = image.crop(bounds)

side = max(image.size)
square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
square.paste(image, ((side - image.width) // 2, (side - image.height) // 2))

mark = square.resize((${MARK_SIZE}, ${MARK_SIZE}), Image.LANCZOS)
mark.save(target, format='PNG', optimize=True)

print('wrote', os.path.relpath(target, root), mark.size, str(os.path.getsize(target) // 1024) + 'KB')
`;

const INTERPRETERS = ['python3', 'python'];
const REQUIREMENT = 'Requires Python 3 with Pillow. Install it with: pip install Pillow';

function run() {
  for (const interpreter of INTERPRETERS) {
    try {
      execFileSync(interpreter, ['-c', script], { stdio: 'inherit' });
      return true;
    } catch {
      continue;
    }
  }

  console.error(REQUIREMENT);
  return false;
}

if (!run()) {
  process.exit(1);
}
