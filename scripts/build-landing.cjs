const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const requestedEnvironment = process.argv[2] || 'production';
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'landing');

const publicPaths = [
  'index.html',
  'about',
  'advertisers',
  'css',
  'js',
  'legal',
  'players',
  'pricing',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'apple-touch-icon.png',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon.ico',
  'Gmail_icon.webp',
  'manifest.webmanifest',
  'site.webmanifest',
];

function removeDirIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function copyPublicPath(sourceRelativePath) {
  const sourcePath = path.join(rootDir, sourceRelativePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required public asset: ${sourceRelativePath}`);
  }

  const destinationPath = path.join(outputDir, sourceRelativePath);
  fs.cpSync(sourcePath, destinationPath, { recursive: true });
}

removeDirIfExists(outputDir);
fs.mkdirSync(outputDir, { recursive: true });

for (const publicPath of publicPaths) {
  copyPublicPath(publicPath);
}

execFileSync(
  process.execPath,
  [path.join(rootDir, 'scripts', 'configure-app-links.cjs'), requestedEnvironment, outputDir],
  {
    stdio: 'inherit',
  },
);

console.log(`Built Firebase Hosting output in ${outputDir}`);
