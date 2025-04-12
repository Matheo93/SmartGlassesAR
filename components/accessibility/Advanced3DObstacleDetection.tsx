// components/accessibility/Advanced3DObstacleDetection.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
    View, 
    StyleSheet, 
    TouchableOpacity,
    Switch,
    Alert,
    Platform,
    Dimensions
} from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BluetoothService, HapticFeedbackType } from '../../services/BluetoothService';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';

// Define obstacle types and their priorities
enum ObstacleType {
  PERSON = 'person',
  VEHICLE = 'vehicle',
  STAIRS = 'stairs',
  HOLE = 'hole',
  DOOR = 'door',
  POLE = 'pole',
  WALL = 'wall',
  FURNITURE = 'furniture',
  ANIMAL = 'animal',
  UNKNOWN = 'unknown'
}

// Priorities for different obstacle types (higher = more important)
const OBSTACLE_PRIORITIES: Record<ObstacleType, number> = {
  [ObstacleType.PERSON]: 10,
  [ObstacleType.VEHICLE]: 9,
  [ObstacleType.HOLE]: 8,
  [ObstacleType.STAIRS]: 7,
  [ObstacleType.ANIMAL]: 6,
  [ObstacleType.POLE]: 5,
  [ObstacleType.DOOR]: 4,
  [ObstacleType.WALL]: 3,
  [ObstacleType.FURNITURE]: 2,
  [ObstacleType.UNKNOWN]: 1
};

// Interface for detected obstacles
interface Obstacle {
  type: ObstacleType;
  distance: number; // in meters
  direction: 'left' | 'center' | 'right';
  size: 'small' | 'medium' | 'large';
  confidence: number; // 0-1
}

// Component props
interface Advanced3DObstacleDetectionProps {
  onClose?: () => void;
  wheelchairMode?: boolean;
}

