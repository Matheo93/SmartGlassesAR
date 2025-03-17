// services/ApiConfig.ts
export default class ApiConfig {
    private static apiKey: string = '';
  
    // API endpoints
    static API_ENDPOINTS = {
      VISION: 'https://vision.googleapis.com/v1/images:annotate',
      TRANSLATION: 'https://translation.googleapis.com/v3/projects/YOUR_PROJECT_ID:translateText',
      SPEECH_TO_TEXT: 'https://speech.googleapis.com/v1/speech:recognize',
      MAPS_DIRECTIONS: 'https://maps.googleapis.com/maps/api/directions/json',
      PLACES_NEARBY: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      GEOCODING: 'https://maps.googleapis.com/maps/api/geocode/json',
    };
  
    // Initialize with API key
    static initialize(apiKey: string) {
      this.apiKey = apiKey;
    }
  
    static getApiKey(): string {
      return this.apiKey;
    }
  }