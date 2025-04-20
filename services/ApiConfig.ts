// ApiConfig.ts - Configuration centrale pour les APIs
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Point d'entrée central pour la configuration des APIs
class ApiConfig {
  // Récupérer la clé API depuis Constants.expoConfig.extra
  private static apiKey: string = Constants.expoConfig?.extra?.apiKey || '';
  private static userId: string | null = null;
  
  // Storage keys
  private static readonly API_KEY_STORAGE_KEY = 'API_KEY';
  private static readonly USER_ID_STORAGE_KEY = 'USER_ID';
  
  // Points d'accès des APIs
  public static readonly API_ENDPOINTS = {
    // Google Cloud Speech API
    SPEECH_TO_TEXT: 'https://speech.googleapis.com/v1p1beta1/speech:recognize',
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
    
    // Custom API endpoints for our services (if needed)
    CUSTOM_SIGN_LANGUAGE: 'https://api.smartglasses.com/sign-language',
    CUSTOM_OBSTACLE_DETECTION: 'https://api.smartglasses.com/obstacle-detection'
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

  /**
   * Méthode d'initialisation que l'application appelle au démarrage
   */
  public static async initialize(): Promise<void> {
    console.log('ApiConfig initialization started');
    
    // Charger la clé API depuis le stockage local s'il y en a une
    await this.loadApiKey();
    await this.loadUserId();
    
    // Vérifier la validité de la clé API
    if (!this.isApiKeyValid()) {
      console.warn('Clé API non définie ou invalide');
    } else {
      console.log('API key configuration valid');
    }
    
    // Test optionnel de connexion à l'API
    if (__DEV__) {
      const isConnected = await this.testApiConnection();
      if (isConnected) {
        console.log('API connection test successful');
      } else {
        console.warn('API connection test failed - check your internet connection or API key');
      }
    }
  }

  /**
   * Set API key for Google Cloud services
   */
  public static async setApiKey(key: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.API_KEY_STORAGE_KEY, key);
      this.apiKey = key;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la clé API:', error);
    }
  }

  /**
   * Récupérer la clé API
   */
  public static getApiKey(): string {
    if (!this.apiKey) {
      console.warn('Clé API non définie. Veuillez configurer votre clé dans .env ou avec setApiKey()');
      
      // En mode développement, on peut afficher plus d'informations pour aider au débogage
      if (__DEV__) {
        console.info('Veuillez vérifier:');
        console.info('1. Que votre fichier .env existe à la racine du projet');
        console.info('2. Que la variable GOOGLE_API_KEY est bien définie dans ce fichier');
        console.info('3. Que app.config.js récupère et passe correctement cette variable');
      }
      
      // Si toujours pas de clé, utilisez une clé par défaut pour le développement
      return Constants.expoConfig?.extra?.apiKey || 'YOUR_API_KEY_HERE';
    }
    return this.apiKey;
  }

  /**
   * Load the API key from storage (call during app initialization)
   */
  public static async loadApiKey(): Promise<string | null> {
    try {
      const key = await AsyncStorage.getItem(this.API_KEY_STORAGE_KEY);
      if (key) {
        this.apiKey = key;
        return key;
      }
      
      // Si pas de clé en stockage, utiliser celle de Constants
      this.apiKey = Constants.expoConfig?.extra?.apiKey || '';
      return this.apiKey || null;
    } catch (error) {
      console.error('Erreur lors du chargement de la clé API:', error);
      return null;
    }
  }

  /**
   * Vérifier si la clé API est valide
   */
  public static isApiKeyValid(): boolean {
    return this.apiKey !== null && this.apiKey.length > 10;
  }

  /**
   * Formater l'URL avec la clé API
   */
  public static formatUrl(url: string): string {
    return `${url}?key=${this.getApiKey()}`;
  }

  /**
   * Set user ID for authentication
   */
  public static async setUserId(id: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.USER_ID_STORAGE_KEY, id);
      this.userId = id;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'ID utilisateur:', error);
    }
  }

  /**
   * Get the stored user ID
   */
  public static getUserId(): string | null {
    return this.userId;
  }

  /**
   * Load the user ID from storage (call during app initialization)
   */
  public static async loadUserId(): Promise<string | null> {
    try {
      const id = await AsyncStorage.getItem(this.USER_ID_STORAGE_KEY);
      if (id) {
        this.userId = id;
        return id;
      }
      return null;
    } catch (error) {
      console.error('Erreur lors du chargement de l\'ID utilisateur:', error);
      return null;
    }
  }

  /**
   * Générer les en-têtes d'authentification
   */
  public static getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (this.userId) {
      headers['X-User-Id'] = this.userId;
    }
    
    // Ajouter des en-têtes spécifiques à la plateforme
    headers['X-Platform'] = Platform.OS;
    headers['X-Platform-Version'] = Platform.Version.toString();
    
    return headers;
  }
  
  /**
   * Vérifier si les API sont configurées correctement
   */
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