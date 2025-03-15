// services/VoiceAssistantService.ts
import { useState, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import ApiConfig from './ApiConfig';

export type SpeechRecognitionResult = {
  transcript: string;
  confidence: number;
  isFinal: boolean;
};

export type VoiceCommand = {
  command: string;
  action: () => void;
  aliases?: string[];
};

/**
 * Service for voice recognition and speech synthesis
 */
export class VoiceAssistantService {
  private static recording: Audio.Recording | null = null;
  
  /**
   * Request audio recording permissions
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      return granted;
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }
  
  /**
   * Start recording audio
   */
  static async startRecording(): Promise<void> {
    try {
      // Check permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Audio recording permissions not granted');
      }
      
      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      
      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      this.recording = recording;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }
  
  /**
   * Stop recording and get the audio file
   */
  static async stopRecording(): Promise<string> {
    try {
      if (!this.recording) {
        throw new Error('No active recording');
      }
      
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      
      if (!uri) {
        throw new Error('Recording URI not available');
      }
      
      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      throw error;
    }
  }
  
  /**
   * Convert audio file to base64
   */
  static async audioFileToBase64(fileUri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      return base64;
    } catch (error) {
      console.error('Error converting audio to base64:', error);
      throw error;
    }
  }
  
  /**
   * Recognize speech in an audio file using Google Cloud Speech-to-Text API
   */
  static async recognizeSpeech(
    audioBase64: string,
    languageCode: string = 'en-US'
  ): Promise<SpeechRecognitionResult | null> {
    try {
      // Prepare request body
      const body = JSON.stringify({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 48000,
          languageCode,
          enableAutomaticPunctuation: true,
          model: 'default',
        },
        audio: {
          content: audioBase64,
        },
      });
      
      // Call Google Cloud Speech-to-Text API
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
      
      return {
        transcript: result.transcript,
        confidence: result.confidence || 0.5,
        isFinal: true,
      };
    } catch (error) {
      console.error('Error recognizing speech:', error);
      return null;
    }
  }
  
  /**
   * Record and recognize speech in one function
   */
  static async recordAndRecognize(
    languageCode: string = 'en-US'
  ): Promise<SpeechRecognitionResult | null> {
    try {
      // Start recording
      await this.startRecording();
      
      // Record for a few seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));
      
      // Stop recording and get audio file
      const audioUri = await this.stopRecording();
      
      // Convert audio to base64
      const audioBase64 = await this.audioFileToBase64(audioUri);
      
      // Recognize speech
      return await this.recognizeSpeech(audioBase64, languageCode);
    } catch (error) {
      console.error('Error recording and recognizing speech:', error);
      return null;
    }
  }
  
  /**
   * Speak text using device's text-to-speech
   */
  static async speak(
    text: string,
    options: Speech.SpeechOptions = {}
  ): Promise<void> {
    try {
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        ...options,
      });
    } catch (error) {
      console.error('Error speaking text:', error);
      throw error;
    }
  }
  
  /**
   * Detect if a transcript matches a command
   */
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
}

// React hook for using the voice assistant
export function useVoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  
  // Initialize voice assistant on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const hasPermission = await VoiceAssistantService.requestPermissions();
        setIsInitialized(hasPermission);
        
        if (!hasPermission) {
          setError('Audio recording permissions not granted');
        }
      } catch (err) {
        console.error('Error initializing voice assistant:', err);
        setError('Failed to initialize voice assistant');
      }
    };
    
    initialize();
  }, []);
  
  // Start listening for voice commands
  const startListening = useCallback(async () => {
    if (!isInitialized) {
      setError('Voice assistant not initialized');
      return;
    }
    
    try {
      setIsListening(true);
      setError(null);
      
      // Start continuous recognition
      const recognitionLoop = async () => {
        while (isListening) {
          try {
            // Start recording
            await VoiceAssistantService.startRecording();
            
            // Record for a few seconds
            await new Promise((resolve) => setTimeout(resolve, 5000));
            
            // Stop recording and get audio file
            const audioUri = await VoiceAssistantService.stopRecording();
            
            // Convert audio to base64
            const audioBase64 = await VoiceAssistantService.audioFileToBase64(audioUri);
            
            // Recognize speech
            const result = await VoiceAssistantService.recognizeSpeech(audioBase64);
            
            if (result) {
              setTranscript(result.transcript);
              setConfidence(result.confidence);
              
              // Check if the transcript matches a command
              if (commands.length > 0) {
                const matchedCommand = VoiceAssistantService.detectCommand(
                  result.transcript,
                  commands
                );
                
                if (matchedCommand) {
                  matchedCommand.action();
                }
              }
            }
          } catch (error) {
            console.error('Error in recognition loop:', error);
          }
          
          // Brief pause between recognition attempts
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      };
      
      recognitionLoop();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setIsListening(false);
    }
  }, [isInitialized, isListening, commands]);
  
  // Stop listening
  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);
  
  // Speak text
  const speak = useCallback(
    async (text: string, options: Speech.SpeechOptions = {}) => {
      if (!isInitialized) {
        setError('Voice assistant not initialized');
        return;
      }
      
      try {
        setIsSpeaking(true);
        
        await VoiceAssistantService.speak(text, options);
        
        setIsSpeaking(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        setIsSpeaking(false);
      }
    },
    [isInitialized]
  );
  
  // Perform a one-time voice recognition
  const recognizeSpeech = useCallback(async (): Promise<string | null> => {
    if (!isInitialized) {
      setError('Voice assistant not initialized');
      return null;
    }
    
    try {
      setIsListening(true);
      
      const result = await VoiceAssistantService.recordAndRecognize();
      
      if (result) {
        setTranscript(result.transcript);
        setConfidence(result.confidence);
        return result.transcript;
      }
      
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setIsListening(false);
    }
  }, [isInitialized]);
  
  return {
    isInitialized,
    isListening,
    isSpeaking,
    transcript,
    confidence,
    error,
    startListening,
    stopListening,
    speak,
    recognizeSpeech,
    setCommands,
  };
}