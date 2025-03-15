// components/accessibility/RealTimeTranslation.tsx
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

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

type DetectedText = {
  text: string;
  translatedText: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

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
  
  const cameraRef = useRef<CameraView | null>(null);
  
  // Language options
  const languages = [
    { code: 'fr', name: 'Français' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'de', name: 'Deutsch' },
  ];

  // Mock translation function (to be replaced with actual API call)
  const translateText = async (imageBase64: string): Promise<DetectedText[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock detection results - in a real app, this would come from a vision API
    return [
      {
        text: "Hello, how are you?",
        translatedText: "Bonjour, comment allez-vous ?",
        boundingBox: {
          x: 100,
          y: 150,
          width: 200,
          height: 50
        }
      },
      {
        text: "Exit",
        translatedText: "Sortie",
        boundingBox: {
          x: 300,
          y: 250,
          width: 80,
          height: 40
        }
      }
    ];
  };
  
  // Capture and translate
  const captureAndTranslate = async () => {
    if (!cameraRef.current || !isCameraReady || isTranslating) return;
    
    try {
      setIsTranslating(true);
      setError(null);
      
      // Take a photo
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });
      
      if (!photo?.base64) {
        throw new Error('Image capture failed');
      }
      
      // Call translation service
      const results = await translateText(photo.base64);
      setDetectedTexts(results);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      Alert.alert('Translation Error', message);
    } finally {
      setIsTranslating(false);
    }
  };
  
  // Auto translation timer
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (isAutoTranslateEnabled && !isTranslating) {
      intervalId = setInterval(captureAndTranslate, 3000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoTranslateEnabled, isTranslating, isCameraReady]);
  
  // Change target language
  const cycleLanguage = () => {
    const currentIndex = languages.findIndex(lang => lang.code === targetLanguage);
    const nextIndex = (currentIndex + 1) % languages.length;
    setTargetLanguage(languages[nextIndex].code);
  };
  
  // Render translation overlays
  const renderTranslationOverlays = () => {
    if (detectedTexts.length === 0) return null;
    
    return detectedTexts.map((item, index) => {
      // Scale bounding box to screen dimensions
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
            {item.translatedText}
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