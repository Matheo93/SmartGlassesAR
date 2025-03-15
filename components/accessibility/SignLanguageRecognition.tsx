// components/accessibility/SignLanguageRecognition.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Dimensions 
} from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;

type SignLanguageRecognitionProps = {
  onClose?: () => void;
};

type RecognizedSign = {
  sign: string;
  translation: string;
  confidence: number;
  timestamp: Date;
};

export const SignLanguageRecognition: React.FC<SignLanguageRecognitionProps> = ({
  onClose,
}) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [recognizedSigns, setRecognizedSigns] = useState<RecognizedSign[]>([]);
  const [activeCameraType, setActiveCameraType] = useState<CameraType>('front');
  const [showHistory, setShowHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const cameraRef = useRef<CameraView | null>(null);
  
  // Mock sign language recognition
  const recognizeSign = async (): Promise<RecognizedSign | null> => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock recognition results - in a real app, this would come from a machine learning model
    const signs = [
      { sign: "Hello", translation: "Bonjour", confidence: 0.92 },
      { sign: "Thank you", translation: "Merci", confidence: 0.88 },
      { sign: "Please", translation: "S'il vous plaît", confidence: 0.85 },
      { sign: "Yes", translation: "Oui", confidence: 0.95 },
      { sign: "No", translation: "Non", confidence: 0.91 },
      { sign: "Help", translation: "Aide", confidence: 0.87 }
    ];
    
    // Randomly select a sign for demo purposes
    const randomSign = signs[Math.floor(Math.random() * signs.length)];
    
    return {
      ...randomSign,
      timestamp: new Date()
    };
  };
  
  // Capture and recognize
  const captureAndRecognize = async () => {
    if (!cameraRef.current || !isCameraReady || isRecognizing) return;
    
    try {
      setIsRecognizing(true);
      
      // Take a photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      
      // Recognize sign (in a real app, we would send the photo to a model)
      const result = await recognizeSign();
      
      if (result) {
        // Add to history
        setRecognizedSigns(prev => [result, ...prev]);
      }
      
    } catch (err) {
      console.error('Error recognizing sign:', err);
    } finally {
      setIsRecognizing(false);
    }
  };
  
  // Continuous recognition mode
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (isContinuousMode && !isRecognizing) {
      intervalId = setInterval(captureAndRecognize, 3000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isContinuousMode, isRecognizing, isCameraReady]);
  
  // Flip camera
  const toggleCamera = () => {
    setActiveCameraType(current => (current === 'front' ? 'back' : 'front'));
  };
  
  // Clear history
  const clearHistory = () => {
    setRecognizedSigns([]);
  };
  
  // Render hand position guide
  const renderHandPositionGuide = () => {
    return (
      <View style={styles.handGuideContainer}>
        <View style={styles.handOutline} />
        <ThemedText style={styles.handGuideText}>
          Position your hand in this area
        </ThemedText>
      </View>
    );
  };
  
  // Render current recognition
  const renderCurrentRecognition = () => {
    if (recognizedSigns.length === 0) return null;
    
    const latestSign = recognizedSigns[0];
    
    return (
      <View style={styles.currentRecognitionContainer}>
        <ThemedText style={styles.signText}>{latestSign.sign}</ThemedText>
        <ThemedText style={styles.translationText}>
          "{latestSign.translation}"
        </ThemedText>
        <View style={styles.confidenceBar}>
          <View 
            style={[
              styles.confidenceFill, 
              { width: `${latestSign.confidence * 100}%` }
            ]} 
          />
        </View>
        <ThemedText style={styles.confidenceText}>
          Confidence: {(latestSign.confidence * 100).toFixed(0)}%
        </ThemedText>
      </View>
    );
  };
  
  // Render history panel
  const renderHistoryPanel = () => {
    if (!showHistory) return null;
    
    return (
      <View style={styles.historyPanel}>
        <View style={styles.historyHeader}>
          <ThemedText style={styles.historyTitle}>Recognition History</ThemedText>
          <TouchableOpacity onPress={clearHistory}>
            <MaterialIcons name="clear-all" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.historyList}>
          {recognizedSigns.length === 0 ? (
            <ThemedText style={styles.emptyHistoryText}>
              No signs recognized yet
            </ThemedText>
          ) : (
            recognizedSigns.map((sign, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyItemLeft}>
                  <ThemedText style={styles.historySignText}>{sign.sign}</ThemedText>
                  <ThemedText style={styles.historyTranslationText}>
                    {sign.translation}
                  </ThemedText>
                </View>
                <ThemedText style={styles.historyTimeText}>
                  {sign.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </ThemedText>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={activeCameraType}
        onCameraReady={() => setIsCameraReady(true)}
      >
        {/* Hand positioning guide */}
        {!showHistory && renderHandPositionGuide()}
        
        {/* Current recognition result */}
        {!showHistory && renderCurrentRecognition()}
        
        {/* History panel */}
        {renderHistoryPanel()}
        
        {/* Loading indicator */}
        {isRecognizing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <ThemedText style={styles.loadingText}>
              Recognizing sign...
            </ThemedText>
          </View>
        )}
        
        {/* Controls */}
        <View style={styles.controls}>
          {/* Capture button */}
          {!showHistory && (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={captureAndRecognize}
              disabled={isRecognizing || !isCameraReady}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          )}
          
          {/* Bottom button bar */}
          <View style={styles.bottomBar}>
            {/* Toggle continuous mode */}
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
            
            {/* Toggle history */}
            <TouchableOpacity
              style={[
                styles.controlButton,
                showHistory && styles.activeControlButton
              ]}
              onPress={() => setShowHistory(!showHistory)}
            >
              <Ionicons name="time" size={24} color="white" />
              <ThemedText style={styles.controlButtonText}>
                History
              </ThemedText>
            </TouchableOpacity>
            
            {/* Flip camera */}
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleCamera}
            >
              <Ionicons name="camera-reverse" size={24} color="white" />
              <ThemedText style={styles.controlButtonText}>
                Flip
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Close button */}
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
  translationText: {
    color: 'white',
    fontSize: 18,
    marginTop: 8,
    fontStyle: 'italic',
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
  historyTranslationText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  historyTimeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
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
});

export default SignLanguageRecognition;