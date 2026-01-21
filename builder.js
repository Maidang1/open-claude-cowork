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
    {
      from: "./resources/node_bin",
      to: "node_bin",
    },
  ],
  icon: resolve(__dirname, `./public/assets/icons/icon.icns`),
  asarUnpack: "**\\*.{node,dll}",
  mac: {
    icon: resolve(__dirname, `./public/assets/icons/icon.icns`),
    bundleVersion: bundleVersion,
    bundleShortVersion: bundleShortVersion,
    artifactName: "${productName}-${version}-${env.BUILD_ENV}-universal.${ext}",
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
        arch: ["universal"],
      },
      {
        target: "zip",
        arch: ["universal"],
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
    icon: resolve(__dirname, `./public/assets/icons/icon.icns`),
  },
};
module.exports = config;
