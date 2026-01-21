const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const NODE_VERSION = process.env.BUILD_NODE_VERSION || 'v20.11.0';
let PLATFORM = process.env.BUILD_PLATFORM || process.platform;
let ARCH = process.env.BUILD_ARCH || process.arch;

// Handle composite platform strings like 'darwin-x64'
if (PLATFORM.includes('-')) {
  const parts = PLATFORM.split('-');
  PLATFORM = parts[0];
  if (parts[1]) ARCH = parts[1];
}

const platformMap = {
  'darwin': 'darwin',
  'win32': 'win',
  'linux': 'linux'
};

const archMap = {
  'x64': 'x64',
  'arm64': 'arm64',
  'ia32': 'x86'
};

const distPlatform = platformMap[PLATFORM];

if (!distPlatform) {
  console.error(`Unsupported platform (${PLATFORM})`);
  process.exit(1);
}

// Determine target architectures
let targets = [];
if (PLATFORM === 'darwin') {
  // Always download both for macOS to support universal builds
  targets = ['x64', 'arm64'];
} else {
  const distArch = archMap[ARCH];
  if (!distArch) {
    console.error(`Unsupported architecture (${ARCH})`);
    process.exit(1);
  }
  targets = [distArch];
}

const baseOutputDir = path.resolve(__dirname, '../resources/node_bin');

// Ensure base output dir exists
if (!fs.existsSync(baseOutputDir)) {
  fs.mkdirSync(baseOutputDir, { recursive: true });
}

(async () => {
  for (const arch of targets) {
    // Map 'ia32' to 'x86' for download, but use 'x64'/'arm64' for folder names
    let distArch = arch;
    if (arch === 'ia32') distArch = 'x86'; // Node.js uses 'x86' for ia32
    else if (arch === 'x64') distArch = 'x64';
    else if (arch === 'arm64') distArch = 'arm64';
    
    // For folder name, use the standard names (x64, arm64)
    const folderArch = arch === 'x86' ? 'ia32' : arch;
    
    await downloadForArch(distPlatform, distArch, folderArch);
  }
})();

async function downloadForArch(platform, arch, folderArch) {
  const ext = PLATFORM === 'win32' ? 'zip' : 'tar.gz';
  const filename = `node-${NODE_VERSION}-${platform}-${arch}.${ext}`;
  const downloadUrl = `https://nodejs.org/dist/${NODE_VERSION}/${filename}`;
  
  const outputDir = path.join(baseOutputDir, folderArch);
  const outputPath = path.join(outputDir, filename);
  const metaPath = path.join(outputDir, '.meta.json');
  
  // Ensure output dir exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const nodeBinName = PLATFORM === 'win32' ? 'node.exe' : 'node';
  const finalNodePath = path.join(outputDir, nodeBinName);

  let needDownload = true;
  if (fs.existsSync(finalNodePath) && fs.existsSync(metaPath)) {
    try {
      const metaRaw = fs.readFileSync(metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw);
      if (
        meta.version === NODE_VERSION &&
        meta.platform === platform &&
        meta.arch === arch
      ) {
        console.log(`Node.js binary already matches ${NODE_VERSION} (${platform}/${arch}). Skipping download.`);
        needDownload = false;
      }
    } catch (e) {
      console.warn(`Failed to read existing node meta for ${arch}, will re-download. ${e?.message || e}`);
    }
  }

  if (!needDownload) return;

  // Cleanup
  try {
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      if (file !== '.meta.json' && file !== nodeBinName) { // Be aggressive but careful
         // Actually better to just clean everything
      }
    }
    // Simple clean: remove dir and recreate
    // But we are in the dir? No.
    // fs.rmSync(outputDir, { recursive: true, force: true });
    // fs.mkdirSync(outputDir, { recursive: true });
    // But we want to preserve if partial? No.
  } catch (e) {
    console.warn(`Failed to clean old node dir: ${e?.message || e}`);
  }

  console.log(`Downloading Node.js from ${downloadUrl}...`);

  return new Promise((resolve, reject) => {
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
          console.log(`Download completed for ${arch}. Extracting...`);
          extract(outputPath, outputDir, filename, platform, ext, finalNodePath, metaPath, arch);
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      console.error(`Download error: ${err.message}`);
      process.exit(1);
    });
  });
}

function extract(filePath, targetDir, archiveName, platform, ext, finalNodePath, metaPath, arch) {
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
      if (fs.existsSync(finalNodePath)) fs.unlinkSync(finalNodePath);
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
            platform: platform,
            arch: arch,
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
