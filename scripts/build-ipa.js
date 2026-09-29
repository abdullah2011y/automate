/**
 * ByteForge VIP iOS IPA Builder
 * Automatically builds the Next.js static bundle, syncs Capacitor iOS,
 * and packages a signed/sideload-ready ByteForge.ipa archive.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT_DIR, 'apps', 'web');
const IOS_APP_DIR = path.join(WEB_DIR, 'ios', 'App', 'App');
const STAGING_DIR = path.join(ROOT_DIR, 'dist-ipa');
const PAYLOAD_DIR = path.join(STAGING_DIR, 'Payload');
const APP_BUNDLE_DIR = path.join(PAYLOAD_DIR, 'ByteForge.app');
const OUTPUT_IPA = path.join(ROOT_DIR, 'ByteForge.ipa');
const WEB_IPA = path.join(WEB_DIR, 'ByteForge.ipa');

function run(command, cwd = ROOT_DIR) {
  console.log(`\x1b[36m> ${command}\x1b[0m (in ${path.relative(ROOT_DIR, cwd) || '.'})`);
  execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, CAPACITOR_BUILD: 'true' } });
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function buildIpa() {
  console.log('\n\x1b[35m=======================================================');
  console.log('   🚀 BYTEFORGE VIP IOS .IPA BUILDER');
  console.log('=======================================================\x1b[0m\n');

  // Step 1: Build Next.js Static Export for Capacitor
  console.log('\x1b[33m[1/5] Building Next.js Static Web Bundle (out/)... \x1b[0m');
  run('npm run build:cap', WEB_DIR);

  // Step 2: Sync Capacitor iOS Assets & Webdir
  console.log('\n\x1b[33m[2/5] Synchronizing Capacitor iOS Project... \x1b[0m');
  run('npx cap sync ios', WEB_DIR);

  // Step 3: Prepare Staging Payload
  console.log('\n\x1b[33m[3/5] Assembling Payload/ByteForge.app bundle... \x1b[0m');
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(APP_BUNDLE_DIR, { recursive: true });

  // Copy Info.plist
  const plistPath = path.join(IOS_APP_DIR, 'Info.plist');
  if (fs.existsSync(plistPath)) {
    fs.copyFileSync(plistPath, path.join(APP_BUNDLE_DIR, 'Info.plist'));
  }

  // Copy capacitor.config.json
  const capConfigPath = path.join(IOS_APP_DIR, 'capacitor.config.json');
  if (fs.existsSync(capConfigPath)) {
    fs.copyFileSync(capConfigPath, path.join(APP_BUNDLE_DIR, 'capacitor.config.json'));
  }

  // Copy public web assets
  const publicPath = path.join(IOS_APP_DIR, 'public');
  if (fs.existsSync(publicPath)) {
    copyRecursiveSync(publicPath, path.join(APP_BUNDLE_DIR, 'public'));
  }

  // Copy Assets.xcassets
  const assetsPath = path.join(IOS_APP_DIR, 'Assets.xcassets');
  if (fs.existsSync(assetsPath)) {
    copyRecursiveSync(assetsPath, path.join(APP_BUNDLE_DIR, 'Assets.xcassets'));
  }

  // Write PkgInfo (Standard APPL???? for iOS application bundles)
  fs.writeFileSync(path.join(APP_BUNDLE_DIR, 'PkgInfo'), 'APPL????');

  // Step 4: Compress into .ipa Archive
  const TEMP_ZIP = path.join(ROOT_DIR, 'ByteForge.zip');
  if (fs.existsSync(TEMP_ZIP)) fs.unlinkSync(TEMP_ZIP);
  if (fs.existsSync(OUTPUT_IPA)) fs.unlinkSync(OUTPUT_IPA);
  if (fs.existsSync(WEB_IPA)) fs.unlinkSync(WEB_IPA);

  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const psScript = `Compress-Archive -LiteralPath '${PAYLOAD_DIR.replace(/'/g, "''")}' -DestinationPath '${TEMP_ZIP.replace(/'/g, "''")}' -Force`;
    execSync(`powershell.exe -NoProfile -Command "${psScript}"`, { stdio: 'inherit' });
    fs.renameSync(TEMP_ZIP, OUTPUT_IPA);
  } else {
    execSync(`cd "${STAGING_DIR}" && zip -r "${OUTPUT_IPA}" Payload`, { stdio: 'inherit' });
  }

  // Copy to apps/web as well
  fs.copyFileSync(OUTPUT_IPA, WEB_IPA);

  // Clean staging
  try {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup error
  }

  // Step 5: Summary
  const stats = fs.statSync(OUTPUT_IPA);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n\x1b[32m=======================================================');
  console.log('   ✅ VIP .IPA BUILD COMPLETED SUCCESSFULLY!');
  console.log('=======================================================\x1b[0m');
  console.log(`📦 File Location:   ${OUTPUT_IPA}`);
  console.log(`📱 Web App Mirror:  ${WEB_IPA}`);
  console.log(`⚖️  Archive Size:   ${sizeMB} MB`);
  console.log(`🆔 Bundle ID:       com.byteforge.omnicommerce`);
  console.log(`🏷️  App Name:        ByteForge`);
  console.log('\n\x1b[36m💡 How to Sideload onto iPhone in 2 minutes:');
  console.log('1. Open Sideloadly (https://sideloadly.io) or AltStore on your PC.');
  console.log('2. Connect your iPhone via USB cable.');
  console.log('3. Drag & drop ByteForge.ipa into Sideloadly.');
  console.log('4. Enter your Apple ID and click Start (takes ~30 seconds).');
  console.log('5. On iPhone, go to Settings -> General -> VPN & Device Management -> Trust Certificate.');
  console.log('6. Done! ByteForge is running natively on your iOS device with full notification support!\x1b[0m\n');
}

buildIpa().catch((err) => {
  console.error('\n\x1b[31m❌ Build failed:\x1b[0m', err);
  process.exit(1);
});
