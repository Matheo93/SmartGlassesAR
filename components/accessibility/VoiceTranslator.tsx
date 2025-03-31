// components/accessibility/VoiceTranslator.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  TouchableOpacity, 
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

// Types pour les langues et traductions
interface Language {
  code: string;
  name: string;
  flag: string;
}

interface TranslationMap {
  [key: string]: { [key: string]: string };
}

// LANGUES DISPONIBLES POUR LA TRADUCTION
const LANGUAGES: Language[] = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
];

// MOCK POUR LA TRADUCTION (à remplacer par de vraies API)
const mockTranslate = async (text: string, sourceLang: string, targetLang: string): Promise<string> => {
  // Simuler un délai réseau
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Quelques traductions pré-définies
  const translations: TranslationMap = {
    'fr-en': {
      'bonjour': 'hello',
      'comment allez-vous': 'how are you',
      'merci': 'thank you',
      'au revoir': 'goodbye'
    },
    'en-fr': {
      'hello': 'bonjour',
      'how are you': 'comment allez-vous',
      'thank you': 'merci',
      'goodbye': 'au revoir'
    },
    'fr-es': {
      'bonjour': 'hola',
      'comment allez-vous': 'cómo estás',
      'merci': 'gracias',
      'au revoir': 'adiós'
    }
  };
  
  // Rechercher une traduction existante
  const translationKey = `${sourceLang}-${targetLang}`;
  const translationMap = translations[translationKey] || {};
  
  // Rechercher le texte dans les traductions pré-définies
  const lowerText = text.toLowerCase();
  for (const [source, target] of Object.entries(translationMap)) {
    if (lowerText.includes(source)) {
      return target;
    }
  }
  
  // Si aucune traduction n'est trouvée, créer une traduction factice
  return `[${targetLang}] ${text}`;
};

// MOCK POUR LA RECONNAISSANCE VOCALE (à remplacer par de vraies API)
const mockRecognizeSpeech = async (language: string): Promise<string> => {
  // Simuler un délai réseau
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Générer un texte selon la langue
  const phrases: { [key: string]: string[] } = {
    'fr': [
      'Bonjour, comment allez-vous aujourd\'hui?',
      'Merci beaucoup pour votre aide.',
      'Je cherche la station de métro la plus proche.',
      'Pourriez-vous m\'indiquer le chemin vers le musée?'
    ],
    'en': [
      'Hello, how are you today?',
      'Thank you very much for your help.',
      'I\'m looking for the nearest subway station.',
      'Could you tell me the way to the museum?'
    ],
    'es': [
      'Hola, ¿cómo estás hoy?',
      'Muchas gracias por tu ayuda.',
      'Estoy buscando la estación de metro más cercana.',
      '¿Podrías indicarme el camino al museo?'
    ],
    'de': [
      'Hallo, wie geht es Ihnen heute?',
      'Vielen Dank für Ihre Hilfe.',
      'Ich suche die nächste U-Bahn-Station.',
      'Könnten Sie mir den Weg zum Museum zeigen?'
    ]
  };
  
  // Sélectionner une phrase aléatoire dans la langue choisie
  const availablePhrases = phrases[language] || phrases['en'];
  const randomIndex = Math.floor(Math.random() * availablePhrases.length);
  
  return availablePhrases[randomIndex];
};

// PROPS DU COMPOSANT
interface VoiceTranslatorProps {
  onClose?: () => void;
}

