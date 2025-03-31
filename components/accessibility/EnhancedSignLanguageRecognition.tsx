// components/accessibility/EnhancedSignLanguageRecognition.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Alert,
  Switch
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as Speech from 'expo-speech';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

// Type pour le dictionnaire de signes
interface SignTranslations {
  fr: string;
  en: string;
}

interface SignDictionary {
  [key: string]: SignTranslations;
}

// Dictionnaire pour la langue des signes
const SIGN_DICTIONARY: SignDictionary = {
  'hello': { fr: 'bonjour', en: 'hello' },
  'thank_you': { fr: 'merci', en: 'thank you' },
  'please': { fr: 's\'il vous plaît', en: 'please' },
  'yes': { fr: 'oui', en: 'yes' },
  'no': { fr: 'non', en: 'no' },
  'help': { fr: 'aide', en: 'help' },
  'water': { fr: 'eau', en: 'water' },
  'food': { fr: 'nourriture', en: 'food' },
  'toilet': { fr: 'toilettes', en: 'toilet' },
  'medicine': { fr: 'médicament', en: 'medicine' }
};

// Type pour le résultat de la reconnaissance
interface RecognitionResult {
  sign: string;
  translation: SignTranslations;
  confidence: number;
  timestamp: Date;
}

// Props du composant
interface EnhancedSignLanguageRecognitionProps {
  onClose?: () => void;
}

