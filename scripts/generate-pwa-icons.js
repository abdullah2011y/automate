const fs = require('fs');
const path = require('path');
const { PNG } = require('../apps/api/node_modules/pngjs');

function createIcon(size, isMaskable = false) {
  const png = new PNG({ width: size, height: size });

  const cx = size / 2;
  const cy = size / 2;
  const cornerRadius = isMaskable ? 0 : size * 0.22;

  // Colors:
  // Background: #0A192F (10, 25, 47)
  // Accent gradient: #028FA8 -> #10B981
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Check squircle bounds if not maskable
      if (!isMaskable) {
        const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerRadius));
        const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerRadius));
        if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
          continue;
        }
      }

      // Background gradient
      const gradRatio = (x + y) / (2 * size);
      const bgR = Math.round(10 * (1 - gradRatio) + 14 * gradRatio);
      const bgG = Math.round(25 * (1 - gradRatio) + 36 * gradRatio);
      const bgB = Math.round(47 * (1 - gradRatio) + 66 * gradRatio);

      png.data[idx] = bgR;
      png.data[idx + 1] = bgG;
      png.data[idx + 2] = bgB;
      png.data[idx + 3] = 255;
    }
  }

  // Draw lightning bolt symbol
  // Path normalized coordinates:
  // [ [0.55, 0.15], [0.30, 0.52], [0.50, 0.52], [0.44, 0.85], [0.72, 0.44], [0.53, 0.44], [0.58, 0.15] ]
  // Let's draw by point-in-polygon algorithm or line rasterization
  const poly = [
    { x: size * 0.55, y: size * 0.14 },
    { x: size * 0.28, y: size * 0.52 },
    { x: size * 0.49, y: size * 0.52 },
    { x: size * 0.42, y: size * 0.86 },
    { x: size * 0.72, y: size * 0.44 },
    { x: size * 0.53, y: size * 0.44 },
    { x: size * 0.59, y: size * 0.14 },
  ];

  function pointInPoly(px, py, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      if (png.data[idx + 3] === 0) continue;

      if (pointInPoly(x, y, poly)) {
        // Vibrant cyan to emerald gradient: #028FA8 -> #10B981
        const t = y / size;
        const boltR = Math.round(2 * (1 - t) + 16 * t);
        const boltG = Math.round(143 * (1 - t) + 185 * t);
        const boltB = Math.round(168 * (1 - t) + 129 * t);

        png.data[idx] = boltR;
        png.data[idx + 1] = boltG;
        png.data[idx + 2] = boltB;
        png.data[idx + 3] = 255;
      }
    }
  }

  return png;
}

const iconsDir = path.join(__dirname, '../apps/web/public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate 192x192
const p192 = createIcon(192);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), PNG.sync.write(p192));

// Generate 512x512
const p512 = createIcon(512);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), PNG.sync.write(p512));

// Generate maskable 512x512
const pMask = createIcon(512, true);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), PNG.sync.write(pMask));

// Generate Apple Touch Icon (180x180)
const p180 = createIcon(180, true);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), PNG.sync.write(p180));
fs.writeFileSync(path.join(__dirname, '../apps/web/public/apple-touch-icon.png'), PNG.sync.write(p180));

// Generate favicon (32x32)
const p32 = createIcon(32);
fs.writeFileSync(path.join(__dirname, '../apps/web/public/favicon.ico'), PNG.sync.write(p32));

console.log('Successfully generated all PWA icons in apps/web/public!');
