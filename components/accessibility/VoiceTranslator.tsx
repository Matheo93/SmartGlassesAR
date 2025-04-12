// components/accessibility/RealtimeVoiceTranslator.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView,
  Alert,
  Platform,
  Switch
} from 'react-native';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import ApiConfig from '../../services/ApiConfig';

// Language interface
interface Language {
  code: string;
  name: string;
  flag: string;
  voiceCode?: string; // For text-to-speech
}

// Translation result interface
interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage?: string;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: Date;
}

// Available languages
const LANGUAGES: Language[] = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', voiceCode: 'fr-FR' },
  { code: 'en', name: 'English', flag: '🇬🇧', voiceCode: 'en-US' },
  { code: 'es', name: 'Español', flag: '🇪🇸', voiceCode: 'es-ES' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', voiceCode: 'de-DE' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', voiceCode: 'it-IT' },
  { code: 'zh', name: '中文', flag: '🇨🇳', voiceCode: 'zh-CN' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', voiceCode: 'ja-JP' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', voiceCode: 'ko-KR' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', voiceCode: 'ru-RU' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', voiceCode: 'ar-SA' }
];

// Component props
interface RealtimeVoiceTranslatorProps {
  onClose?: () => void;
}

export const RealtimeVoiceTranslator: React.FC<RealtimeVoiceTranslatorProps> = ({ onClose }) => {
  // State variables
  const [sourceLanguage, setSourceLanguage] = useState<string>('auto'); // 'auto' for auto-detection
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translationHistory, setTranslationHistory] = useState<TranslationResult[]>([]);
  const [continuousMode, setContinuousMode] = useState(false);
  const [autoPlayback, setAutoPlayback] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const continuousModeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize audio session
  useEffect(() => {
    setupAudioSession();
    
    return () => {
      // Clean up
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      
      if (continuousModeTimerRef.current) {
        clearTimeout(continuousModeTimerRef.current);
      }
      
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
      });
    };
  }, []);
  
  // Effect for continuous mode
  useEffect(() => {
    if (continuousMode && !isRecording && !isTranslating && !isSpeaking) {
      // Start recording after a short delay
      continuousModeTimerRef.current = setTimeout(() => {
        startRecording();
      }, 1000); // 1 second delay between translations
    }
    
    return () => {
      if (continuousModeTimerRef.current) {
        clearTimeout(continuousModeTimerRef.current);
      }
    };
  }, [continuousMode, isRecording, isTranslating, isSpeaking]);
  
  // Setup audio session
  const setupAudioSession = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Failed to setup audio session:', error);
      setError('Failed to initialize audio system');
    }
  };
  
  // Start recording
  const startRecording = async () => {
    try {
      setError(null);
      
      // Check permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microphone permission not granted');
        return;
      }
      
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
      
      recordingRef.current = recording;
      setIsRecording(true);
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to start recording');
    }
  };
  
  // Stop recording and process
  const stopRecording = async () => {
    if (!recordingRef.current) return;
    
    try {
      setIsRecording(false);
      
      // Provide haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      if (!uri) {
        setError('Recording failed - no audio data');
        return;
      }
      
      // Process the recording
      await processAudioForTranslation(uri);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError('Failed to process recording');
    }
  };
  
  // Process audio recording for translation
  const processAudioForTranslation = async (audioUri: string) => {
    try {
      setIsTranslating(true);
      
      // Convert audio to base64
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error('Audio file not found');
      }
      
      // Read file as base64
      const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Recognize speech using Cloud Speech-to-Text
      const recognizedText = await recognizeSpeech(base64Audio);
      
      if (!recognizedText) {
        throw new Error('Failed to recognize speech');
      }
      
      setOriginalText(recognizedText.text);
      
      // Translate the recognized text
      const translation = await translateText(
        recognizedText.text, 
        recognizedText.detectedLanguage || sourceLanguage,
        targetLanguage
      );
      
      setTranslatedText(translation.translatedText);
      
      // Add to history
      const result: TranslationResult = {
        originalText: recognizedText.text,
        translatedText: translation.translatedText,
        detectedLanguage: recognizedText.detectedLanguage,
        sourceLanguage: recognizedText.detectedLanguage || sourceLanguage,
        targetLanguage,
        timestamp: new Date()
      };
      
      setTranslationHistory(prev => [result, ...prev]);
      
      // Speak the translation if auto-playback is enabled
      if (autoPlayback) {
        speakTranslation(translation.translatedText);
      }
    } catch (error) {
      console.error('Translation process error:', error);
      setError('Failed to process translation');
    } finally {
      setIsTranslating(false);
    }
  };
  
  // Recognize speech from audio
  const recognizeSpeech = async (base64Audio: string) => {
    try {
      // Google Cloud Speech-to-Text API request
      const apiKey = ApiConfig.getApiKey();
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.SPEECH_TO_TEXT}?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: 48000,
              languageCode: sourceLanguage === 'auto' ? 'en-US' : getVoiceCode(sourceLanguage),
              model: 'default',
              enableAutomaticPunctuation: true,
              // Only enable language detection if set to auto
              alternativeLanguageCodes: sourceLanguage === 'auto' 
                ? LANGUAGES.map(lang => getVoiceCode(lang.code))
                : undefined,
            },
            audio: {
              content: base64Audio,
            },
          }),
        }
      );
      
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        // For demo/debugging, return mock data if the API fails
        if (process.env.NODE_ENV === 'development') {
          return {
            text: "Ceci est un texte de test pour la démonstration",
            detectedLanguage: 'fr'
          };
        }
        throw new Error('No speech recognized');
      }
      
      // Get the first alternative from the first result
      const text = data.results[0].alternatives[0].transcript;
      
      // Get the detected language if available
      const detectedLanguage = data.results[0]?.languageCode?.split('-')[0];
      
      return {
        text,
        detectedLanguage
      };
    } catch (error) {
      console.error('Speech recognition error:', error);
      
      // For demo/debugging, return mock data if the API fails
      if (process.env.NODE_ENV === 'development') {
        return {
          text: "Ceci est un texte de test pour la démonstration",
          detectedLanguage: 'fr'
        };
      }
      
      throw error;
    }
  };
  
  // Translate text
  const translateText = async (
    text: string,
    from: string,
    to: string
  ) => {
    try {
      // Google Cloud Translation API request
      const apiKey = ApiConfig.getApiKey();
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.TRANSLATION}?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: text,
            source: from === 'auto' ? undefined : from,
            target: to,
            format: 'text',
          }),
        }
      );
      
      const data = await response.json();
      
      if (!data.data || !data.data.translations || data.data.translations.length === 0) {
        // For demo/debugging, return mock data if the API fails
        if (process.env.NODE_ENV === 'development') {
          return {
            translatedText: "This is a test text for demonstration",
            detectedSourceLanguage: from === 'auto' ? 'fr' : from
          };
        }
        throw new Error('Translation failed');
      }
      
      return {
        translatedText: data.data.translations[0].translatedText,
        detectedSourceLanguage: data.data.translations[0].detectedSourceLanguage
      };
    } catch (error) {
      console.error('Translation error:', error);
      
      // For demo/debugging, return mock data if the API fails
      if (process.env.NODE_ENV === 'development') {
        return {
          translatedText: "This is a test text for demonstration",
          detectedSourceLanguage: from === 'auto' ? 'fr' : from
        };
      }
      
      throw error;
    }
  };
  
  // Speak translation using text-to-speech
  const speakTranslation = async (text: string) => {
    try {
      setIsSpeaking(true);
      
      const targetLang = LANGUAGES.find(lang => lang.code === targetLanguage);
      const voiceCode = targetLang?.voiceCode || 'en-US';
      
      await Speech.speak(text, {
        language: voiceCode,
        pitch: 1.0,
        rate: 0.9,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  };
  
  // Get voice code for a language
  const getVoiceCode = (langCode: string): string => {
    const lang = LANGUAGES.find(l => l.code === langCode);
    return lang?.voiceCode || `${langCode}-${langCode.toUpperCase()}`;
  };
  
  // Toggle continuous mode
  const toggleContinuousMode = () => {
    setContinuousMode(prev => !prev);
  };
  
  // Swap languages
  const swapLanguages = () => {
    // Only swap if source is not auto
    if (sourceLanguage !== 'auto') {
      setSourceLanguage(targetLanguage);
      setTargetLanguage(sourceLanguage);
    }
  };
  
  // Clear history
  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all translation history?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setTranslationHistory([]) }
      ]
    );
  };
  
  // Repeat last translation
  const repeatLastTranslation = () => {
    if (translatedText) {
      speakTranslation(translatedText);
    }
  };
  
  // Render language selection buttons
  const renderLanguageButtons = (type: 'source' | 'target') => {
    const selectedLanguage = type === 'source' ? sourceLanguage : targetLanguage;
    const setLanguage = type === 'source' ? setSourceLanguage : setTargetLanguage;
    
    return (
      <View style={styles.languageButtonsContainer}>
        {/* Add 'Auto' option for source language only */}
        {type === 'source' && (
          <TouchableOpacity
            style={[
              styles.languageButton,
              sourceLanguage === 'auto' && styles.selectedLanguageButton
            ]}
            onPress={() => setSourceLanguage('auto')}
          >
            <ThemedText style={[
              styles.languageButtonText,
              sourceLanguage === 'auto' && styles.selectedLanguageButtonText
            ]}>
              🌐 Auto
            </ThemedText>
          </TouchableOpacity>
        )}
        
        {/* Regular language options */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.languageScrollContent}
        >
          {LANGUAGES.map(language => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageButton,
                selectedLanguage === language.code && styles.selectedLanguageButton
              ]}
              onPress={() => setLanguage(language.code)}
            >
              <ThemedText style={[
                styles.languageButtonText,
                selectedLanguage === language.code && styles.selectedLanguageButtonText
              ]}>
                {language.flag} {language.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Voice Translator</ThemedText>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(!showSettings)}
        >
          <Ionicons name="settings-outline" size={24} color="#2196F3" />
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Settings panel */}
      {showSettings && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingRow}>
            <ThemedText style={styles.settingLabel}>Auto-playback</ThemedText>
            <Switch
              value={autoPlayback}
              onValueChange={setAutoPlayback}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={autoPlayback ? '#fff' : '#f4f3f4'}
            />
          </View>
          <View style={styles.settingRow}>
            <ThemedText style={styles.settingLabel}>Continuous mode</ThemedText>
            <Switch
              value={continuousMode}
              onValueChange={toggleContinuousMode}
              trackColor={{ false: '#767577', true: '#2196F3' }}
              thumbColor={continuousMode ? '#fff' : '#f4f3f4'}
            />
          </View>
          <TouchableOpacity
            style={styles.clearHistoryButton}
            onPress={clearHistory}
          >
            <ThemedText style={styles.clearHistoryText}>Clear History</ThemedText>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Language selection */}
      <View style={styles.languageSelectionContainer}>
        <View style={styles.languageSelectorHeader}>
          <ThemedText style={styles.languageSelectorTitle}>I speak:</ThemedText>
        </View>
        {renderLanguageButtons('source')}
        
        <TouchableOpacity
          style={styles.swapButton}
          onPress={swapLanguages}
          disabled={sourceLanguage === 'auto'}
        >
          <Ionicons
            name="swap-vertical"
            size={24}
            color={sourceLanguage === 'auto' ? '#CCCCCC' : '#2196F3'}
          />
        </TouchableOpacity>
        
        <View style={styles.languageSelectorHeader}>
          <ThemedText style={styles.languageSelectorTitle}>Translate to:</ThemedText>
        </View>
        {renderLanguageButtons('target')}
      </View>
      
      {/* Translation display */}
      <View style={styles.translationDisplayContainer}>
        {/* Original text */}
        <View style={styles.textContainer}>
          <ThemedText style={styles.textLabel}>Original:</ThemedText>
          <ScrollView style={styles.textScrollView}>
            <ThemedText style={styles.textContent}>
              {isTranslating ? 'Translating...' : originalText || 'Tap the microphone to start speaking'}
            </ThemedText>
          </ScrollView>
        </View>
        
        {/* Translated text */}
        <View style={styles.textContainer}>
          <ThemedText style={styles.textLabel}>Translation:</ThemedText>
          <ScrollView style={styles.textScrollView}>
            <ThemedText style={styles.textContent}>
              {translatedText || 'Translation will appear here'}
            </ThemedText>
          </ScrollView>
          
          {/* Repeat button */}
          {translatedText && (
            <TouchableOpacity
              style={styles.repeatButton}
              onPress={repeatLastTranslation}
              disabled={isSpeaking}
            >
              <Ionicons
                name="volume-high"
                size={20}
                color={isSpeaking ? '#AAAAAA' : '#2196F3'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}
      
      {/* Record button */}
      <View style={styles.recordButtonContainer}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordingButton,
            isSpeaking && styles.speakingButton
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isTranslating || isSpeaking || (continuousMode && !isRecording)}
        >
          {isTranslating ? (
            <ActivityIndicator color="white" size="large" />
          ) : isRecording ? (
            <Ionicons name="square" size={36} color="white" />
          ) : isSpeaking ? (
            <Ionicons name="volume-high" size={36} color="white" />
          ) : (
            <Ionicons name="mic" size={36} color="white" />
          )}
        </TouchableOpacity>
        
        <ThemedText style={styles.recordButtonLabel}>
          {isRecording
            ? 'Tap to stop recording'
            : isTranslating
              ? 'Translating...'
              : isSpeaking
                ? 'Speaking...'
                : continuousMode
                  ? 'Continuous mode active'
                  : 'Tap to start recording'}
        </ThemedText>
        
        {/* Continuous mode toggle */}
        <TouchableOpacity
          style={[
            styles.continuousModeButton,
            continuousMode && styles.continuousModeActiveButton
          ]}
          onPress={toggleContinuousMode}
          disabled={isRecording || isTranslating}
        >
          <Ionicons
            name={continuousMode ? "infinite" : "play-circle"}
            size={20}
            color="white"
          />
          <ThemedText style={styles.continuousModeButtonText}>
            {continuousMode ? 'Continuous: ON' : 'Continuous: OFF'}
          </ThemedText>
        </TouchableOpacity>
      </View>
      
      {/* History section */}
      {translationHistory.length > 0 && (
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <ThemedText style={styles.historyTitle}>Recent Translations</ThemedText>
            <TouchableOpacity onPress={clearHistory}>
              <ThemedText style={styles.clearHistoryText}>Clear</ThemedText>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.historyList}>
            {translationHistory.slice(0, 5).map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyItemHeader}>
                  <ThemedText style={styles.historyItemLanguage}>
                    {LANGUAGES.find(l => l.code === item.sourceLanguage)?.flag || '🌐'} → {LANGUAGES.find(l => l.code === item.targetLanguage)?.flag}
                  </ThemedText>
                  <ThemedText style={styles.historyItemTime}>
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </ThemedText>
                </View>
                <ThemedText style={styles.historyItemOriginal}>{item.originalText}</ThemedText>
                <ThemedText style={styles.historyItemTranslation}>{item.translatedText}</ThemedText>
                <TouchableOpacity
                  style={styles.historyItemSpeakButton}
                  onPress={() => speakTranslation(item.translatedText)}
                  disabled={isSpeaking}
                >
                  <Ionicons
                    name="volume-medium"
                    size={18}
                    color={isSpeaking ? '#AAAAAA' : '#2196F3'}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 8,
    marginRight: 8,
  },
  closeButton: {
    padding: 8,
  },
  settingsPanel: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
  },
  clearHistoryButton: {
    alignSelf: 'center',
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  clearHistoryText: {
    color: '#F44336',
  },
  languageSelectionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  languageSelectorHeader: {
    marginVertical: 5,
  },
  languageSelectorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  languageButtonsContainer: {
    marginVertical: 5,
  },
  languageScrollContent: {
    paddingRight: 16,
  },
  languageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedLanguageButton: {
    backgroundColor: '#2196F3',
  },
  languageButtonText: {
    fontSize: 14,
  },
  selectedLanguageButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  swapButton: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginVertical: 10,
  },
  translationDisplayContainer: {
    flex: 1,
    padding: 16,
  },
  textContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  textLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#666',
  },
  textScrollView: {
    flex: 1,
  },
  textContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  repeatButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    margin: 16,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 5,
  },
  errorText: {
    color: '#D32F2F',
  },
  recordButtonContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  recordingButton: {
    backgroundColor: '#F44336',
  },
  speakingButton: {
    backgroundColor: '#4CAF50',
  },
  recordButtonLabel: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  continuousModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#9E9E9E',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginTop: 15,
  },
  continuousModeActiveButton: {
    backgroundColor: '#4CAF50',
  },
  continuousModeButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
  },
  historyContainer: {
    maxHeight: 200,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyList: {
    paddingHorizontal: 16,
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  historyItemLanguage: {
    fontSize: 12,
    color: '#666',
  },
  historyItemTime: {
    fontSize: 12,
    color: '#999',
  },
  historyItemOriginal: {
    fontSize: 14,
    marginBottom: 5,
  },
  historyItemTranslation: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2196F3',
  },
  historyItemSpeakButton: {
    position: 'absolute',
    right: 0,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RealtimeVoiceTranslator;