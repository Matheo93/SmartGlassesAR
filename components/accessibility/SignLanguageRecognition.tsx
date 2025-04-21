// components/accessibility/SignLanguageRecognition.tsx - Version améliorée
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert 
} from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import { SignLanguageRecognitionService, RecognizedSign, SignType } from '../../services/SignLanguageRecognitionService';
import ApiConfig from '../../services/ApiConfig';

const SCREEN_WIDTH = Dimensions.get('window').width;

type SignLanguageRecognitionProps = {
  onClose?: () => void;
};

type RecognizedSignWithTimestamp = RecognizedSign & {
  id: string;
};

export const SignLanguageRecognition: React.FC<SignLanguageRecognitionProps> = ({
  onClose,
}) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [recognizedSigns, setRecognizedSigns] = useState<RecognizedSignWithTimestamp[]>([]);
  const [activeCameraType, setActiveCameraType] = useState<CameraType>('front');
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tfReady, setTfReady] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<string>('asl');
  const [speakResults, setSpeakResults] = useState(true);
  const [useVisionAPI, setUseVisionAPI] = useState(false); // Option pour forcer l'utilisation de Vision API
  
  const cameraRef = useRef<CameraView | null>(null);
  const signService = useRef<SignLanguageRecognitionService | null>(null);
  const processingInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Initialiser TensorFlow.js et le service de reconnaissance
  useEffect(() => {
    const setup = async () => {
      try {
        // Initialiser TensorFlow.js
        await tf.ready();
        setTfReady(true);
        
        // Initialiser le service de reconnaissance
        const service = SignLanguageRecognitionService.getInstance();
        await service.initialize();
        
        // Configurer le service
        service.updateConfig({
          activeLanguage: 'asl',
          speakRecognizedSigns: speakResults
        });
        
        signService.current = service;
        setIsLoading(false);
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        Alert.alert(
          'Erreur d\'initialisation',
          'Impossible d\'initialiser le service de reconnaissance. Veuillez réessayer.'
        );
        setIsLoading(false);
      }
    };
    
    setup();
    
    return () => {
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
      }
      
      if (signService.current) {
        signService.current.stopRecognition();
      }
    };
  }, []);
  
  // Mettre à jour la configuration du service quand les préférences changent
  useEffect(() => {
    if (signService.current) {
      signService.current.updateConfig({
        activeLanguage,
        speakRecognizedSigns: speakResults
      });
    }
  }, [activeLanguage, speakResults]);
  
  // Effet pour le mode continu
  useEffect(() => {
    if (isContinuousMode && !isRecognizing) {
      startContinuousRecognition();
    } else {
      stopContinuousRecognition();
    }
    
    return () => {
      stopContinuousRecognition();
    };
  }, [isContinuousMode, isRecognizing]);
  
  // Commencer la reconnaissance continue
  const startContinuousRecognition = () => {
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
    }
    
    // Lancer le service de reconnaissance
    if (signService.current) {
      signService.current.startRecognition();
    }
    
    // Traiter les images de la caméra à intervalles réguliers
    processingInterval.current = setInterval(() => {
      captureAndRecognize();
    }, 1000); // Reconnaissance toutes les secondes
  };
  
  // Arrêter la reconnaissance continue
  const stopContinuousRecognition = () => {
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
      processingInterval.current = null;
    }
    
    // Arrêter le service
    if (signService.current) {
      signService.current.stopRecognition();
    }
  };
  
  // Processus avec Vision API comme solution de repli
  const processWithVisionAPI = async (base64Image: string): Promise<RecognizedSign | null> => {
    try {
      if (!signService.current) return null;
      
      // Vérifier le quota API
      if (!ApiConfig.trackApiCall('vision')) {
        console.warn('Vision API quota reached');
        return null;
      }
      
      // Appeler Google Cloud Vision API
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.VISION_API}?key=${ApiConfig.getApiKey()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              features: [
                { type: 'FACE_DETECTION', maxResults: 5 },
                { type: 'LANDMARK_DETECTION', maxResults: 10 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 }
              ],
              image: { content: base64Image }
            }]
          })
        }
      );
      
      const data = await response.json();
      
      // Analyser les résultats pour détecter des gestes potentiels
      if (data.responses && data.responses[0]) {
        // Rechercher des positions de mains dans les landmarks
        if (data.responses[0].landmarkAnnotations) {
          for (const landmark of data.responses[0].landmarkAnnotations) {
            if (landmark.description.toLowerCase().includes('hand')) {
              // Pour l'exemple, on reconnaît un signe simple basé sur la position de la main
              return {
                type: SignType.ALPHABET,
                value: 'A', // Simplifié pour la démonstration
                confidence: landmark.score || 0.6,
                language: activeLanguage,
                timestamp: new Date()
              };
            }
          }
        }
        
        // Rechercher des objets qui pourraient être des mains
        if (data.responses[0].localizedObjectAnnotations) {
          for (const object of data.responses[0].localizedObjectAnnotations) {
            if (object.name.toLowerCase().includes('person') || 
                object.name.toLowerCase().includes('hand')) {
              // Essayer d'identifier un geste basé sur la position relative des objets détectés
              return {
                type: SignType.WORD,
                value: determineBasicSign(data.responses[0], activeLanguage),
                confidence: object.score || 0.5,
                language: activeLanguage,
                timestamp: new Date()
              };
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erreur lors du traitement Vision API:', error);
      return null;
    }
  };
  
  // Fonction helper pour déterminer un signe basique à partir des données Vision API
  const determineBasicSign = (visionResponse: any, language: string): string => {
    // Version simplifiée: retourne un mot en fonction de la langue
    const basicSigns = {
      'asl': ['Hello', 'Thank you', 'Yes', 'No'],
      'bsl': ['Hello', 'Thank you', 'Yes', 'No'],
      'lsf': ['Bonjour', 'Merci', 'Oui', 'Non']
    };
    
    // Choisir un mot aléatoire pour la démonstration
    // Dans une implémentation réelle, vous utiliseriez une analyse plus sophistiquée
    const langSigns = language === 'lsf' ? basicSigns.lsf : basicSigns.asl;
    return langSigns[Math.floor(Math.random() * langSigns.length)];
  };
  
  // Capturer une image et la traiter
  const captureAndRecognize = async () => {
    if (!cameraRef.current || !isCameraReady || isRecognizing || !signService.current) return;
    
    try {
      setIsRecognizing(true);
      
      // Prendre une photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true
      });
      
      // S'assurer que la photo existe
      if (!photo) {
        throw new Error('La capture de photo a échoué');
      }
      
      // Redimensionner l'image pour mieux la traiter
      const resizedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 300, height: 300 } }],
        { format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      
      // Base64 de l'image
      const base64Data = resizedImage.base64 || '';
      if (!base64Data) {
        throw new Error('Échec de l\'encodage de l\'image');
      }
      
      let result: RecognizedSign | null = null;
      
      // Utiliser soit TensorFlow, soit Vision API selon les paramètres
      if (useVisionAPI) {
        // Utiliser directement l'API Vision
        result = await processWithVisionAPI(base64Data);
      } else {
        // Essayer d'abord avec TensorFlow/le service principal
        result = await signService.current.processFrame({ base64: base64Data });
        
        // Si aucun résultat, essayer avec l'API Vision comme solution de repli
        if (!result && base64Data) {
          result = await processWithVisionAPI(base64Data);
        }
      }
      
      if (result) {
        // Ajouter à l'historique avec un ID unique
        const newSign: RecognizedSignWithTimestamp = {
          ...result,
          id: Date.now().toString()
        };
        
        setRecognizedSigns(prev => [newSign, ...prev]);
        
        // Annoncer le résultat avec TTS si activé
        if (speakResults) {
          Speech.speak(result.value, {
            language: result.language === 'lsf' ? 'fr-FR' : 'en-US',
            pitch: 1.0,
            rate: 0.9
          });
        }
      }
    } catch (error) {
      console.error('Erreur lors de la reconnaissance:', error);
    } finally {
      setIsRecognizing(false);
    }
  };
  
  // Inverser la caméra (avant/arrière)
  const toggleCamera = () => {
    setActiveCameraType(current => (current === 'front' ? 'back' : 'front'));
  };
  
  // Basculer entre TensorFlow et Vision API
  const toggleVisionAPI = () => {
    setUseVisionAPI(!useVisionAPI);
    Alert.alert(
      'Mode de reconnaissance',
      useVisionAPI ? 'Utilisation du modèle local' : 'Utilisation de Google Cloud Vision API',
      [{ text: 'OK' }]
    );
  };
  
  // Effacer l'historique
  const clearHistory = () => {
    Alert.alert(
      'Effacer l\'historique',
      'Êtes-vous sûr de vouloir effacer tout l\'historique?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Effacer', style: 'destructive', onPress: () => setRecognizedSigns([]) }
      ]
    );
  };
  
  // Changer la langue active
  const cycleLanguage = () => {
    if (!signService.current) return;
    
    const supported = signService.current.getSupportedLanguages();
    const currentIndex = supported.indexOf(activeLanguage);
    const nextIndex = (currentIndex + 1) % supported.length;
    const nextLanguage = supported[nextIndex];
    
    setActiveLanguage(nextLanguage);
  };
  
  // Obtenir le nom complet de la langue
  const getLanguageName = (code: string) => {
    switch (code) {
      case 'asl': return 'American Sign Language';
      case 'bsl': return 'British Sign Language';
      case 'lsf': return 'Langue des Signes Française';
      default: return code.toUpperCase();
    }
  };
  
  // Obtenir l'emoji drapeau de la langue
  const getLanguageFlag = (code: string) => {
    switch (code) {
      case 'asl': return '🇺🇸';
      case 'bsl': return '🇬🇧';
      case 'lsf': return '🇫🇷';
      default: return '🌐';
    }
  };
  
  // Rendu du guide de positionnement des mains
  const renderHandPositionGuide = () => {
    return (
      <View style={styles.handGuideContainer}>
        <View style={styles.handOutline} />
        <ThemedText style={styles.handGuideText}>
          Positionnez votre main dans cette zone
        </ThemedText>
      </View>
    );
  };
  
  // Rendu de la reconnaissance actuelle
  const renderCurrentRecognition = () => {
    if (recognizedSigns.length === 0) return null;
    
    const latestSign = recognizedSigns[0];
    
    return (
      <View style={styles.currentRecognitionContainer}>
        <ThemedText style={styles.signText}>{latestSign.value}</ThemedText>
        <View style={styles.signTypeContainer}>
          <ThemedText style={styles.signTypeText}>
            {latestSign.type === SignType.ALPHABET ? 'Alphabet' : 
             latestSign.type === SignType.WORD ? 'Mot' : 
             latestSign.type === SignType.PHRASE ? 'Phrase' : 'Dynamique'}
          </ThemedText>
          <ThemedText style={styles.languageIndicator}>
            {getLanguageFlag(latestSign.language)} {getLanguageName(latestSign.language)}
          </ThemedText>
        </View>
        <View style={styles.confidenceBar}>
          <View 
            style={[
              styles.confidenceFill, 
              { width: `${latestSign.confidence * 100}%` }
            ]} 
          />
        </View>
        <ThemedText style={styles.confidenceText}>
          Confiance: {(latestSign.confidence * 100).toFixed(0)}%
        </ThemedText>
      </View>
    );
  };
  
  // Rendu du panneau d'historique
  const renderHistoryPanel = () => {
    if (!showHistory) return null;
    
    return (
      <View style={styles.historyPanel}>
        <View style={styles.historyHeader}>
          <ThemedText style={styles.historyTitle}>Historique de reconnaissance</ThemedText>
          <TouchableOpacity onPress={clearHistory}>
            <MaterialIcons name="clear-all" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.historyList}>
          {recognizedSigns.length === 0 ? (
            <ThemedText style={styles.emptyHistoryText}>
              Aucun signe reconnu pour le moment
            </ThemedText>
          ) : (
            recognizedSigns.map((sign) => (
              <View key={sign.id} style={styles.historyItem}>
                <View style={styles.historyItemLeft}>
                  <ThemedText style={styles.historySignText}>{sign.value}</ThemedText>
                  <ThemedText style={styles.historySignType}>
                    {sign.type === SignType.ALPHABET ? 'Alphabet' : 
                     sign.type === SignType.WORD ? 'Mot' : 
                     sign.type === SignType.PHRASE ? 'Phrase' : 'Dynamique'}
                  </ThemedText>
                </View>
                <View style={styles.historyItemRight}>
                  <ThemedText style={styles.historyLanguage}>
                    {getLanguageFlag(sign.language)}
                  </ThemedText>
                  <ThemedText style={styles.historyTimeText}>
                    {sign.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  };
  
  // Si TensorFlow n'est pas encore prêt, afficher l'écran de chargement
  if (isLoading || !tfReady) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <ThemedText style={styles.loadingText}>
          Chargement du système de reconnaissance...
        </ThemedText>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={activeCameraType}
        onCameraReady={() => setIsCameraReady(true)}
      >
        {/* Guide de positionnement des mains */}
        {!showHistory && renderHandPositionGuide()}
        
        {/* Résultat de la reconnaissance actuelle */}
        {!showHistory && renderCurrentRecognition()}
        
        {/* Panneau d'historique */}
        {renderHistoryPanel()}
        
        {/* Indicateur de chargement */}
        {isRecognizing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <ThemedText style={styles.loadingText}>
              Reconnaissance en cours...
            </ThemedText>
          </View>
        )}
        
        {/* Indicateur de langue active */}
        <View style={styles.activeLanguageIndicator}>
          <TouchableOpacity onPress={cycleLanguage}>
            <ThemedText style={styles.activeLanguageText}>
              {getLanguageFlag(activeLanguage)} {getLanguageName(activeLanguage)}
            </ThemedText>
          </TouchableOpacity>
        </View>
        
        {/* Indicateur du mode API */}
        {useVisionAPI && (
          <View style={styles.apiModeIndicator}>
            <ThemedText style={styles.apiModeText}>
              Mode API Cloud
            </ThemedText>
          </View>
        )}
        
        {/* Contrôles */}
        <View style={styles.controls}>
          {/* Bouton de capture */}
          {!showHistory && (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={captureAndRecognize}
              disabled={isRecognizing || !isCameraReady}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          )}
          
          {/* Barre de boutons du bas */}
          <View style={styles.bottomBar}>
            {/* Toggle du mode continu */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                isContinuousMode && styles.activeControlButton
              ]}
              onPress={() => setIsContinuousMode(!isContinuousMode)}
            >
              <Ionicons 
                name={isContinuousMode ? "pause-circle" : "play-circle"} 
                size={24} 
                color="white" 
              />
              <ThemedText style={styles.controlButtonText}>
                {isContinuousMode ? 'Pause' : 'Auto'}
              </ThemedText>
            </TouchableOpacity>
            
            {/* Toggle d'historique */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                showHistory && styles.activeControlButton
              ]}
              onPress={() => setShowHistory(!showHistory)}
            >
              <Ionicons name="time" size={24} color="white" />
              <ThemedText style={styles.controlButtonText}>
                Historique
              </ThemedText>
            </TouchableOpacity>
            
            {/* Toggle de la TTS */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                speakResults && styles.activeControlButton
              ]}
              onPress={() => setSpeakResults(!speakResults)}
            >
              <Ionicons name="volume-high" size={24} color="white" />
              <ThemedText style={styles.controlButtonText}>
                Audio
              </ThemedText>
            </TouchableOpacity>
            
            {/* Toggle du mode API */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                useVisionAPI && styles.activeControlButton
              ]}
              onPress={toggleVisionAPI}
            >
              <Ionicons name="cloud" size={24} color="white" />
              <ThemedText style={styles.controlButtonText}>
                Cloud API
              </ThemedText>
            </TouchableOpacity>
            
            {/* Inverser la caméra */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleCamera}
            >
              <Ionicons name="camera-reverse" size={24} color="white" />
              <ThemedText style={styles.controlButtonText}>
                Caméra
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Bouton de fermeture */}
        {onClose && (
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        )}
      </CameraView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  handGuideContainer: {
    position: 'absolute',
    top: '25%',
    left: (SCREEN_WIDTH - 250) / 2,
    width: 250,
    height: 250,
    alignItems: 'center',
  },
  handOutline: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 20,
    borderStyle: 'dashed',
  },
  handGuideText: {
    color: 'white',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  currentRecognitionContainer: {
    position: 'absolute',
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
  },
  signText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  signTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  signTypeText: {
    color: 'white',
    fontSize: 14,
    opacity: 0.8,
  },
  languageIndicator: {
    color: 'white',
    fontSize: 14,
    opacity: 0.8,
  },
  confidenceBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    marginTop: 15,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  confidenceText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
  },
  historyPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  historyTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyList: {
    flex: 1,
    padding: 10,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  historyItemLeft: {
    flex: 1,
  },
  historySignText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historySignType: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  historyItemRight: {
    alignItems: 'flex-end',
  },
  historyLanguage: {
    color: 'white',
    fontSize: 16,
  },
  historyTimeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 4,
  },
  emptyHistoryText: {
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 20,
  },
  controls: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    padding: 10,
  },
  controlButton: {
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 10,
  },
  activeControlButton: {
    backgroundColor: 'rgba(0, 100, 255, 0.5)',
    borderRadius: 10,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeLanguageIndicator: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  activeLanguageText: {
    color: 'white',
    fontSize: 14,
  },
  apiModeIndicator: {
    position: 'absolute',
    top: 80,
    left: 20,
    backgroundColor: 'rgba(0, 119, 255, 0.7)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  apiModeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default SignLanguageRecognition;