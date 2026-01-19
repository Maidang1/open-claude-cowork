const {version, name} = require('./package.json')
const dayjs = require("dayjs");
const {resolve} = require("node:path")
require('dotenv').config({
    path: ["./env/.env", "./env/.env.local"]
})

const dir = process.env?.ENV_FILE + "/" + dayjs().format("YYYY_MM_DD_HH_mm_ss");
const versionArr = version.split('-')
const bundleShortVersion = versionArr[0]
const bundleVersion = versionArr[1]

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration
 */
const config = {
    asar: true,
    productName: process.env?._PRODUCT_NAME ?? name,
    appId: process.env?._APP_ID,
    directories: {
        output: `./release/app/${dir}`,
    },
    extraResources: [
        {
            from: "./public/assets/icons",
            to: "assets/icons"
        }
    ],
    icon: resolve(
        __dirname,
        `./public/assets/icons/icon.icns`,
    ),
    asarUnpack: "**\\*.{node,dll}",
    files: [
        "./release/dist",
        "package.json"
    ],
    mac: {
        target: ["dmg", "zip"],
        icon: resolve(
            __dirname,
            `./public/assets/icons/icon.icns`,
        ),
        bundleVersion: bundleVersion,
        bundleShortVersion: bundleShortVersion,
        artifactName: '${productName}-${version}-${arch}.${ext}',
        identity: process.env?._APPLE_IDENTITY,
        extendInfo: {
            ElectronTeamID: process.env?._APPLE_TEAM_ID,
            ITSAppUsesNonExemptEncryption: 'NO'
        }
    },
    // MAC Store
    mas: {
        hardenedRuntime: false,
        gatekeeperAssess: false,
        entitlements: 'mas/entitlements.mas.plist',
        entitlementsInherit: 'mas/entitlements.mas.inherit.plist',
        entitlementsLoginHelper: 'mas/entitlements.mas.loginhelper.plist',
        provisioningProfile: 'mas/provisioning.provisionprofile',
    },
    // MAC Store dev模式的包
    masDev: {
        hardenedRuntime: false,
        gatekeeperAssess: false,
        entitlements: 'mas/entitlements.mas.plist',
        entitlementsInherit: 'mas/entitlements.mas.inherit.plist',
        entitlementsLoginHelper: 'mas/entitlements.mas.loginhelper.plist',
        provisioningProfile: 'mas/provisioning.provisionprofile',
    },
    dmg: {
        sign: false,
        icon: resolve(
            __dirname,
            `./public/assets/icons/icon.icns`,
        ),
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
        icon: resolve(
            __dirname,
            `./public/assets/icons/icon.ico`,
        ),
        target: ["nsis"],
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
        target: ["AppImage", "deb"],
        icon: resolve(
            __dirname,
            `./public/assets/icons/icon.icns`,
        ),
    },
}
module.exports = config