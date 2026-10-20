import type { CapacitorConfig } from '@capacitor/cli';

// Before submitting to the stores, replace appId with an identifier you own
// (reverse-DNS of your domain). It CANNOT be changed after the first store release.
const config: CapacitorConfig = {
  appId: 'com.dewantech.donext',
  appName: 'DoNext',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    // Reminder notifications: white status-bar icon and chime from android/app/src/main/res
    // (made by `npm run android:assets`).
    LocalNotifications: {
      smallIcon: 'ic_stat_donext',
      iconColor: '#006FEF',
      sound: 'chime.wav',
    },
  },
};

export default config;
