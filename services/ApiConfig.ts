// ApiConfig.ts - Configuration centrale pour les APIs
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Point d'entrée central pour la configuration des APIs
class ApiConfig {
  // Récupérer la clé API depuis Constants.expoConfig.extra
  private static readonly apiKey: string = Constants.expoConfig?.extra?.apiKey || '';
  
  // Points d'accès des APIs
  public static readonly API_ENDPOINTS = {
    // Google Cloud Speech API
    SPEECH_TO_TEXT: 'https://speech.googleapis.com/v1/speech:recognize',
    // Google Cloud Translation API
    TRANSLATION: 'https://translation.googleapis.com/language/translate/v2',
    // Google Cloud Vision API
    VISION_API: 'https://vision.googleapis.com/v1/images:annotate',
    // Google Maps APIs
    MAPS_DIRECTIONS: 'https://maps.googleapis.com/maps/api/directions/json',
    GEOCODING: 'https://maps.googleapis.com/maps/api/geocode/json',
    PLACES_NEARBY: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
    PLACES_AUTOCOMPLETE: 'https://maps.googleapis.com/maps/api/place/autocomplete/json',
    PLACES_DETAILS: 'https://maps.googleapis.com/maps/api/place/details/json',
  };

  // Langues supportées pour la reconnaissance vocale
  public static readonly SUPPORTED_LANGUAGES = {
    'en-US': 'English (US)',
    'fr-FR': 'Français',
    'es-ES': 'Español',
    'de-DE': 'Deutsch',
    'it-IT': 'Italiano',
    // ... autres langues
  };

  // Méthode d'initialisation que l'application appelle au démarrage
  public static initialize(): void {
    console.log('ApiConfig initialization started');
    
    // Vérifier la validité de la clé API
    if (!this.isApiKeyValid()) {
      console.warn('Clé API non définie ou invalide');
    } else {
      console.log('API key configuration valid');
    }
    
    // Test optionnel de connexion à l'API
    if (__DEV__) {
      this.testApiConnection()
        .then(isConnected => {
          if (isConnected) {
            console.log('API connection test successful');
          } else {
            console.warn('API connection test failed - check your internet connection or API key');
          }
        })
        .catch(error => {
          console.error('Error during API connection test:', error);
        });
    }
  }

  // Récupérer la clé API
  public static getApiKey(): string {
    if (!this.apiKey) {
      console.warn('Clé API non définie. Veuillez configurer votre clé dans .env');
      
      // En mode développement, on peut afficher plus d'informations pour aider au débogage
      if (__DEV__) {
        console.info('Veuillez vérifier:');
        console.info('1. Que votre fichier .env existe à la racine du projet');
        console.info('2. Que la variable GOOGLE_API_KEY est bien définie dans ce fichier');
        console.info('3. Que app.config.js récupère et passe correctement cette variable');
      }
    }
    return this.apiKey;
  }

  // Vérifier si la clé API est valide
  public static isApiKeyValid(): boolean {
    return this.apiKey.length > 0;
  }

  // Formater l'URL avec la clé API
  public static formatUrl(url: string): string {
    return `${url}?key=${this.getApiKey()}`;
  }

  // Générer les en-têtes d'authentification
  public static getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }
  
  // Vérifier si les API sont configurées correctement
  public static async testApiConnection(): Promise<boolean> {
    try {
      if (!this.isApiKeyValid()) {
        return false;
      }
      
      // Test simple d'une API qui ne consomme pas trop de quota
      const response = await fetch(
        `${this.API_ENDPOINTS.GEOCODING}?key=${this.getApiKey()}&address=Paris`
      );
      
      return response.status === 200;
    } catch (error) {
      console.error('Erreur lors du test de connexion API:', error);
      return false;
    }
  }
}

export default ApiConfig;