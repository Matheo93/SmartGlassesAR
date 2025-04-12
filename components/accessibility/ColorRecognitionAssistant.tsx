// components/accessibility/ColorRecognitionAssistant.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  Alert,
  Platform,
  Switch,
  ScrollView,
  Image
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
// Note: expo-image-manipulator needs to be installed
// npm install expo-image-manipulator
import * as ImageManipulator from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// Window dimensions
const WINDOW_WIDTH = Dimensions.get('window').width;
const WINDOW_HEIGHT = Dimensions.get('window').height;

// Color types by deficiency
enum ColorDeficiencyType {
  NORMAL = 'normal',
  PROTANOPIA = 'protanopia', // Red-blind
  DEUTERANOPIA = 'deuteranopia', // Green-blind
  TRITANOPIA = 'tritanopia', // Blue-blind
  FULL_COLOR_BLIND = 'full_color_blind' // Monochromacy
}

// Color analysis result
interface ColorAnalysis {
  dominantColor: string;
  colorName: string;
  hexCode: string;
  rgb: { r: number; g: number; b: number };
  timestamp: Date;
  confidence: number;
  position?: { x: number; y: number };
}

// Color palette for reference
interface ColorPalette {
  [key: string]: {
    hexCode: string;
    rgb: { r: number; g: number; b: number };
    alternativeDescription?: string;
  };
}

// Common color palette with alternative descriptions for color blind users
const COLOR_PALETTE: ColorPalette = {
  'red': { 
    hexCode: '#FF0000', 
    rgb: { r: 255, g: 0, b: 0 },
    alternativeDescription: 'the color of stop signs and fire engines'
  },
  'orange': { 
    hexCode: '#FFA500', 
    rgb: { r: 255, g: 165, b: 0 },
    alternativeDescription: 'the color of oranges and pumpkins'
  },
  'yellow': { 
    hexCode: '#FFFF00', 
    rgb: { r: 255, g: 255, b: 0 },
    alternativeDescription: 'the color of lemons and sunflowers'
  },
  'green': { 
    hexCode: '#008000', 
    rgb: { r: 0, g: 128, b: 0 },
    alternativeDescription: 'the color of leaves and grass'
  },
  'blue': { 
    hexCode: '#0000FF', 
    rgb: { r: 0, g: 0, b: 255 },
    alternativeDescription: 'the color of the sky and oceans'
  },
  'purple': { 
    hexCode: '#800080', 
    rgb: { r: 128, g: 0, b: 128 },
    alternativeDescription: 'the color of grapes and eggplants'
  },
  'pink': { 
    hexCode: '#FFC0CB', 
    rgb: { r: 255, g: 192, b: 203 },
    alternativeDescription: 'a light reddish color like cotton candy'
  },
  'brown': { 
    hexCode: '#A52A2A', 
    rgb: { r: 165, g: 42, b: 42 },
    alternativeDescription: 'the color of chocolate and wood'
  },
  'black': { 
    hexCode: '#000000', 
    rgb: { r: 0, g: 0, b: 0 },
    alternativeDescription: 'the darkest color, like night sky'
  },
  'white': { 
    hexCode: '#FFFFFF', 
    rgb: { r: 255, g: 255, b: 255 },
    alternativeDescription: 'the lightest color, like snow'
  },
  'gray': { 
    hexCode: '#808080', 
    rgb: { r: 128, g: 128, b: 128 },
    alternativeDescription: 'a neutral color between black and white'
  }
};

// Component props
interface ColorRecognitionAssistantProps {
  onClose?: () => void;
  initialDeficiencyType?: ColorDeficiencyType;
}

