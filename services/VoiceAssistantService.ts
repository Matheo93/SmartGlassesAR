// VoiceAssistantService.ts - Service de reconnaissance vocale et de traduction
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import ApiConfig from './ApiConfig';

// Types pour les résultats de reconnaissance vocale
export type SpeechRecognitionResult = {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  detectedLanguage?: string;
};

// Type pour les commandes vocales
export type VoiceCommand = {
  command: string;
  action: () => void;
  aliases?: string[];
};

// Options d'environnement audio
export type AudioEnvironment = 'quiet' | 'noisy' | 'outdoor' | 'indoor';

/**
 * Service de reconnaissance vocale et traduction
 * Implémente la reconnaissance vocale via Cloud Speech-to-Text
 * et la traduction via Cloud Translation API
 */
export class VoiceAssistantService {
  private static recording: Audio.Recording | null = null;
  private static audioContext: AudioContext | null = null;
  private static noiseReductionLevel: number = 50; // 0-100
  private static speechEnhancementLevel: number = 70; // 0-100
  private static lastDetectedLanguage: string | null = null;
  
  // Initialiser le traitement audio
  static async initializeAudioProcessing(): Promise<boolean> {
    try {
      if (typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Échec d\'initialisation du traitement audio:', error);
      return false;
    }
  }
  
