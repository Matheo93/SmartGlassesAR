import { config } from 'dotenv';

// Charger les variables d'environnement depuis .env
config();

export default {
  expo: {
    name: "SmartGlasses",
    slug: "smart-glasses",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yourcompany.smartglasses"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.yourcompany.smartglasses"
    },
    web: {
      favicon: "./assets/images/favicon.png"
    },
    extra: {
      // Passer la clé API à l'application
      apiKey: process.env.GOOGLE_API_KEY,
      eas: {
        projectId: "your-eas-project-id"
      }
    },
    plugins: [
      // Ajoutez les plugins nécessaires ici
    ]
  }
};