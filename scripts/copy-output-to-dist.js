// scripts/copy-output-to-dist.js
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '.output', 'public'); // Nitro public output
const dest = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(src)) {
  console.error('.output/public not found. Build may have failed.');
  process.exit(1);
}

// simple recursive copy
function copyDir(srcDir, destDir) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const item of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, item);
    const d = path.join(destDir, item);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
copyDir(src, dest);
console.log('Copied .output/public → dist');