export const EnhancedSignLanguageRecognition: React.FC<EnhancedSignLanguageRecognitionProps> = ({ 
  onClose 
}) => {
  // État
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [activeCameraType, setActiveCameraType] = useState<CameraType>('front');
  const [showHistory, setShowHistory] = useState(false);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [speakResults, setSpeakResults] = useState(true);
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionResult[]>([]);
  const [currentRecognition, setCurrentRecognition] = useState<RecognitionResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const cameraRef = useRef(null);
  
  // Demander les permissions de caméra au chargement
  useEffect(() => {
    requestPermission();
  }, []);
  
  // Simuler la reconnaissance des signes pour la démo
  const mockRecognizeSign = async (): Promise<RecognitionResult> => {
    // Simuler un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Sélectionner aléatoirement un signe dans le dictionnaire
    const signKeys = Object.keys(SIGN_DICTIONARY);
    const randomIndex = Math.floor(Math.random() * signKeys.length);
    const signKey = signKeys[randomIndex];
    
    return {
      sign: signKey,
      translation: SIGN_DICTIONARY[signKey],
      confidence: 0.7 + Math.random() * 0.25, // Entre 0.7 et 0.95
      timestamp: new Date()
    };
  };
  
  // Effectuer la reconnaissance
  const performRecognition = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Dans une implémentation réelle, capturer l'image et l'envoyer à un modèle ML
      const result = await mockRecognizeSign();
      
      // Mettre à jour l'état
      setCurrentRecognition(result);
      setRecognitionHistory(prev => [result, ...prev]);
      
      // Lecture vocale du résultat
      if (speakResults) {
        Speech.speak(result.translation[language], {
          language: language === 'fr' ? 'fr-FR' : 'en-US',
          pitch: 1.0,
          rate: 0.9
        });
      }
    } catch (error) {
      console.error('Erreur de reconnaissance:', error);
      Alert.alert('Erreur', 'Impossible de reconnaître le signe');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Mode continu
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (isContinuousMode && !showHistory) {
      intervalId = setInterval(() => {
        performRecognition();
      }, 3000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isContinuousMode, showHistory]);
  
  // Changer de langue
  const toggleLanguage = () => {
    setLanguage(prev => prev === 'fr' ? 'en' : 'fr');
  };
  
  // Effacer l'historique
  const clearHistory = () => {
    Alert.alert(
      'Confirmer',
      'Voulez-vous vraiment effacer tout l\'historique ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Effacer', style: 'destructive', onPress: () => setRecognitionHistory([]) }
      ]
    );
  };
  
  // Basculer la caméra avant/arrière
  const toggleCamera = () => {
    setActiveCameraType(
      activeCameraType === 'front'
        ? 'back'
        : 'front'
    );
  };
  
  // Répéter la dernière traduction
  const repeatLastTranslation = () => {
    if (currentRecognition && speakResults) {
      Speech.speak(currentRecognition.translation[language], {
        language: language === 'fr' ? 'fr-FR' : 'en-US'
      });
    }
  };
  
  // Si la permission n'est pas accordée
  if (!permission) {
    return (
      <ThemedView style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <ThemedText style={styles.permissionText}>
          Vérification des permissions de caméra...
        </ThemedText>
      </ThemedView>
    );
  }
  
  if (!permission.granted) {
    return (
      <ThemedView style={styles.permissionContainer}>
        <MaterialIcons name="no-photography" size={64} color="#F44336" />
        <ThemedText style={styles.permissionText}>
          L'accès à la caméra est nécessaire pour cette fonctionnalité
        </ThemedText>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={requestPermission}
        >
          <ThemedText style={styles.permissionButtonText}>
            Autoriser la caméra
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.permissionButton, { marginTop: 10, backgroundColor: '#757575' }]} 
          onPress={onClose}
        >
          <ThemedText style={styles.permissionButtonText}>Retour</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      {/* Entête */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Reconnaissance des signes</ThemedText>
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
      
      {/* Panneau de paramètres */}
      {showSettings && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="language" size={18} color="#2196F3" />
              <ThemedText style={styles.settingLabel}>
                Langue de traduction
              </ThemedText>
            </View>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={toggleLanguage}
            >
              <ThemedText style={styles.languageButtonText}>
                {language === 'fr' ? 'Français 🇫🇷' : 'English 🇬🇧'}
              </ThemedText>
            </TouchableOpacity>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="volume-high" size={18} color="#2196F3" />
              <ThemedText style={styles.settingLabel}>
                Lecture vocale des résultats
              </ThemedText>
            </View>
            <Switch
              value={speakResults}
              onValueChange={setSpeakResults}
              trackColor={{ false: '#767577', true: '#81D4FA' }}
              thumbColor={speakResults ? '#2196F3' : '#f4f3f4'}
            />
          </View>
        </View>
      )}
      
      {/* Vue principale: caméra ou historique */}
      {!showHistory ? (
        <>
          {/* Flux caméra */}
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={activeCameraType}
            >
              {/* Guide visuel pour le positionnement des mains */}
              <View style={styles.handGuide}>
                <MaterialIcons name="pan-tool" size={50} color="rgba(255,255,255,0.7)" />
              </View>
              
              {/* Résultat de la reconnaissance */}
              {currentRecognition && (
                <View style={styles.recognitionResult}>
                  <ThemedText style={styles.signText}>
                    {currentRecognition.translation[language]}
                  </ThemedText>
                  <View style={styles.confidenceBar}>
                    <View 
                      style={[
                        styles.confidenceFill, 
                        { width: `${currentRecognition.confidence * 100}%` }
                      ]} 
                    />
                  </View>
                  <ThemedText style={styles.confidenceText}>
                    {Math.round(currentRecognition.confidence * 100)}% de confiance
                  </ThemedText>
                  
                  {/* Bouton pour répéter la lecture vocale */}
                  <TouchableOpacity
                    style={styles.repeatButton}
                    onPress={repeatLastTranslation}
                  >
                    <Ionicons name="volume-high" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Indicateur de traitement */}
              {isProcessing && (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color="white" />
                  <ThemedText style={styles.processingText}>
                    Reconnaissance en cours...
                  </ThemedText>
                </View>
              )}
              
              {/* Bandeau d'info sur le mode continu */}
              {isContinuousMode && (
                <View style={styles.continuousModeIndicator}>
                  <ThemedText style={styles.continuousModeText}>
                    Mode continu activé
                  </ThemedText>
                </View>
              )}
            </CameraView>
            
            {/* Boutons flottants */}
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => setShowHistory(true)}
            >
              <Ionicons name="list" size={24} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.flipCameraButton}
              onPress={toggleCamera}
            >
              <Ionicons name="camera-reverse" size={24} color="white" />
            </TouchableOpacity>
          </View>
          
          {/* Contrôles en bas de l'écran */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                isContinuousMode && styles.activeControlButton
              ]}
              onPress={() => setIsContinuousMode(!isContinuousMode)}
            >
              <Ionicons 
                name={isContinuousMode ? "pause" : "play"} 
                size={24} 
                color="white" 
              />
              <ThemedText style={styles.controlButtonText}>
                {isContinuousMode ? 'Pause' : 'Continu'}
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.captureButton}
              onPress={performRecognition}
              disabled={isProcessing}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleLanguage}
            >
              <Ionicons name="language" size={24} color="white" />
              <ThemedText style={styles.controlButtonText}>
                {language === 'fr' ? 'FR' : 'EN'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* Vue historique */
        <ScrollView style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <ThemedText style={styles.historyTitle}>
              Historique des signes reconnus
            </ThemedText>
            <TouchableOpacity 
              style={styles.clearHistoryButton}
              onPress={clearHistory}
            >
              <ThemedText style={styles.clearHistoryText}>Effacer</ThemedText>
              <Ionicons name="trash-outline" size={18} color="#F44336" />
            </TouchableOpacity>
          </View>
          
          {recognitionHistory.length > 0 ? (
            recognitionHistory.map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyItemLeft}>
                  <ThemedText style={styles.historyItemSign}>
                    {item.translation[language]}
                  </ThemedText>
                  <ThemedText style={styles.historyItemTime}>
                    {item.timestamp.toLocaleTimeString()}
                  </ThemedText>
                </View>
                <View style={styles.historyItemRight}>
                  <View style={styles.historyConfidenceBadge}>
                    <ThemedText style={styles.historyConfidenceText}>
                      {Math.round(item.confidence * 100)}%
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      // Répéter la lecture vocale
                      if (speakResults) {
                        Speech.speak(item.translation[language], {
                          language: language === 'fr' ? 'fr-FR' : 'en-US'
                        });
                      }
                    }}
                  >
                    <Ionicons name="volume-high-outline" size={20} color="#2196F3" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <ThemedView style={styles.emptyHistoryContainer}>
              <Ionicons name="list" size={48} color="#BDBDBD" />
              <ThemedText style={styles.emptyHistoryText}>
                Aucun signe reconnu pour le moment
              </ThemedText>
            </ThemedView>
          )}
          
          {/* Bouton pour revenir à la caméra */}
          <TouchableOpacity
            style={styles.backToCameraButton}
            onPress={() => setShowHistory(false)}
          >
            <Ionicons name="camera" size={20} color="white" />
            <ThemedText style={styles.backToCameraText}>
              Retour à la caméra
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  permissionButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  settingsButton: {
    padding: 5,
    marginRight: 10,
  },
  closeButton: {
    padding: 5,
  },
  settingsPanel: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 10,
  },
  languageButton: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  languageButtonText: {
    color: '#2196F3',
    fontWeight: '500',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  handGuide: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 150,
    height: 150,
    marginLeft: -75,
    marginTop: -75,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 10,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recognitionResult: {
    position: 'absolute',
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  signText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  confidenceBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
  },
  repeatButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  continuousModeIndicator: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  continuousModeText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(76,175,80,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  historyButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipCameraButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#212121',
  },
  controlButton: {
    alignItems: 'center',
    padding: 10,
  },
  activeControlButton: {
    backgroundColor: 'rgba(76,175,80,0.3)',
    borderRadius: 10,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearHistoryText: {
    color: '#F44336',
    marginRight: 5,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyItemLeft: {
    flex: 1,
  },
  historyItemSign: {
    fontSize: 18,
    fontWeight: '500',
  },
  historyItemTime: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  historyItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyConfidenceBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
  },
  historyConfidenceText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  emptyHistoryContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHistoryText: {
    marginTop: 16,
    color: '#757575',
    textAlign: 'center',
  },
  backToCameraButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    margin: 16,
    borderRadius: 25,
  },
  backToCameraText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default EnhancedSignLanguageRecognition;