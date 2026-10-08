import { registerRootComponent } from "expo";
import { AppRegistry, Platform } from "react-native";
import App from "./App";
import "./global.css";
import { smsTrackerService } from "./src/services/smsTrackerService";

if (Platform.OS === "android") {
  try {
    const { RNAndroidNotificationListenerHeadlessJsName } = require("react-native-android-notification-listener");

    const headlessNotificationListener = async ({ notification }) => {
      if (notification) {
        try {
          const parsed = typeof notification === "string" ? JSON.parse(notification) : notification;
          await smsTrackerService.processIncomingNotification(parsed);
        } catch (e) {
          console.warn("Headless notification parsing error:", e);
        }
      }
    };

    if (RNAndroidNotificationListenerHeadlessJsName) {
      AppRegistry.registerHeadlessTask(
        RNAndroidNotificationListenerHeadlessJsName,
        () => headlessNotificationListener
      );
    }
  } catch (err) {
    console.warn("Notification listener headless registration skipped:", err);
  }
}

registerRootComponent(App);
