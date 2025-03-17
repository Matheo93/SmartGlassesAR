// services/ApiConfig.ts
import Constants from 'expo-constants';

export default class ApiConfig {
  private static apiKey: string = '';

  // API endpoints (inchangés)
  static API_ENDPOINTS = {
    VISION: 'https://vision.googleapis.com/v1/images:annotate',
    TRANSLATION: 'https://translation.googleapis.com/v3/projects/YOUR_PROJECT_ID:translateText',
    SPEECH_TO_TEXT: 'https://speech.googleapis.com/v1/speech:recognize',
    MAPS_DIRECTIONS: 'https://maps.googleapis.com/maps/api/directions/json',
    PLACES_NEARBY: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
    GEOCODING: 'https://maps.googleapis.com/maps/api/geocode/json',
  };

  // Initialisation avec clé API
  static initialize() {
    const extra = Constants.expoConfig?.extra;
    if (extra && extra.googleApiKey) {
      this.apiKey = extra.googleApiKey;
    } else {
      console.warn('Google API Key not found in app config extras');
    }
  }

  static getApiKey(): string {
    return this.apiKey;
  }
}