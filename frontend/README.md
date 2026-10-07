# Expense Tracker AI - React Native Mobile Application

This is the mobile frontend for **Expense Tracker AI**, built using React Native, TypeScript, Zustand, and Tailwind CSS. It features custom native Android modules in Kotlin for background SMS parsing and payment notification detection.

## Technology Stack
- **Framework**: React Native (TypeScript)
- **State Management**: Zustand + react-native-mmkv
- **Queries**: TanStack React Query + Axios
- **Styling**: Tailwind CSS (NativeWind)
- **Native Integration**: Kotlin Bridge Modules + WorkManager background tasks + NotificationListenerService

---

## Folder Structure
- `android/app/src/main/java/com/expenseai/nativemodules/`: Native Android Kotlin layer.
  - `SMSReceiver`: BroadcastReceiver that reads incoming transaction SMS.
  - `PaymentNotificationListener`: Capture payment alerts from GPay, Paytm, etc.
  - `SMSWorker`: CoroutineWorker executing background syncs.
  - `SMSWorkManager`: Enqueues workers with exp-backoff.
  - `ExpenseAIBridge`: Exposes controls to JavaScript (enable listeners, read logs, cache tokens).

---

## Installation & Launch

1. **Install JavaScript dependencies**:
   ```bash
   npm install
   ```

2. **Configure Tailwind Styling**:
   Verify configuration inside `tailwind.config.js` and styling bindings in `babel.config.js`.

3. **Android Build & Run**:
   Make sure you have an Android Emulator open or a physical device connected via ADB.
   ```bash
   npm run android
   ```

4. **Start Metro Bundler**:
   ```bash
   npm start
   ```

---

## Android Native Features & Permissions
The app leverages background services to track expenses with zero user effort:
1. **SMS Read Permission**: Required to import past transactions or intercept incoming billing messages.
2. **Notification Access Settings**: Users are guided to the Android system settings during onboarding to enable the `PaymentNotificationListener` service.
3. **WorkManager Sync**: Captured texts are enqueued to sync in the background even if the app is closed.