// Main component
export const ColorRecognitionAssistant: React.FC<ColorRecognitionAssistantProps> = ({
  onClose,
  initialDeficiencyType = ColorDeficiencyType.NORMAL
}) => {
  // Camera state
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  
  // Color recognition state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [colorAnalysis, setColorAnalysis] = useState<ColorAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<ColorAnalysis[]>([]);
  const [continuousMode, setContinuousMode] = useState(false);
  const [showColorDetails, setShowColorDetails] = useState(false);
  
  // Settings state
  const [deficiencyType, setDeficiencyType] = useState<ColorDeficiencyType>(initialDeficiencyType);
  const [useVoiceFeedback, setUseVoiceFeedback] = useState(true);
  const [includeLightness, setIncludeLightness] = useState(true);
  const [showRgbValues, setShowRgbValues] = useState(false);
  const [useAlternativeDescriptions, setUseAlternativeDescriptions] = useState(true);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);
  
  // Touch position for targeted color analysis
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Refs
  const cameraRef = useRef<CameraView | null>(null);
  const continuousTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Request camera permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (!permission?.granted) {
        await requestPermission();
      }
    };
    checkPermission();
    
    return () => {
      if (continuousTimerRef.current) {
        clearInterval(continuousTimerRef.current);
      }
      
      const stopSpeech = async () => {
        const isSpeaking = await Speech.isSpeakingAsync();
        if (isSpeaking) {
          Speech.stop();
        }
      };
      
      stopSpeech();
    };
  }, []);
  
  // Handle continuous mode changes
  useEffect(() => {
    if (continuousMode) {
      startContinuousAnalysis();
    } else {
      stopContinuousAnalysis();
    }
    
    return () => {
      stopContinuousAnalysis();
    };
  }, [continuousMode]);
  
  // Start continuous color analysis
  const startContinuousAnalysis = () => {
    if (continuousTimerRef.current) {
      clearInterval(continuousTimerRef.current);
    }
    
    continuousTimerRef.current = setInterval(() => {
      if (cameraReady && !isAnalyzing) {
        analyzeColor();
      }
    }, 3000); // Every 3 seconds
  };
  
  // Stop continuous analysis
  const stopContinuousAnalysis = () => {
    if (continuousTimerRef.current) {
      clearInterval(continuousTimerRef.current);
      continuousTimerRef.current = null;
    }
  };
  
  // Toggle continuous mode
  const toggleContinuousMode = () => {
    setContinuousMode(!continuousMode);
  };
  
  // Toggle camera type
  const toggleCameraType = () => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  };
  
  // Analyze color from camera feed
  const analyzeColor = async () => {
    if (!cameraRef.current || !cameraReady || isAnalyzing) return;
    
    try {
      setIsAnalyzing(true);
      
      // Take a photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7
      });
      
      if (!photo || !photo.uri) {
        throw new Error('Failed to capture image');
      }
      
      setLastCapturedImage(photo.uri);
      
      // Resize image for faster processing
      const manipResult = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 300 } }],
        { format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // In a real app, we would send the image to an API for color analysis
      // Here we'll simulate the color recognition
      const result = await simulateColorAnalysis(manipResult.uri, touchPosition);
      
      // Update state with result
      setColorAnalysis(result);
      
      // Add to history
      setAnalysisHistory(prev => [result, ...prev].slice(0, 20));
      
      // Provide feedback
      if (useVoiceFeedback) {
        await provideVoiceFeedback(result);
      }
      
      // Haptic feedback
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setIsAnalyzing(false);
      
      // Reset touch position after analysis
      setTouchPosition(null);
    } catch (error) {
      console.error('Error analyzing color:', error);
      setIsAnalyzing(false);
      
      // Reset touch position on error
      setTouchPosition(null);
      
      Alert.alert('Error', 'Failed to analyze color');
    }
  };
  
  // Simulate color analysis (in a real app, this would use computer vision)
  const simulateColorAnalysis = async (imageUri: string, position: { x: number; y: number } | null): Promise<ColorAnalysis> => {
    // In a real app, we would:
    // 1. Extract the dominant color or the color at the touch position
    // 2. Map the RGB values to the closest named color
    // 3. Calculate confidence based on how close the match is
    
    // For demo purposes, randomly select a color from our palette
    const colorNames = Object.keys(COLOR_PALETTE);
    const randomIndex = Math.floor(Math.random() * colorNames.length);
    const colorName = colorNames[randomIndex];
    const colorInfo = COLOR_PALETTE[colorName];
    
    // Create a result with the selected color
    const result: ColorAnalysis = {
      dominantColor: colorName,
      colorName: colorName,
      hexCode: colorInfo.hexCode,
      rgb: { ...colorInfo.rgb },
      timestamp: new Date(),
      confidence: 0.7 + Math.random() * 0.3, // Random confidence between 0.7 and 1.0
    };
    
    // If position was provided, include it
    if (position) {
      result.position = position;
    }
    
    return result;
  };
  
  // Provide voice feedback about the detected color
  const provideVoiceFeedback = async (analysis: ColorAnalysis) => {
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
    }
    
    let message = `The color is ${analysis.colorName}`;
    
    // Add alternative description if needed
    if (useAlternativeDescriptions && deficiencyType !== ColorDeficiencyType.NORMAL) {
      const description = COLOR_PALETTE[analysis.colorName]?.alternativeDescription;
      if (description) {
        message += `, ${description}`;
      }
    }
    
    // Add lightness information if requested
    if (includeLightness) {
      const { r, g, b } = analysis.rgb;
      const brightness = Math.round((r + g + b) / 3);
      
      if (brightness < 85) {
        message += ', which is dark';
      } else if (brightness > 170) {
        message += ', which is light';
      } else {
        message += ', which is medium brightness';
      }
    }
    
    // Add RGB values if requested
    if (showRgbValues) {
      const { r, g, b } = analysis.rgb;
      message += `. RGB values are: ${r}, ${g}, ${b}`;
    }
    
    await Speech.speak(message, {
      rate: 0.9,
      pitch: 1.0
    });
  };
  
  // Handle camera screen touch for targeted color analysis
  const handleCameraTouch = (event: any) => {
    if (isAnalyzing || continuousMode) return;
    
    // Get touch position relative to screen
    const { locationX, locationY } = event.nativeEvent;
    
    // Convert to percentages for consistent positioning across devices
    const x = (locationX / WINDOW_WIDTH) * 100;
    const y = (locationY / WINDOW_HEIGHT) * 100;
    
    setTouchPosition({ x, y });
    
    // Trigger analysis after setting touch position
    setTimeout(analyzeColor, 100);
  };
  
  // Render color details card
  const renderColorDetails = () => {
    if (!colorAnalysis) return null;
    
    const { colorName, hexCode, rgb, confidence } = colorAnalysis;
    
    return (
      <View style={styles.colorDetailsCard}>
        <View style={styles.colorDetailsHeader}>
          <ThemedText style={styles.colorDetailsTitle}>
            Color Details
          </ThemedText>
          <TouchableOpacity
            style={styles.closeDetailsButton}
            onPress={() => setShowColorDetails(false)}
          >
            <Ionicons name="close" size={20} color="#777" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.colorSwatch}>
          <View
            style={[
              styles.colorSwatchInner,
              { backgroundColor: hexCode }
            ]}
          />
        </View>
        
        <View style={styles.colorInfo}>
          <View style={styles.colorInfoRow}>
            <ThemedText style={styles.colorInfoLabel}>Color Name:</ThemedText>
            <ThemedText style={styles.colorInfoValue}>{colorName}</ThemedText>
          </View>
          
          <View style={styles.colorInfoRow}>
            <ThemedText style={styles.colorInfoLabel}>Hex Code:</ThemedText>
            <ThemedText style={styles.colorInfoValue}>{hexCode}</ThemedText>
          </View>
          
          <View style={styles.colorInfoRow}>
            <ThemedText style={styles.colorInfoLabel}>RGB Values:</ThemedText>
            <ThemedText style={styles.colorInfoValue}>
              {rgb.r}, {rgb.g}, {rgb.b}
            </ThemedText>
          </View>
          
          <View style={styles.colorInfoRow}>
            <ThemedText style={styles.colorInfoLabel}>Confidence:</ThemedText>
            <ThemedText style={styles.colorInfoValue}>
              {Math.round(confidence * 100)}%
            </ThemedText>
          </View>
          
          {useAlternativeDescriptions && COLOR_PALETTE[colorName]?.alternativeDescription && (
            <View style={styles.colorInfoRow}>
              <ThemedText style={styles.colorInfoLabel}>Description:</ThemedText>
              <ThemedText style={styles.colorInfoValue}>
                {COLOR_PALETTE[colorName].alternativeDescription}
              </ThemedText>
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.speakColorButton}
          onPress={() => provideVoiceFeedback(colorAnalysis)}
        >
          <Ionicons name="volume-high" size={18} color="white" />
          <ThemedText style={styles.speakColorButtonText}>Speak Color</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Render color history
  const renderColorHistory = () => {
    if (analysisHistory.length === 0) return null;
    
    return (
      <View style={styles.colorHistoryContainer}>
        <ThemedText style={styles.colorHistoryTitle}>Recent Colors</ThemedText>
        
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.colorHistoryScroll}
          contentContainerStyle={styles.colorHistoryContent}
        >
          {analysisHistory.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.colorHistoryItem}
              onPress={() => {
                setColorAnalysis(item);
                setShowColorDetails(true);
              }}
            >
              <View
                style={[
                  styles.colorHistorySwatch,
                  { backgroundColor: item.hexCode }
                ]}
              />
              <ThemedText style={styles.colorHistoryName}>{item.colorName}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };
  
  // Render settings panel
  const renderSettings = () => {
    return (
      <View style={styles.settingsPanel}>
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="options" size={20} color="#2196F3" />
            <ThemedText style={styles.settingLabel}>Color Deficiency Type</ThemedText>
          </View>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.deficiencyTypeScroll}
          >
            {Object.values(ColorDeficiencyType).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.deficiencyTypeButton,
                  deficiencyType === type && styles.activeDeficiencyTypeButton
                ]}
                onPress={() => setDeficiencyType(type)}
              >
                <ThemedText style={[
                  styles.deficiencyTypeText,
                  deficiencyType === type && styles.activeDeficiencyTypeText
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="volume-high" size={20} color="#2196F3" />
            <ThemedText style={styles.settingLabel}>Voice Feedback</ThemedText>
          </View>
          <Switch
            value={useVoiceFeedback}
            onValueChange={setUseVoiceFeedback}
            trackColor={{ false: '#767577', true: '#81D4FA' }}
            thumbColor={useVoiceFeedback ? '#2196F3' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="contrast" size={20} color="#2196F3" />
            <ThemedText style={styles.settingLabel}>Include Lightness Info</ThemedText>
          </View>
          <Switch
            value={includeLightness}
            onValueChange={setIncludeLightness}
            trackColor={{ false: '#767577', true: '#81D4FA' }}
            thumbColor={includeLightness ? '#2196F3' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="code-working" size={20} color="#2196F3" />
            <ThemedText style={styles.settingLabel}>Show RGB Values</ThemedText>
          </View>
          <Switch
            value={showRgbValues}
            onValueChange={setShowRgbValues}
            trackColor={{ false: '#767577', true: '#81D4FA' }}
            thumbColor={showRgbValues ? '#2196F3' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="text" size={20} color="#2196F3" />
            <ThemedText style={styles.settingLabel}>Use Descriptive Language</ThemedText>
          </View>
          <Switch
            value={useAlternativeDescriptions}
            onValueChange={setUseAlternativeDescriptions}
            trackColor={{ false: '#767577', true: '#81D4FA' }}
            thumbColor={useAlternativeDescriptions ? '#2196F3' : '#f4f3f4'}
          />
        </View>
      </View>
    );
  };
  
  // Render color target marker
  const renderColorTargetMarker = () => {
    if (!touchPosition) return null;
    
    return (
      <View
        style={[
          styles.colorTargetMarker,
          {
            left: `${touchPosition.x}%`,
            top: `${touchPosition.y}%`,
          }
        ]}
      >
        <View style={styles.colorTargetInner} />
      </View>
    );
  };
  
  // If camera permission not granted
  if (!permission?.granted) {
    return (
      <ThemedView style={styles.permissionContainer}>
        <Ionicons name="alert-circle" size={64} color="#F44336" />
        <ThemedText style={styles.permissionText}>
          Camera permission is required for color recognition
        </ThemedText>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <ThemedText style={styles.permissionButtonText}>
            Grant Permission
          </ThemedText>
        </TouchableOpacity>
        
        {onClose && (
          <TouchableOpacity
            style={[styles.permissionButton, styles.closeButton]}
            onPress={onClose}
          >
            <ThemedText style={styles.permissionButtonText}>
              Close
            </ThemedText>
          </TouchableOpacity>
        )}
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      {/* Camera view or captured image */}
      {lastCapturedImage && showColorDetails ? (
        <Image
          source={{ uri: lastCapturedImage }}
          style={styles.capturedImage}
          resizeMode="cover"
        />
      ) : (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={cameraType}
          onCameraReady={() => setCameraReady(true)}
          onTouchEnd={handleCameraTouch}
        >
          {/* Color target marker */}
          {renderColorTargetMarker()}
          
          {/* Instructions overlay when no color is detected */}
          {!colorAnalysis && !isAnalyzing && (
            <View style={styles.instructionsOverlay}>
              <ThemedText style={styles.instructionsText}>
                Tap anywhere on the screen to identify a color, or press the button below
              </ThemedText>
            </View>
          )}
          
          {/* Color result overlay */}
          {colorAnalysis && !showColorDetails && (
            <View style={styles.colorResultOverlay}>
              <View
                style={[
                  styles.colorResultSwatch,
                  { backgroundColor: colorAnalysis.hexCode }
                ]}
              />
              <View style={styles.colorResultTextContainer}>
                <ThemedText style={styles.colorResultName}>
                  {colorAnalysis.colorName}
                </ThemedText>
                <TouchableOpacity
                  style={styles.showDetailsButton}
                  onPress={() => setShowColorDetails(true)}
                >
                  <ThemedText style={styles.showDetailsButtonText}>
                    Show Details
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Loading indicator */}
          {isAnalyzing && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <ThemedText style={styles.loadingText}>
                  Analyzing color...
                </ThemedText>
              </View>
            </View>
          )}
        </CameraView>
      )}
      
      {/* Color details card */}
      {showColorDetails && renderColorDetails()}
      
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Color Recognition</ThemedText>
        
        {/* Color deficiency type indicator */}
        {deficiencyType !== ColorDeficiencyType.NORMAL && (
          <View style={styles.deficiencyIndicator}>
            <MaterialIcons name="visibility" size={16} color="#FF9800" />
            <ThemedText style={styles.deficiencyIndicatorText}>
              {deficiencyType}
            </ThemedText>
          </View>
        )}
        
        {/* Settings button */}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => {
            if (showColorDetails) {
              setShowColorDetails(false);
            } else {
              renderSettings();
              Alert.alert('Settings', '', [
                { text: 'Close Settings', onPress: () => {} }
              ]);
            }
          }}
        >
          <Ionicons name="settings-outline" size={24} color="#777" />
        </TouchableOpacity>
        
        {/* Close button */}
        {onClose && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Color history */}
      {!showColorDetails && renderColorHistory()}
      
      {/* Bottom controls */}
      {!showColorDetails && (
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleCameraType}
          >
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.captureButton,
              isAnalyzing && styles.disabledButton
            ]}
            onPress={analyzeColor}
            disabled={isAnalyzing || !cameraReady}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.controlButton,
              continuousMode && styles.activeControlButton
            ]}
            onPress={toggleContinuousMode}
          >
            <Ionicons name="infinite" size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}
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
  capturedImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#9E9E9E',
    marginTop: 10,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  deficiencyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 10,
  },
  deficiencyIndicatorText: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
    marginLeft: 5,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  settingsPanel: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingRow: {
    marginBottom: 15,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 10,
  },
  deficiencyTypeScroll: {
    flexDirection: 'row',
  },
  deficiencyTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  activeDeficiencyTypeButton: {
    backgroundColor: '#2196F3',
  },
  deficiencyTypeText: {
    fontSize: 14,
  },
  activeDeficiencyTypeText: {
    color: 'white',
    fontWeight: '500',
  },
  instructionsOverlay: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  instructionsText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
  colorResultOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorResultSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  colorResultTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  colorResultName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  showDetailsButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2196F3',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginTop: 5,
  },
  showDetailsButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  colorTargetMarker: {
    position: 'absolute',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorTargetInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'white',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  colorDetailsCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  colorDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  colorDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeDetailsButton: {
    padding: 5,
  },
  colorSwatch: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 10,
    padding: 5,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 20,
  },
  colorSwatchInner: {
    flex: 1,
    borderRadius: 5,
  },
  colorInfo: {
    marginBottom: 20,
  },
  colorInfoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  colorInfoLabel: {
    width: 120,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  colorInfoValue: {
    flex: 1,
    fontSize: 14,
  },
  speakColorButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 5,
  },
  speakColorButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  colorHistoryContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 10,
  },
  colorHistoryTitle: {
    paddingHorizontal: 20,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  colorHistoryScroll: {
    paddingHorizontal: 10,
  },
  colorHistoryContent: {
    paddingHorizontal: 10,
  },
  colorHistoryItem: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  colorHistorySwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 5,
  },
  colorHistoryName: {
    fontSize: 12,
  },
  controls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeControlButton: {
    backgroundColor: '#4CAF50',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default ColorRecognitionAssistant;