  // Demander les permissions d'enregistrement audio
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Erreur lors de la demande de permissions audio:', error);
      return false;
    }
  }
  
  // Configurer l'audio pour l'environnement optimal
  static async configureAudioForEnvironment(environment: AudioEnvironment): Promise<void> {
    try {
      let audioMode: any = {
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false
      };
      
      // Ajuster la réduction de bruit et l'amélioration de la parole en fonction de l'environnement
      switch (environment) {
        case 'noisy':
          this.noiseReductionLevel = 90;
          this.speechEnhancementLevel = 85;
          // Pour iOS, nous pouvons définir le mode d'entrée sur chat vocal pour une meilleure annulation du bruit
          if (Platform.OS === 'ios') {
            audioMode = {
              ...audioMode,
              interruptionModeIOS: 1,
              playsInSilentModeIOS: true
            };
          }
          break;
        case 'outdoor':
          this.noiseReductionLevel = 80;
          this.speechEnhancementLevel = 70;
          break;
        case 'indoor':
          this.noiseReductionLevel = 60;
          this.speechEnhancementLevel = 75;
          break;
        case 'quiet':
        default:
          this.noiseReductionLevel = 40;
          this.speechEnhancementLevel = 60;
          break;
      }
      
      await Audio.setAudioModeAsync(audioMode);
    } catch (error) {
      console.error('Erreur lors de la configuration audio:', error);
    }
  }
  
  // Commencer l'enregistrement
  static async startRecording(): Promise<void> {
    try {
      // Vérifier les permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Permissions d\'enregistrement audio non accordées');
      }
      
      // Configurer le mode audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      
      // Commencer l'enregistrement avec des paramètres optimisés pour la parole
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      this.recording = recording;
    } catch (error) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', error);
      throw error;
    }
  }
  
  // Arrêter l'enregistrement
  static async stopRecording(): Promise<string> {
    try {
      if (!this.recording) {
        throw new Error('Pas d\'enregistrement actif');
      }
      
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      
      if (!uri) {
        throw new Error('URI d\'enregistrement non disponible');
      }
      
      return uri;
    } catch (error) {
      console.error('Erreur lors de l\'arrêt de l\'enregistrement:', error);
      throw error;
    }
  }
  
  // Convertir un fichier audio en base64
  static async audioFileToBase64(fileUri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      return base64;
    } catch (error) {
      console.error('Erreur lors de la conversion audio en base64:', error);
      throw error;
    }
  }
  
  // Convertir un fichier audio en ArrayBuffer pour le traitement
  static async audioFileToArrayBuffer(fileUri: string): Promise<ArrayBuffer> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error(`Le fichier n'existe pas: ${fileUri}`);
      }
      
      const fileContents = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const binaryString = atob(fileContents);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes.buffer;
    } catch (error) {
      console.error('Erreur lors de la conversion audio en ArrayBuffer:', error);
      throw error;
    }
  }
  
  // Reconnaissance vocale avec Google Cloud Speech-to-Text avec détection automatique de la langue
  static async recognizeSpeech(
    audioBase64: string,
    preferredLanguageCodes?: string[]
  ): Promise<SpeechRecognitionResult | null> {
    try {
      // Préparer le corps de la requête
      const body = JSON.stringify({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 44100,
          languageCode: this.lastDetectedLanguage || 'en-US', // Langue par défaut ou dernière langue détectée
          alternativeLanguageCodes: preferredLanguageCodes || ['fr-FR', 'es-ES', 'de-DE'], // Langues à détecter
          model: 'default',
          enableAutomaticPunctuation: true,
          enableSpokenPunctuation: true,
          enableSpokenEmojis: true,
          speechContexts: [
            {
              phrases: ['fauteuil roulant', 'navigation', 'obstacle', 'traduire', 'aide'], // Phrases courantes
              boost: 10 // Boost pour la reconnaissance de ces phrases
            }
          ],
          profanityFilter: false,
          enableWordTimeOffsets: false
        },
        audio: {
          content: audioBase64,
        },
      });
      
      // Appeler l'API Google Cloud Speech-to-Text
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.SPEECH_TO_TEXT}?key=${ApiConfig.getApiKey()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        }
      );
      
      const data = await response.json();
      
      if (
        !data.results ||
        !data.results[0] ||
        !data.results[0].alternatives ||
        !data.results[0].alternatives[0]
      ) {
        return null;
      }
      
      const result = data.results[0].alternatives[0];
      
      // Obtenir la langue détectée si disponible
      let detectedLanguage: string | undefined;
      if (data.results[0].languageCode) {
        detectedLanguage = data.results[0].languageCode as string;
        this.lastDetectedLanguage = detectedLanguage; // Stocker la dernière langue détectée
      }
      
      return {
        transcript: result.transcript,
        confidence: result.confidence || 0.5,
        isFinal: true,
        detectedLanguage
      };
    } catch (error) {
      console.error('Erreur lors de la reconnaissance vocale:', error);
      return null;
    }
  }
  
  // Enregistrer et reconnaître la parole en une seule fonction
  static async recordAndRecognize(
    recordDuration: number = 5000, // Durée d'enregistrement en ms
    preferredLanguageCodes?: string[]
  ): Promise<SpeechRecognitionResult | null> {
    try {
      // Démarrer l'enregistrement
      await this.startRecording();
      
      // Enregistrer pendant quelques secondes
      await new Promise((resolve) => setTimeout(resolve, recordDuration));
      
      // Arrêter l'enregistrement et obtenir le fichier audio
      const audioUri = await this.stopRecording();
      
      // Convertir l'audio en base64
      const audioBase64 = await this.audioFileToBase64(audioUri);
      
      // Reconnaître la parole
      return await this.recognizeSpeech(audioBase64, preferredLanguageCodes);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement et de la reconnaissance de la parole:', error);
      return null;
    }
  }
  
  // Prononcer du texte en utilisant le système TTS de l'appareil
  static async speak(
    text: string,
    options: Speech.SpeechOptions = {}
  ): Promise<void> {
    try {
      const defaultLang = this.lastDetectedLanguage ? 
        this.lastDetectedLanguage : 'en-US';
        
      await Speech.speak(text, {
        language: defaultLang,
        pitch: 1.0,
        rate: 0.9,
        ...options,
      });
    } catch (error) {
      console.error('Erreur lors de la prononciation du texte:', error);
      throw error;
    }
  }
  
  // Détecter si une transcription correspond à une commande
  static detectCommand(
    transcript: string,
    commands: VoiceCommand[]
  ): VoiceCommand | null {
    const lowerTranscript = transcript.toLowerCase();
    
    for (const command of commands) {
      if (lowerTranscript.includes(command.command.toLowerCase())) {
        return command;
      }
      
      if (command.aliases) {
        for (const alias of command.aliases) {
          if (lowerTranscript.includes(alias.toLowerCase())) {
            return command;
          }
        }
      }
    }
    
    return null;
  }
  
  // Traduire un texte d'une langue à une autre
  static async translateText(
    text: string,
    sourceLanguage?: string,
    targetLanguage: string = 'fr-FR'
  ): Promise<string> {
    try {
      // Si la langue source n'est pas spécifiée, utiliser la dernière langue détectée
      const actualSourceLang = sourceLanguage || 
                              this.lastDetectedLanguage?.split('-')[0] || 
                              'en';
      
      // Préparer la requête
      const endpoint = ApiConfig.API_ENDPOINTS.TRANSLATION;
      const params = new URLSearchParams({
        key: ApiConfig.getApiKey(),
        q: text,
        source: actualSourceLang,
        target: targetLanguage.split('-')[0], // Utiliser seulement le code de langue sans région
        format: 'text'
      });
      
      // Appeler l'API de traduction
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });
      
      const data = await response.json();
      
      if (!data.data || !data.data.translations || data.data.translations.length === 0) {
        throw new Error('Échec de la traduction');
      }
      
      return data.data.translations[0].translatedText;
    } catch (error) {
      console.error('Erreur lors de la traduction du texte:', error);
      throw error;
    }
  }
  
  // Détecter la langue d'un texte
  static async detectLanguage(text: string): Promise<string> {
    try {
      const endpoint = ApiConfig.API_ENDPOINTS.TRANSLATION;
      const params = new URLSearchParams({
        key: ApiConfig.getApiKey(),
        q: text
      });
      
      const response = await fetch(`${endpoint}/detect?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (!data.data || !data.data.detections || data.data.detections.length === 0) {
        throw new Error('Échec de la détection de langue');
      }
      
      const detectedLanguage = data.data.detections[0][0].language;
      this.lastDetectedLanguage = detectedLanguage;
      return detectedLanguage;
    } catch (error) {
      console.error('Erreur lors de la détection de la langue:', error);
      return 'en'; // Par défaut: anglais
    }
  }
  
  // Fonction utilitaire: vérifier si l'API est disponible
  static async checkApiAvailability(): Promise<boolean> {
    try {
      if (!ApiConfig.isApiKeyValid()) {
        return false;
      }
      
      // Faire une requête de test à l'API
      const testResponse = await fetch(
        `${ApiConfig.API_ENDPOINTS.TRANSLATION}/detect?key=${ApiConfig.getApiKey()}&q=test`,
        {
          method: 'GET',
          headers: ApiConfig.getAuthHeaders(),
        }
      );
      
      return testResponse.status === 200;
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'API:', error);
      return false;
    }
  }
}