export const VoiceTranslator: React.FC<VoiceTranslatorProps> = ({ onClose }) => {
  // État local
  const [sourceLanguage, setSourceLanguage] = useState<string>('fr');
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [originalText, setOriginalText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [speakResult, setSpeakResult] = useState<boolean>(true);

  // Fonction pour inverser les langues
  const swapLanguages = () => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
  };

  // Fonction pour démarrer la reconnaissance vocale
  const startListening = async () => {
    try {
      setIsListening(true);
      setError(null);
      
      // Reconnaissance vocale simulée
      const transcript = await mockRecognizeSpeech(sourceLanguage);
      
      if (transcript) {
        setOriginalText(transcript);
        await translateText(transcript);
      } else {
        setError("Aucune parole détectée");
      }
    } catch (err) {
      setError("Erreur lors de l'enregistrement vocal");
      console.error(err);
    } finally {
      setIsListening(false);
    }
  };

  // Fonction pour traduire le texte
  const translateText = async (text: string) => {
    if (!text) return;
    
    try {
      setIsTranslating(true);
      setError(null);
      
      // Traduction simulée
      const result = await mockTranslate(text, sourceLanguage, targetLanguage);
      
      setTranslatedText(result);
      
      // Lire le résultat à voix haute
      if (speakResult) {
        Speech.speak(result, { 
          language: targetLanguage, 
          pitch: 1.0,
          rate: 0.8
        });
      }
    } catch (err) {
      setError("Erreur lors de la traduction");
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Sélectionner une langue source
  const selectSourceLanguage = (langCode: string) => {
    if (langCode === targetLanguage) {
      // Si même langue, inverser les langues
      swapLanguages();
    } else {
      setSourceLanguage(langCode);
    }
  };

  // Sélectionner une langue cible
  const selectTargetLanguage = (langCode: string) => {
    if (langCode === sourceLanguage) {
      // Si même langue, inverser les langues
      swapLanguages();
    } else {
      setTargetLanguage(langCode);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Traduction vocale</ThemedText>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#777" />
          </TouchableOpacity>
        )}
      </View>

      {/* Sélection des langues */}
      <View style={styles.languageSelector}>
        <View style={styles.languageColumn}>
          <ThemedText style={styles.languageLabel}>Source</ThemedText>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={`source-${lang.code}`}
              style={[
                styles.languageButton,
                sourceLanguage === lang.code && styles.activeLanguage
              ]}
              onPress={() => selectSourceLanguage(lang.code)}
            >
              <ThemedText style={styles.languageText}>
                {lang.flag} {lang.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity 
          style={styles.swapButton}
          onPress={swapLanguages}
        >
          <Ionicons name="swap-horizontal" size={24} color="#2196F3" />
        </TouchableOpacity>
        
        <View style={styles.languageColumn}>
          <ThemedText style={styles.languageLabel}>Cible</ThemedText>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={`target-${lang.code}`}
              style={[
                styles.languageButton,
                targetLanguage === lang.code && styles.activeLanguage
              ]}
              onPress={() => selectTargetLanguage(lang.code)}
            >
              <ThemedText style={styles.languageText}>
                {lang.flag} {lang.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Affichage du texte original et traduit */}
      <View style={styles.translationContainer}>
        <View style={styles.textBox}>
          <ThemedText style={styles.textBoxLabel}>
            Original ({LANGUAGES.find(l => l.code === sourceLanguage)?.name})
          </ThemedText>
          <ThemedText style={styles.translationText}>
            {originalText || "Appuyez sur le bouton pour parler"}
          </ThemedText>
        </View>
        
        <View style={styles.textBox}>
          <ThemedText style={styles.textBoxLabel}>
            Traduction ({LANGUAGES.find(l => l.code === targetLanguage)?.name})
          </ThemedText>
          <ThemedText style={styles.translationText}>
            {isTranslating ? "Traduction en cours..." : 
             translatedText || "La traduction s'affichera ici"}
          </ThemedText>
        </View>
      </View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        <TouchableOpacity 
          style={styles.optionButton}
          onPress={() => setSpeakResult(!speakResult)}
        >
          <Ionicons 
            name={speakResult ? "volume-high" : "volume-mute"} 
            size={22} 
            color="#2196F3" 
          />
          <ThemedText style={styles.optionText}>
            {speakResult ? "Son activé" : "Son désactivé"}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* Bouton d'enregistrement */}
      <TouchableOpacity
        style={styles.recordButton}
        onPress={startListening}
        disabled={isListening || isTranslating}
      >
        {isListening ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Ionicons name="mic" size={32} color="white" />
        )}
        <ThemedText style={styles.recordButtonText}>
          {isListening ? "Écoute en cours..." : "Appuyer pour parler"}
        </ThemedText>
      </TouchableOpacity>

      {/* Message d'erreur */}
      {error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  languageColumn: {
    flex: 1,
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  languageButton: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  activeLanguage: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  languageText: {
    fontSize: 14,
  },
  swapButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  translationContainer: {
    flex: 1,
    marginBottom: 20,
  },
  textBox: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  textBoxLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#666',
  },
  translationText: {
    fontSize: 16,
    lineHeight: 24,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  optionText: {
    marginLeft: 8,
    fontSize: 14,
  },
  recordButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 30,
    marginBottom: 20,
  },
  recordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  errorText: {
    color: '#d32f2f',
  },
});

export default VoiceTranslator;