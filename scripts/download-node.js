const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const NODE_VERSION = 'v20.11.0'; // LTS Version matching development env recommended
const PLATFORM = process.platform; // 'darwin', 'win32', 'linux'
const ARCH = process.arch; // 'x64', 'arm64'

// Map platform to Node.js distribution naming
const platformMap = {
  'darwin': 'darwin',
  'win32': 'win',
  'linux': 'linux'
};

// Map arch to Node.js distribution naming
const archMap = {
  'x64': 'x64',
  'arm64': 'arm64'
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

// Ensure output dir exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Check if node binary already exists to avoid re-downloading
const nodeBinName = PLATFORM === 'win32' ? 'node.exe' : 'node';
const finalNodePath = path.join(outputDir, nodeBinName);

if (fs.existsSync(finalNodePath)) {
  console.log(`Node.js binary already exists at ${finalNodePath}. Skipping download.`);
  process.exit(0);
}

console.log(`Downloading Node.js from ${downloadUrl}...`);

const file = fs.createWriteStream(outputPath);

https.get(downloadUrl, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download: HTTP Status Code ${response.statusCode}`);
    fs.unlink(outputPath, () => {}); // Delete partial file
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
      // Windows extraction (requires PowerShell or similar, here assuming tar/unzip availability or use a library like adm-zip if added to devDeps)
      // For simplicity in this script without deps, we try using tar (available in modern Win10+)
      execSync(`tar -xf "${filePath}" -C "${targetDir}"`);
    } else {
      execSync(`tar -xzf "${filePath}" -C "${targetDir}"`);
    }

    // Move binary to root of node_bin and cleanup
    const extractedFolder = archiveName.replace(`.${ext}`, '');
    const binSource = path.join(targetDir, extractedFolder, 'bin', 'node');
    // On Windows structure is slightly different (node.exe is in root of extracted folder usually)
    const binSourceWin = path.join(targetDir, extractedFolder, 'node.exe');

    const src = PLATFORM === 'win32' ? binSourceWin : binSource;
    
    if (fs.existsSync(src)) {
        fs.renameSync(src, finalNodePath);
        // Set executable permission
        if (PLATFORM !== 'win32') {
            fs.chmodSync(finalNodePath, 0o755);
        }
        console.log(`Node.js binary ready at: ${finalNodePath}`);
        
        // Cleanup archive and extracted folder
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
