// services/AuthService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Solution alternative à @env pour stocker la clé API
const CLOUD_API_KEY = process.env.GOOGLE_API_KEY || '';

export class AuthService {
  private static API_KEY_STORAGE_KEY = 'smart_glasses_api_key';
  private static isInitialized = false;

  static async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Vérifie si une clé API existe déjà
      const storedKey = await AsyncStorage.getItem(this.API_KEY_STORAGE_KEY);
      
      if (!storedKey) {
        // Utilise la clé de l'environnement si aucune n'est stockée
        await AsyncStorage.setItem(this.API_KEY_STORAGE_KEY, CLOUD_API_KEY);
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing AuthService:', error);
    }
  }

  static async getApiKey(): Promise<string> {
    if (!this.isInitialized) await this.initialize();
    
    const key = await AsyncStorage.getItem(this.API_KEY_STORAGE_KEY);
    if (!key) throw new Error('API key not found');
    
    return key;
  }
  
  static async setApiKey(apiKey: string): Promise<void> {
    await AsyncStorage.setItem(this.API_KEY_STORAGE_KEY, apiKey);
    this.isInitialized = true;
  }
}