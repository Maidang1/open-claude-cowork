const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const NODE_VERSION = process.env.BUILD_NODE_VERSION || 'v20.11.0';
const PLATFORM = process.env.BUILD_PLATFORM || process.platform;
const ARCH = process.env.BUILD_ARCH || process.arch;

// Map platform to Node.js distribution naming
const platformMap = {
  'darwin': 'darwin',
  'win32': 'win',
  'linux': 'linux'
};

// Map arch to Node.js distribution naming
const archMap = {
  'x64': 'x64',
  'arm64': 'arm64',
  'ia32': 'x86'
};

const distPlatform = platformMap[PLATFORM];
const distArch = archMap[ARCH];

if (!distPlatform || !distArch) {
  console.error(`Unsupported platform (${PLATFORM}) or architecture (${ARCH})`);
  process.exit(1);
}

const ext = PLATFORM === 'win32' ? 'zip' : 'tar.gz';
const filename = `node-${NODE_VERSION}-${distPlatform}-${distArch}.${ext}`;
const downloadUrl = `https://nodejs.org/dist/${NODE_VERSION}/${filename}`;

const outputDir = path.resolve(__dirname, '../resources/node_bin');
const outputPath = path.join(outputDir, filename);
const metaPath = path.join(outputDir, '.meta.json');

// Ensure output dir exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Check if node binary already exists to avoid re-downloading
const nodeBinName = PLATFORM === 'win32' ? 'node.exe' : 'node';
const finalNodePath = path.join(outputDir, nodeBinName);

let needDownload = true;
if (fs.existsSync(finalNodePath) && fs.existsSync(metaPath)) {
  try {
    const metaRaw = fs.readFileSync(metaPath, 'utf-8');
    const meta = JSON.parse(metaRaw);
    if (
      meta.version === NODE_VERSION &&
      meta.platform === distPlatform &&
      meta.arch === distArch
    ) {
      console.log(`Node.js binary already matches ${NODE_VERSION} (${distPlatform}/${distArch}). Skipping download.`);
      needDownload = false;
    }
  } catch (e) {
    console.warn(`Failed to read existing node meta, will re-download. ${e?.message || e}`);
  }
}

if (!needDownload && fs.existsSync(finalNodePath)) {
  process.exit(0);
}

// Cleanup old content if mismatch
if (fs.existsSync(outputDir) && needDownload) {
  try {
    fs.rmSync(outputDir, { recursive: true, force: true });
  } catch (e) {
    console.warn(`Failed to clean old node dir: ${e?.message || e}`);
  }
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Downloading Node.js from ${downloadUrl}...`);

const file = fs.createWriteStream(outputPath);

https.get(downloadUrl, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: HTTP Status Code ${response.statusCode}`);
    fs.unlink(outputPath, () => {});
    process.exit(1);
  }

  response.pipe(file);

  file.on('finish', () => {
    file.close(() => {
      console.log('Download completed. Extracting...');
      extract(outputPath, outputDir, filename);
    });
  });
}).on('error', (err) => {
  fs.unlink(outputPath, () => {});
  console.error(`Download error: ${err.message}`);
  process.exit(1);
});

function extract(filePath, targetDir, archiveName) {
  try {
    if (PLATFORM === 'win32') {
      execSync(`tar -xf "${filePath}" -C "${targetDir}"`);
    } else {
      execSync(`tar -xzf "${filePath}" -C "${targetDir}"`);
    }

    const extractedFolder = archiveName.replace(`.${ext}`, '');
    const src = PLATFORM === 'win32'
      ? path.join(targetDir, extractedFolder, 'node.exe')
      : path.join(targetDir, extractedFolder, 'bin', 'node');

    if (fs.existsSync(src)) {
      fs.renameSync(src, finalNodePath);
      if (PLATFORM !== 'win32') {
        fs.chmodSync(finalNodePath, 0o755);
      }
      console.log(`Node.js binary ready at: ${finalNodePath}`);
      fs.writeFileSync(
        metaPath,
        JSON.stringify(
          {
            version: NODE_VERSION,
            platform: distPlatform,
            arch: distArch,
            downloadedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      fs.unlinkSync(filePath);
      fs.rmSync(path.join(targetDir, extractedFolder), { recursive: true, force: true });
    } else {
      console.error(`Could not find node binary in extracted folder: ${src}`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`Extraction failed: ${error.message}`);
    process.exit(1);
  }
}
