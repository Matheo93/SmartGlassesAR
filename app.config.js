// app.config.js (à la racine du projet)
export default {
    name: "Smart Glasses",
    slug: "smart-glasses",
    version: "1.0.0",
    // Autres propriétés existantes de votre app.json
    extra: {
      googleApiKey: process.env.GOOGLE_API_KEY || "default_key_for_development"
    }
  };