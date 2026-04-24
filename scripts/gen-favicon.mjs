import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const imgPath = join('src', 'assets', 'img', 'sidebar-millennium-mobility.png');
const b64 = readFileSync(imgPath).toString('base64');

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" width="64" height="64">`,
  `  <rect width="64" height="64" rx="14" ry="14" fill="white"/>`,
  `  <image href="data:image/png;base64,${b64}" x="6" y="6" width="52" height="52" preserveAspectRatio="xMidYMid meet"/>`,
  `</svg>`,
].join('\n');

writeFileSync(join('public', 'favicon.svg'), svg);
console.log('favicon.svg created with white rounded background');