export const Advanced3DObstacleDetection: React.FC<Advanced3DObstacleDetectionProps> = ({
  onClose,
  wheelchairMode = false
}) => {
  // Camera state
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  
  // Detection state
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedObstacles, setDetectedObstacles] = useState<Obstacle[]>([]);
  const [processingFrames, setProcessingFrames] = useState(false);
  
  // Settings state
  const [detectionDistance, setDetectionDistance] = useState(5); // meters
  const [detectionFrequency, setDetectionFrequency] = useState(1000); // ms
  const [voiceAlerts, setVoiceAlerts] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showObstacleVisualization, setShowObstacleVisualization] = useState(true);
  
  // Service and timer refs
  const bluetoothService = useRef(BluetoothService.getInstance());
  const detectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const cameraRef = useRef<any>(null);
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  
  // Effect to start/stop detection
  useEffect(() => {
    if (isDetecting) {
      startObstacleDetection();
    } else {
      stopObstacleDetection();
    }
    
    return () => {
      stopObstacleDetection();
    };
  }, [isDetecting, detectionFrequency]);
  
  // Start obstacle detection
  const startObstacleDetection = () => {
    if (detectionTimerRef.current) {
      clearInterval(detectionTimerRef.current);
    }
    
    detectionTimerRef.current = setInterval(() => {
      if (!processingFrames && cameraReady && cameraRef.current) {
        detectObstacles();
      }
    }, detectionFrequency);
  };
  
  // Stop obstacle detection
  const stopObstacleDetection = () => {
    if (detectionTimerRef.current) {
      clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
  };
  
  // Toggle obstacle detection
  const toggleDetection = () => {
    setIsDetecting(!isDetecting);
  };
  
  // Detect obstacles from camera feed
  // This is a mock implementation - in a real app, it would use ML models like TensorFlow
  const detectObstacles = async () => {
    try {
      setProcessingFrames(true);
      
      // In a real implementation, take a picture and process it with ML
      // For demo, generate mock obstacles
      const mockObstacles = generateMockObstacles();
      
      // Sort obstacles by priority and distance
      const sortedObstacles = sortObstaclesByPriority(mockObstacles);
      
      // Update state with detected obstacles
      setDetectedObstacles(sortedObstacles);
      
      // Alert about the most critical obstacle
      if (sortedObstacles.length > 0) {
        const criticalObstacle = sortedObstacles[0];
        alertObstacle(criticalObstacle);
      }
      
      setProcessingFrames(false);
    } catch (error) {
      console.error('Error detecting obstacles:', error);
      setProcessingFrames(false);
    }
  };
  
  // Generate mock obstacles for demonstration
  const generateMockObstacles = (): Obstacle[] => {
    // For demo purposes, randomly generate obstacles
    const obstacleCount = Math.floor(Math.random() * 3) + 1; // 1-3 obstacles
    const obstacles: Obstacle[] = [];
    
    const obstacleTypes = Object.values(ObstacleType);
    const directions: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
    const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
    
    // If in wheelchair mode, increase probability of wheelchair-relevant obstacles
    const relevantObstacles = wheelchairMode 
      ? [ObstacleType.STAIRS, ObstacleType.HOLE, ObstacleType.POLE] 
      : [ObstacleType.PERSON, ObstacleType.VEHICLE, ObstacleType.ANIMAL];
    
    for (let i = 0; i < obstacleCount; i++) {
      // Bias towards relevant obstacles in 50% of cases
      const useRelevantObstacle = Math.random() < 0.5;
      
      const type = useRelevantObstacle
        ? relevantObstacles[Math.floor(Math.random() * relevantObstacles.length)]
        : obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        
      const direction = directions[Math.floor(Math.random() * directions.length)];
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      const distance = Math.random() * detectionDistance;
      const confidence = 0.7 + Math.random() * 0.3; // 0.7-1.0
      
      obstacles.push({
        type,
        distance,
        direction,
        size,
        confidence
      });
    }
    
    return obstacles;
  };
  
  // Sort obstacles by priority (type importance and distance)
  const sortObstaclesByPriority = (obstacles: Obstacle[]): Obstacle[] => {
    return [...obstacles].sort((a, b) => {
      // First sort by type priority
      const priorityDiff = OBSTACLE_PRIORITIES[b.type] - OBSTACLE_PRIORITIES[a.type];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by distance (closer is more important)
      return a.distance - b.distance;
    });
  };
  
  // Alert the user about an obstacle
  const alertObstacle = (obstacle: Obstacle) => {
    const now = Date.now();
    const timeSinceLastAlert = now - lastAlertTimeRef.current;
    
    // Don't alert too frequently
    if (timeSinceLastAlert < 2000) return;
    
    // Only alert if obstacle is within detection distance
    if (obstacle.distance > detectionDistance) return;
    
    lastAlertTimeRef.current = now;
    
    // Provide appropriate haptic feedback based on obstacle type and distance
    if (hapticFeedback) {
      const intensity = Math.min(100, Math.floor((1 - (obstacle.distance / detectionDistance)) * 100));
      
      // Different patterns for different directions
      let feedbackType: HapticFeedbackType;
      switch (obstacle.direction) {
        case 'left':
          feedbackType = HapticFeedbackType.LEFT_DIRECTION;
          break;
        case 'right':
          feedbackType = HapticFeedbackType.RIGHT_DIRECTION;
          break;
        default:
          feedbackType = HapticFeedbackType.WARNING;
      }
      
      bluetoothService.current.sendHapticFeedback(feedbackType, intensity);
    }
    
    // Provide voice feedback
    if (voiceAlerts) {
      // Format distance for natural speech
      const formattedDistance = obstacle.distance < 1 
        ? `${Math.round(obstacle.distance * 10) / 10} meters` 
        : `${Math.round(obstacle.distance)} meters`;
      
      // Customize message based on obstacle type and direction
      let alertMessage = `${obstacle.type} detected ${formattedDistance} ${obstacle.direction === 'center' ? 'ahead' : 'to your ' + obstacle.direction}`;
      
      // Add urgency for very close obstacles
      if (obstacle.distance < 1.5) {
        alertMessage = `Warning! ${alertMessage}`;
      }
      
      // Add special warnings for wheelchair mode
      if (wheelchairMode && (obstacle.type === ObstacleType.STAIRS || obstacle.type === ObstacleType.HOLE)) {
        alertMessage = `Caution! ${obstacle.type} detected. Not wheelchair accessible.`;
      }
      
      Speech.speak(alertMessage, {
        rate: obstacle.distance < 1.5 ? 1.2 : 1.0, // Speak faster for urgent alerts
        pitch: obstacle.distance < 1.5 ? 1.2 : 1.0, // Higher pitch for urgent alerts
      });
    }
  };
  
  const renderObstacleVisualization = () => {
    if (!showObstacleVisualization || detectedObstacles.length === 0) return null;
    
    return (
      <View style={styles.obstacleVisualizationContainer}>
        {detectedObstacles.map((obstacle, index) => {
          // Calculate position based on direction
          let leftPercent = 50; // pourcentage numérique au lieu de chaîne
          if (obstacle.direction === 'left') leftPercent = 20;
          if (obstacle.direction === 'right') leftPercent = 80;
          
          // Calculate size based on distance (closer = bigger)
          const sizeMultiplier = 1 + (detectionDistance - obstacle.distance) / detectionDistance;
          
          // Calculate base size based on obstacle size
          let baseSize = 30;
          if (obstacle.size === 'small') baseSize = 20;
          if (obstacle.size === 'large') baseSize = 40;
          
          const size = baseSize * sizeMultiplier;
          
          // Position in the vertical axis (closer = lower)
          const topPercent = 30 + (obstacle.distance / detectionDistance) * 60; // pourcentage numérique
          
          // Convertir les pourcentages en valeurs numériques pour les dimensions
          const leftPos = (leftPercent / 100) * SCREEN_WIDTH;
          const topPos = (topPercent / 100) * SCREEN_HEIGHT;
          
          // Get icon based on obstacle type
          const getObstacleIcon = () => {
            switch (obstacle.type) {
              case ObstacleType.PERSON:
                return 'person';
              case ObstacleType.VEHICLE:
                return 'car';
              case ObstacleType.STAIRS:
                return 'fitness';
              case ObstacleType.HOLE:
                return 'warning';
              case ObstacleType.DOOR:
                return 'exit';
              case ObstacleType.POLE:
                return 'golf';
              case ObstacleType.WALL:
                return 'stop';
              case ObstacleType.FURNITURE:
                return 'desktop';
              case ObstacleType.ANIMAL:
                return 'paw';
              default:
                return 'help-circle';
            }
          };
          
          // CORRECTION : Utiliser des valeurs numériques plutôt que des chaînes de pourcentage
          return (
            <View
              key={index}
              style={[
                styles.obstacleMarker,
                {
                  left: leftPos, // valeur numérique
                  top: topPos,   // valeur numérique
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: 
                    obstacle.distance < 1.5 ? 'rgba(244, 67, 54, 0.7)' :
                    obstacle.distance < 3 ? 'rgba(255, 152, 0, 0.7)' :
                    'rgba(33, 150, 243, 0.7)'
                }
              ]}
            >
              <Ionicons
                name={getObstacleIcon() as any}
                size={size * 0.6}
                color="white"
              />
            </View>
          );
        })}
      </View>
    );
  };
  
  
  // Render distance gauge
  const renderDistanceGauge = () => {
    if (!showObstacleVisualization) return null;
    
    return (
      <View style={styles.distanceGaugeContainer}>
        <ThemedText style={styles.distanceGaugeLabel}>
          0m
        </ThemedText>
        <View style={styles.distanceGauge}>
          <View style={styles.distanceGaugeDivision} />
          <View style={styles.distanceGaugeDivision} />
          <View style={styles.distanceGaugeDivision} />
          <View style={styles.distanceGaugeDivision} />
        </View>
        <ThemedText style={styles.distanceGaugeLabel}>
          {detectionDistance}m
        </ThemedText>
      </View>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        onCameraReady={() => setCameraReady(true)}
      >
        {/* Obstacle visualization overlay */}
        {renderObstacleVisualization()}
        {renderDistanceGauge()}
        
        {/* Header with title and close button */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>
            Obstacle Detection
          </ThemedText>
          
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettings(!showSettings)}
          >
            <Ionicons name="settings-outline" size={24} color="white" />
          </TouchableOpacity>
          
          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Settings panel */}
        {showSettings && (
          <View style={styles.settingsPanel}>
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>Detection Distance</ThemedText>
              <View style={styles.settingValueContainer}>
                <TouchableOpacity
                  style={styles.settingButton}
                  onPress={() => setDetectionDistance(Math.max(1, detectionDistance - 1))}
                >
                  <Ionicons name="remove" size={20} color="#2196F3" />
                </TouchableOpacity>
                <ThemedText style={styles.settingValue}>{detectionDistance}m</ThemedText>
                <TouchableOpacity
                  style={styles.settingButton}
                  onPress={() => setDetectionDistance(Math.min(10, detectionDistance + 1))}
                >
                  <Ionicons name="add" size={20} color="#2196F3" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>Update Frequency</ThemedText>
              <View style={styles.settingValueContainer}>
                <TouchableOpacity
                  style={styles.settingButton}
                  onPress={() => setDetectionFrequency(Math.max(500, detectionFrequency - 250))}
                >
                  <Ionicons name="remove" size={20} color="#2196F3" />
                </TouchableOpacity>
                <ThemedText style={styles.settingValue}>
                  {detectionFrequency / 1000}s
                </ThemedText>
                <TouchableOpacity
                  style={styles.settingButton}
                  onPress={() => setDetectionFrequency(Math.min(3000, detectionFrequency + 250))}
                >
                  <Ionicons name="add" size={20} color="#2196F3" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>Voice Alerts</ThemedText>
              <Switch
                value={voiceAlerts}
                onValueChange={setVoiceAlerts}
                trackColor={{ false: '#767577', true: '#81D4FA' }}
                thumbColor={voiceAlerts ? '#2196F3' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>Haptic Feedback</ThemedText>
              <Switch
                value={hapticFeedback}
                onValueChange={setHapticFeedback}
                trackColor={{ false: '#767577', true: '#81D4FA' }}
                thumbColor={hapticFeedback ? '#2196F3' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>Show Visualization</ThemedText>
              <Switch
                value={showObstacleVisualization}
                onValueChange={setShowObstacleVisualization}
                trackColor={{ false: '#767577', true: '#81D4FA' }}
                thumbColor={showObstacleVisualization ? '#2196F3' : '#f4f3f4'}
              />
            </View>
          </View>
        )}
        
        {/* Wheelchair mode indicator */}
        {wheelchairMode && (
          <View style={styles.wheelchairModeIndicator}>
            <MaterialIcons name="accessible" size={20} color="white" />
            <ThemedText style={styles.wheelchairModeText}>
              Wheelchair Mode
            </ThemedText>
          </View>
        )}
        
        {/* Obstacle list */}
        {detectedObstacles.length > 0 && (
          <View style={styles.obstacleListContainer}>
            <ThemedText style={styles.obstacleListTitle}>
              Detected Obstacles
            </ThemedText>
            
            <View style={styles.obstacleList}>
              {detectedObstacles.slice(0, 3).map((obstacle, index) => (
                <View key={index} style={styles.obstacleItem}>
                  <View style={[
                    styles.obstaclePriorityIndicator,
                    {
                      backgroundColor:
                        obstacle.distance < 1.5 ? '#F44336' :
                        obstacle.distance < 3 ? '#FF9800' :
                        '#2196F3'
                    }
                  ]} />
                  <ThemedText style={styles.obstacleType}>
                    {obstacle.type.charAt(0).toUpperCase() + obstacle.type.slice(1)}
                  </ThemedText>
                  <ThemedText style={styles.obstacleInfo}>
                    {obstacle.direction} • {obstacle.distance.toFixed(1)}m
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {/* Control buttons */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.detectionButton,
              isDetecting ? styles.detectionActiveButton : {}
            ]}
            onPress={toggleDetection}
          >
            <Ionicons
              name={isDetecting ? "eye" : "eye-outline"}
              size={24}
              color="white"
            />
            <ThemedText style={styles.detectionButtonText}>
              {isDetecting ? "Detecting" : "Start Detection"}
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.cameraToggleButton}
            onPress={() => setCameraType(current => current === 'back' ? 'front' : 'back')}
          >
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  settingLabel: {
    fontSize: 16,
  },
  settingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    paddingHorizontal: 10,
    fontWeight: 'bold',
  },
  settingButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelchairModeIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    right: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  wheelchairModeText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  obstacleVisualizationContainer: {
    position: 'absolute',
    left: 0,
    right: 0, 
    top: 0, 
    bottom: 0,
    zIndex: 100,
  },
  distanceGaugeContainer: {
    position: 'absolute',
    top: 150,
    right: 20,
    alignItems: 'center',
  },
  distanceGauge: {
    height: 150,
    width: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
    marginVertical: 5,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  distanceGaugeDivision: {
    width: 10,
    height: 1,
    backgroundColor: 'white',
    marginLeft: -3,
  },
  distanceGaugeLabel: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  obstacleListContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 15,
  },
  obstacleListTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  obstacleList: {
    maxHeight: 200,
  },
  obstacleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  obstacleMarker: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  obstaclePriorityIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  obstacleType: {
    color: 'white',
    fontSize: 16,
    flex: 1,
  },
  obstacleInfo: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detectionButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 15,
  },
  detectionActiveButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  detectionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  cameraToggleButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Advanced3DObstacleDetection;