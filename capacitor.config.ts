import type { CapacitorConfig } from "@capacitor/cli"

const serverUrl = process.env.CAP_SERVER_URL?.trim()

const config: CapacitorConfig = {
  appId: process.env.CAP_APP_ID?.trim() || "com.besaif.lifttracker",
  appName: "Lift Tracker",
  webDir: "mobile-shell",
  backgroundColor: "#111827",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
          androidScheme: serverUrl.startsWith("http://") ? "http" : "https",
        },
      }
    : {}),
  ios: {
    contentInset: "always",
    backgroundColor: "#111827",
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: "mobile",
  },
  android: {
    backgroundColor: "#111827",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#111827",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#111827",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
}

export default config
