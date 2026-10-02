/**
 * generate-png-icons.mjs
 * Uses sharp to rasterize SVG icons for PWA manifest.
 */
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let sharp;
try {
  const mod = await import('sharp');
  sharp = mod.default;
} catch {
  console.error('sharp not installed. Run: npm install --save-dev sharp');
  process.exit(1);
}

const svgPath = join(root, 'public', 'icons', 'icon.svg');
const svgBuffer = readFileSync(svgPath);
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const sizes = [192, 512];

for (const size of sizes) {
  const outPath = join(outDir, `icon-${size}.png`);
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`✓ Generated ${outPath}`);
}

// Apple touch icon (180x180)
const applePath = join(root, 'public', 'apple-touch-icon.png');
await sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile(applePath);
console.log(`✓ Generated ${applePath}`);

console.log('\nAll icons generated successfully!');
