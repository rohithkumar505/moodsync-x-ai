import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'node_modules/@vladmandic/face-api/model');
const dest = path.join(root, 'public/face-models');

const REQUIRED = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_expression_model-weights_manifest.json',
  'face_expression_model.bin',
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model.bin',
];

if (!fs.existsSync(src)) {
  console.warn('[face-models] @vladmandic/face-api not installed — run npm install');
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });

for (const file of REQUIRED) {
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
}

console.log('[face-models] Copied AI models to public/face-models');
