import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'edition.mobile.app',
  appName: 'edition-mobile-app',
  webDir: 'www',
  server: {
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    Http: {
      allowCleartext: true,
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidDatabaseLocation: 'default',
      androidIsEncryption: false,
      web: {
        enabled: true
      }
    }
  }
};

export default config;
