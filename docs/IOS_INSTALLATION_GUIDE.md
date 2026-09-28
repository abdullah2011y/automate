# ByteForge — iOS Installation & IPA Packaging Guide

This guide provides the exact, production-verified procedure for building, signing, and installing the ByteForge iPhone application using the Capacitor iOS project generated in `apps/web/ios`.

---

## 1. Important Platform & Tooling Reality

> [!IMPORTANT]
> **Native iOS Build Constraint:**
> Compiling an Apple iOS application into an installable `.ipa` or running it on physical hardware requires **macOS with Xcode** and Apple signing toolchains.
> 
> On a Windows development machine, Capacitor prepares the complete Xcode workspace (`apps/web/ios/App/App.xcworkspace`), web asset bundles (`out/`), and configuration (`capacitor.config.json`).
> To generate the final signed `.ipa` file or deploy directly to an iPhone, you transfer or sync the workspace to a Mac (or run a GitHub Actions macOS runner).
> 
> **Do not attempt to fabricate an IPA on Windows without an authorized macOS toolchain.**

---

## 2. Project Identifier & Mobile Credentials

- **Application Name:** `ByteForge`
- **Bundle Identifier:** `com.byteforge.omnicommerce`
- **Capacitor Core Version:** `^6.2.2`
- **Target iOS Version:** iOS 13.0 or later (Tested on iOS 16, 17, 18)
- **Backend API Endpoint:** Centralized HTTPS endpoint (e.g. `https://byteforge-api.northflank.app` in production, or local tunnel during testing)
- **Security Guarantee:** Zero database credentials, Shopify tokens, or WhatsApp session keys are included in the mobile client. All interactions flow through authenticated JWT REST and SSE endpoints.

---

## 3. Preparation on Development Machine (Windows / Mac)

Before opening the iOS project in Xcode, ensure the web app is built and synced to the iOS directory:

```bash
# 1. Build the production static bundle for Capacitor
npm --prefix apps/web run build:cap

# 2. Sync the assets and plugins into the iOS native directory
npm run cap:sync
```

This updates `apps/web/ios/App/App/public` with the latest frontend pages, icons, styles, and logic.

---

## 4. Building with Xcode on macOS

### Step 4.1: Open the Project in Xcode
Transfer the project to your Mac or clone your repository. In Terminal on macOS:
```bash
cd apps/web
npx cap open ios
```
*Alternatively, double-click `apps/web/ios/App/App.xcworkspace` in macOS Finder.*

### Step 4.2: Configure Code Signing & Bundle ID
1. In the Xcode left navigator, select the top-level **App** project.
2. In the center pane, select the **App** target.
3. Select the **Signing & Capabilities** tab.
4. Ensure **Automatically manage signing** is checked.
5. In the **Team** dropdown, select your Apple Developer account or personal Apple ID (free 7-day personal certificate).
6. Verify the **Bundle Identifier** is set to:
   ```
   com.byteforge.omnicommerce
   ```
   *(If using a free personal Apple ID and the bundle ID is taken, you may append a suffix, e.g., `com.byteforge.omnicommerce.store`).*

### Step 4.3: Direct USB Installation to Physical iPhone (Fastest & Recommended)
1. Connect your iPhone to your Mac with a USB-C or Lightning cable.
2. On your iPhone, tap **Trust This Computer** and enter your passcode.
3. On your iPhone, enable Developer Mode:
   - Go to **Settings** > **Privacy & Security** > **Developer Mode** (toggle ON, then restart device).
4. In Xcode, in the top toolbar device selector, choose your connected iPhone.
5. Click the **Run** button (or press `Cmd + R`).
6. Xcode will compile, install, and launch ByteForge directly on your iPhone.
7. On first launch, go to iPhone **Settings** > **General** > **VPN & Device Management** > tap your Apple ID and select **Trust**.

---

## 5. Generating a Signed `.ipa` File for Sideloading

If you wish to distribute or archive an installable `.ipa` file:

### Step 5.1: Archive in Xcode
1. In Xcode, select **Any iOS Device (arm64)** from the device destination menu.
2. Go to **Product** > **Archive**.
3. Wait for Xcode to finish compiling the native binary. The **Organizer** window will open automatically.

### Step 5.2: Export IPA
1. In Organizer, select the latest archive and click **Distribute App**.
2. Select your distribution method:
   - **Development** (for personal device testing via Sideloadly / AltStore).
   - **Ad Hoc** (for registered test devices).
   - **App Store Connect / TestFlight** (for official beta testing).
3. Follow the prompts for signing, and click **Export**.
4. Xcode will generate a folder containing `ByteForge.ipa`.

---

## 6. Sideloading Options for Windows Users

If you received or exported `ByteForge.ipa` and want to install it from a Windows PC:

### Option A: Sideloadly (Windows / macOS)
1. Download and install [Sideloadly](https://sideloadly.io/) on your PC.
2. Install iTunes and iCloud for Windows (standard versions, not Microsoft Store versions).
3. Connect your iPhone via USB.
4. Drag and drop `ByteForge.ipa` into Sideloadly.
5. Enter your Apple ID (used strictly for Apple's signing server to sign the app for your personal device).
6. Click **Start**.
7. Once installed, trust your profile in iPhone **Settings** > **General** > **VPN & Device Management**.

> [!NOTE]
> Free Apple IDs require refreshing the sideloaded app every 7 days. Paid Apple Developer accounts ($99/yr) sign apps for 365 days.

### Option B: AltStore (Windows / macOS)
1. Install [AltServer](https://altstore.io/) on your computer.
2. Install the AltStore app onto your iPhone via AltServer.
3. Open AltStore on your iPhone, tap **My Apps** > **+** (plus icon), and choose `ByteForge.ipa`.
4. AltStore will sign and install the app over local Wi-Fi.

### Option C: Apple TestFlight (Most Professional)
1. Upload the archive from Xcode to **App Store Connect**.
2. Add your Apple ID email under **Internal Testing**.
3. Install the **TestFlight** app from the iOS App Store.
4. Accept the invitation email and tap **Install**.
5. TestFlight builds remain active for 90 days with zero tethering or weekly refresh requirements.

---

## 7. Verifying Mobile App Communication with Backend

Once ByteForge is running on your iPhone:
1. Ensure your iPhone has an active internet connection (Wi-Fi or Cellular).
2. The app will communicate with your deployed backend (`https://byteforge-api.northflank.app`).
3. Log in with your single-owner administrator credentials (`admin@byteforge.io`).
4. You will see:
   - Live metrics & velocity cards.
   - Orders list formatted as responsive mobile cards.
   - WhatsApp pairing status and QR stream.
   - Message template editor with touch support.
   - System settings and automated backup health.
