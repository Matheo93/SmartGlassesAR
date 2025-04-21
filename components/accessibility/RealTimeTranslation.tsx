// components/accessibility/RealTimeTranslation.tsx - Version mise à jour
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  Alert
} from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import { TranslationService, DetectedText, useTranslation } from '../../services/TranslationService';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import ApiConfig from '../../services/ApiConfig';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

type RealTimeTranslationProps = {
  onClose?: () => void;
};

export const RealTimeTranslation: React.FC<RealTimeTranslationProps> = ({
  onClose,
}) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAutoTranslateEnabled, setIsAutoTranslateEnabled] = useState(false);
  const [detectedTexts, setDetectedTexts] = useState<DetectedText[]>([]);
  const [targetLanguage, setTargetLanguage] = useState('fr');
  const [error, setError] = useState<string | null>(null);
  
  // Custom hook pour la traduction
  const { isLoading, detectAndTranslate } = useTranslation();
  
  const cameraRef = useRef<CameraView | null>(null);
  const autoTranslateTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Language options
  const languages = [
    { code: 'fr', name: 'Français' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'de', name: 'Deutsch' },
  ];
  
  // Effet pour gérer le mode auto-traduction
  useEffect(() => {
    if (isAutoTranslateEnabled && !isTranslating) {
      autoTranslateTimerRef.current = setInterval(() => {
        captureAndTranslate();
      }, 3000); // Traduire toutes les 3 secondes
    } else if (autoTranslateTimerRef.current) {
      clearInterval(autoTranslateTimerRef.current);
      autoTranslateTimerRef.current = null;
    }
    
    return () => {
      if (autoTranslateTimerRef.current) {
        clearInterval(autoTranslateTimerRef.current);
      }
    };
  }, [isAutoTranslateEnabled, isTranslating, isCameraReady]);
  
  // Capture et traduction optimisée
  const captureAndTranslate = async () => {
    if (!cameraRef.current || !isCameraReady || isTranslating) return;
    
    try {
      // Vérifier le quota API si nécessaire
      if (!ApiConfig.trackApiCall('vision')) {
        console.warn('Vision API quota reached');
        if (isAutoTranslateEnabled) {
          // Désactiver auto-translate si quota atteint
          setIsAutoTranslateEnabled(false);
          Alert.alert('Limite API atteinte', 'Le mode automatique a été désactivé.');
        }
        return;
      }
      
      setIsTranslating(true);
      setError(null);
      
      // Prendre une photo
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        exif: false, // Pas besoin des données EXIF pour gagner en performance
      });
      
      if (!photo?.base64) {
        throw new Error('Image capture failed');
      }
      
      // Vérifier la taille de l'image - Vision API a des limites
      const base64Size = photo.base64.length * 0.75; // Estimation de la taille en octets
      if (base64Size > 10485760) { // 10MB max pour Vision API
        console.log('Image too large, reducing quality');
        // Réduire la qualité si nécessaire
        const resizedPhoto = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 1000 } }], // Réduire à une taille raisonnable
          { base64: true, compress: 0.6 }
        );
        
        // Utiliser le service de traduction avec l'image redimensionnée
        const results = await detectAndTranslate(resizedPhoto.base64 || '', targetLanguage);
        
        if (results.length > 0) {
          setDetectedTexts(results);
        } else {
          // Si aucun texte n'est détecté, afficher un message silencieux (pas d'alerte)
          console.log('No text detected in the image');
        }
      } else {
        // Utiliser le service de traduction directement
        const results = await detectAndTranslate(photo.base64, targetLanguage);
        
        if (results.length > 0) {
          setDetectedTexts(results);
        } else {
          // Si aucun texte n'est détecté, afficher un message silencieux (pas d'alerte)
          console.log('No text detected in the image');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      
      // N'afficher l'alerte que pour les erreurs importantes
      if (message.includes('API') || message.includes('network')) {
        Alert.alert('Translation Error', message);
      } else {
        console.error('Translation error:', err);
      }
    } finally {
      setIsTranslating(false);
    }
  };
  
  // Changer la langue cible
  const cycleLanguage = () => {
    const currentIndex = languages.findIndex(lang => lang.code === targetLanguage);
    const nextIndex = (currentIndex + 1) % languages.length;
    setTargetLanguage(languages[nextIndex].code);
  };
  
  // Rendu des traductions
  const renderTranslationOverlays = () => {
    if (detectedTexts.length === 0) return null;
    
    return detectedTexts.map((item, index) => {
      // Convertir les coordonnées normalisées en pixels d'écran
      const scaledBox = {
        x: (item.boundingBox.x / 1000) * SCREEN_WIDTH,
        y: (item.boundingBox.y / 1000) * SCREEN_HEIGHT,
        width: (item.boundingBox.width / 1000) * SCREEN_WIDTH,
        height: (item.boundingBox.height / 1000) * SCREEN_HEIGHT,
      };
      
      return (
        <View
          key={`translation-${index}`}
          style={[
            styles.translationOverlay,
            {
              left: scaledBox.x,
              top: scaledBox.y,
              width: scaledBox.width,
              minHeight: scaledBox.height,
            },
          ]}
        >
          <ThemedText style={styles.translationText}>
            {item.translatedText || item.text}
          </ThemedText>
        </View>
      );
    });
  };
  
  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={'back' as CameraType}
        onCameraReady={() => setIsCameraReady(true)}
      >
        {/* Translation overlays */}
        {renderTranslationOverlays()}
        
        {/* Loading indicator */}
        {isTranslating && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <ThemedText style={styles.loadingText}>Translating...</ThemedText>
          </View>
        )}
        
        {/* Active language indicator */}
        <View style={styles.languageIndicator}>
          <TouchableOpacity onPress={cycleLanguage}>
            <ThemedText style={styles.languageText}>
              Target: {languages.find(l => l.code === targetLanguage)?.name || 'Unknown'}
            </ThemedText>
          </TouchableOpacity>
        </View>
        
        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={captureAndTranslate}
            disabled={isTranslating}
          >
            <ThemedText style={styles.buttonText}>
              {isTranslating ? 'Translating...' : 'Translate'}
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.button, 
              isAutoTranslateEnabled && styles.activeButton
            ]} 
            onPress={() => setIsAutoTranslateEnabled(!isAutoTranslateEnabled)}
          >
            <ThemedText style={styles.buttonText}>
              {isAutoTranslateEnabled ? 'Disable Auto' : 'Enable Auto'}
            </ThemedText>
          </TouchableOpacity>
          
          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
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
  controls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  button: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  activeButton: {
    backgroundColor: 'rgba(0, 100, 255, 0.7)',
  },
  closeButton: {
    position: 'absolute',
    top: -50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: 10,
    borderRadius: 5,
  },
  translationOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFDD00',
  },
  translationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  languageIndicator: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  languageText: {
    color: 'white',
    fontSize: 14,
  },
});

export default RealTimeTranslation;