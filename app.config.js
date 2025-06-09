import "dotenv/config"

console.log("🔥 FIREBASE_API_KEY:", process.env.EXPO_PUBLIC_FIREBASE_API_KEY)

export default {
  expo: {
    name: "Keydozer",
    slug: "keydozer",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    userInterfaceStyle: "automatic",
    scheme: "myapp",
    android: {
      package: "com.jeejdev.keydozer",
      icon: "./assets/images/logo.png",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      permissions: ["android.permission.CAMERA", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    },
    ios: {
      supportsTablet: true,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-sqlite",
        {
          enableFTS: true,
          useSQLCipher: true,
          android: {
            enableFTS: false,
            useSQLCipher: false,
          },
          ios: {
            customBuildFlags: ["-DSQLITE_ENABLE_DBSTAT_VTAB=1", "-DSQLITE_ENABLE_SNAPSHOT=1"],
          },
        },
      ],
      "expo-secure-store",
      "expo-barcode-scanner",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      encryptionKey: process.env.EXPO_PUBLIC_ENCRYPTION_KEY,
      developmentMode: process.env.EXPO_PUBLIC_DEVELOPMENT_MODE,
      eas: {
        projectId: "41439817-4eff-4079-9c22-26bd88c71005",
      },
      router: {
        origin: false,
      },
    },
  },
}
