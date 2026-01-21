const { version, name } = require("./package.json");
const dayjs = require("dayjs");
const { resolve } = require("node:path");
require("dotenv").config({
  path: ["./env/.env", "./env/.env.local"],
});

const buildEnv = process.env?.BUILD_ENV || "production"; // production, staging, development
const buildTarget = process.env?.BUILD_TARGET || process.env?.ENV_FILE || "unknown";
const dir = buildTarget + "/" + dayjs().format("YYYY_MM_DD_HH_mm_ss");
const versionArr = version.split("-");
const bundleShortVersion = versionArr[0];
const bundleVersion = versionArr[1] || versionArr[0];

const productName = process.env?._PRODUCT_NAME ?? name;

const getAppId = () => {
  const baseId = process.env?._APP_ID || `com.yourcompany.${name.replace(/[^a-z0-9]/gi, '')}`;
  if (buildEnv === "development") return `${baseId}.dev`;
  if (buildEnv === "staging") return `${baseId}.staging`;
  return baseId;
};

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration
 */
const config = {
  asar: true,
  productName: productName,
  appId: getAppId(),
  directories: {
    output: `./release/app/${buildTarget}/${buildEnv}`,
  },
  files: ["./release/dist", "package.json"],
  extraResources: [
    {
      from: "./public/assets/icons",
      to: "assets/icons",
    },
  ],
  afterPack: async (context) => {
    const fs = require('fs');
    const path = require('path');
    
    // Electron Builder Arch: 0=ia32, 1=x64, 3=arm64
    const archMap = {
      0: 'ia32',
      1: 'x64',
      3: 'arm64'
    };
    
    const archName = archMap[context.arch];
    if (!archName) {
       console.log(`[afterPack] Skipping unknown arch: ${context.arch}`);
       return;
    }
    
    const platform = context.electronPlatformName; // 'darwin', 'win32', 'linux'
    const binaryName = platform === 'win32' ? 'node.exe' : 'node';
    
    // Source: resources/node_bin/<arch>/node
    // Note: for ia32 we use 'ia32' folder, but download script uses 'ia32' too (mapped from x86 logic if I updated it correctly, let's check).
    // In download script: if (arch === 'ia32') distArch = 'x86'; folderArch = 'ia32'. Yes.
    
    const sourceNode = path.resolve(__dirname, `./resources/node_bin/${archName}/${binaryName}`);
    
    if (!fs.existsSync(sourceNode)) {
        console.warn(`[afterPack] Warning: Node binary not found at ${sourceNode}. Skipping copy.`);
        return;
    }

    // Destination
    let destNodeDir;
    if (platform === 'darwin') {
        destNodeDir = path.join(context.appOutDir, 'Contents/Resources/node_bin');
    } else {
        destNodeDir = path.join(context.appOutDir, 'resources/node_bin');
    }
    
    if (!fs.existsSync(destNodeDir)) {
        fs.mkdirSync(destNodeDir, { recursive: true });
    }
    
    const destNode = path.join(destNodeDir, binaryName);
    fs.copyFileSync(sourceNode, destNode);
    if (platform !== 'win32') {
        fs.chmodSync(destNode, 0o755);
    }
    console.log(`[afterPack] Copied ${archName} node binary to ${destNode}`);
  },
  icon: resolve(__dirname, `./public/assets/icons/icon.icns`),
  asarUnpack: "**\\*.{node,dll}",
  mac: {
    icon: resolve(__dirname, `./public/assets/icons/icon.icns`),
    bundleVersion: bundleVersion,
    bundleShortVersion: bundleShortVersion,
    artifactName: "${productName}-${version}-${env.BUILD_ENV}-${arch}.${ext}",
    hardenedRuntime: buildEnv === "production",
    gatekeeperAssess: buildEnv === "production",
    identity: process.env?._APPLE_IDENTITY,
    extendInfo: {
      ElectronTeamID: process.env?._APPLE_TEAM_ID,
      ITSAppUsesNonExemptEncryption: "NO",
    },
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"],
      },
      {
        target: "zip",
        arch: ["x64", "arm64"],
      },
    ],
  },
  // MAC Store
  mas: {
    hardenedRuntime: false,
    gatekeeperAssess: false,
    entitlements: "mas/entitlements.mas.plist",
    entitlementsInherit: "mas/entitlements.mas.inherit.plist",
    entitlementsLoginHelper: "mas/entitlements.mas.loginhelper.plist",
    provisioningProfile: "mas/provisioning.provisionprofile",
  },
  // MAC Store dev模式的包
  masDev: {
    hardenedRuntime: false,
    gatekeeperAssess: false,
    entitlements: "mas/entitlements.mas.plist",
    entitlementsInherit: "mas/entitlements.mas.inherit.plist",
    entitlementsLoginHelper: "mas/entitlements.mas.loginhelper.plist",
    provisioningProfile: "mas/provisioning.provisionprofile",
  },
  dmg: {
    sign: buildEnv === "production",
    icon: resolve(__dirname, `./public/assets/icons/icon.icns`),
    contents: [
      {
        x: 130,
        y: 220,
      },
      {
        x: 410,
        y: 220,
        type: "link",
        path: "/Applications",
      },
    ],
  },
  win: {
    icon: resolve(__dirname, `./public/assets/icons/icon.ico`),
    artifactName: "${productName}-${version}-${env.BUILD_ENV}-setup.${ext}",
    target: [
      { target: "nsis", arch: ["x64", "ia32"] },
      { target: "portable", arch: ["x64"] },
    ],
    verifyUpdateCodeSignature: false,
    requestedExecutionLevel: "asInvoker",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: productName,
  },
  linux: {
    artifactName: "${productName}-${version}-${env.BUILD_ENV}.${ext}",
    target: [
      { target: "AppImage", arch: ["x64", "arm64"] },
      { target: "deb", arch: ["x64", "arm64"] },
      { target: "rpm", arch: ["x64", "arm64"] },
    ],
    icon: resolve(__dirname, `./public/assets/icons`),
  },
};
module.exports = config;
