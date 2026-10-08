const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to:
 * 1. Resolve manifest merger conflict (allowBackup) between Expo and react-native-android-notification-listener
 * 2. Inject Android NotificationListenerService into AndroidManifest.xml
 */
const withNotificationListener = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Ensure application array exists
    if (!androidManifest.application || !androidManifest.application[0]) {
      return config;
    }

    const mainApplication = androidManifest.application[0];

    // 1. Add tools namespace to root manifest
    androidManifest.$ = androidManifest.$ || {};
    androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // 2. Fix Manifest merger conflict for allowBackup
    mainApplication.$ = mainApplication.$ || {};
    const existingReplace = mainApplication.$['tools:replace'];
    if (existingReplace) {
      if (!existingReplace.includes('android:allowBackup')) {
        mainApplication.$['tools:replace'] = `${existingReplace},android:allowBackup`;
      }
    } else {
      mainApplication.$['tools:replace'] = 'android:allowBackup';
    }

    // 3. Inject NotificationListenerService
    mainApplication.service = mainApplication.service || [];
    const serviceName =
      'com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener';

    const serviceExists = mainApplication.service.some(
      (s) => s.$ && s.$['android:name'] === serviceName
    );

    if (!serviceExists) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};

module.exports = withNotificationListener;
