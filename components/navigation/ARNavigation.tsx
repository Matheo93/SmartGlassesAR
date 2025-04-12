// components/navigation/ARPathNavigation.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  Platform,
  Dimensions,
  Animated
} from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { BluetoothService, HapticFeedbackType } from '../../services/BluetoothService';
import NavigationService, { Coordinate, RouteDetails } from '../../services/NavigationService';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';

interface ARPathNavigationProps {
  onClose?: () => void;
  destination?: string | Coordinate;
  wheelchairMode?: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const ARPathNavigation: React.FC<ARPathNavigationProps> = ({
  onClose,
  destination: initialDestination,
  wheelchairMode = false
}) => {
  // Camera and device state
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coordinate | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');
  const [route, setRoute] = useState<RouteDetails | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [arrowOpacity] = useState(new Animated.Value(1));
  const [showPathVisualization, setShowPathVisualization] = useState(true);
  const [enableHapticFeedback, setEnableHapticFeedback] = useState(true);
  const [enableVoiceGuidance, setEnableVoiceGuidance] = useState(true);
  
  // Services
  const bluetoothService = useRef(BluetoothService.getInstance());
  const navigationService = useRef(NavigationService.getInstance());
  
  // Location tracking
  useEffect(() => {
    let locationSubscription: any = null;
    let headingSubscription: any = null;
    
    const setupLocationTracking = async () => {
      try {
        // Request permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required for navigation');
          return;
        }
        
        // Start watching position
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 2, // Update every 2 meters
            timeInterval: 1000 // Update every second
          },
          (location) => {
            const newPosition = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            
            setCurrentPosition(newPosition);
            
            // Check if we're navigating and update progress
            if (isNavigating && route && currentStepIndex < route.steps.length) {
              updateNavigationProgress(newPosition);
            }
          }
        );
        
        // Start watching heading (compass direction)
        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          setHeading(headingData.trueHeading);
        });
        
        // Get initial position
        const initialPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation
        });
        
        setCurrentPosition({
          latitude: initialPosition.coords.latitude,
          longitude: initialPosition.coords.longitude
        });
      } catch (error) {
        console.error('Error setting up location tracking:', error);
        Alert.alert('Error', 'Failed to access location services');
      }
    };
    
    setupLocationTracking();
    
    // If initialDestination is provided, start navigation automatically
    if (initialDestination) {
      if (typeof initialDestination === 'string') {
        setDestinationName(initialDestination);
        geocodeAndNavigate(initialDestination);
      } else {
        setDestinationCoords(initialDestination);
        startNavigation(initialDestination);
      }
    }
    
    // Animate the arrow opacity for attention
    const startArrowAnimation = () => {
      Animated.sequence([
        Animated.timing(arrowOpacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true
        }),
        Animated.timing(arrowOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true
        })
      ]).start(() => startArrowAnimation());
    };
    
    startArrowAnimation();
    
    // Cleanup
    return () => {
      if (locationSubscription) locationSubscription.remove();
      if (headingSubscription) headingSubscription.remove();
    };
  }, [initialDestination, isNavigating, route, currentStepIndex]);
  
  // Update navigation progress based on current position
  const updateNavigationProgress = (position: Coordinate) => {
    if (!route || currentStepIndex >= route.steps.length) return;
    
    const currentStep = route.steps[currentStepIndex];
    const distanceToStep = NavigationService.calculateDistance(position, currentStep.coordinate);
    
    // Provide haptic feedback as user gets closer to turn
    if (enableHapticFeedback) {
      if (distanceToStep < 30 && distanceToStep > 20) {
        // Approaching turn - light feedback
        bluetoothService.current.sendHapticFeedback(HapticFeedbackType.SHORT, 40);
      } else if (distanceToStep < 20 && distanceToStep > 10) {
        // Getting closer - medium feedback
        bluetoothService.current.sendHapticFeedback(HapticFeedbackType.MEDIUM, 60);
      } else if (distanceToStep < 10) {
        // Very close - strong directional feedback
        const directionalFeedback = getDirectionalHapticFeedback(currentStep.maneuver);
        bluetoothService.current.sendHapticFeedback(directionalFeedback, 100);
      }
    }
    
    // Move to next step if within 5 meters of current step
    if (distanceToStep < 5 && currentStepIndex < route.steps.length - 1) {
      const nextStep = route.steps[currentStepIndex + 1];
      setCurrentStepIndex(currentStepIndex + 1);
      
      // Announce new step with voice guidance if enabled
      if (enableVoiceGuidance) {
        announceNavigationStep(nextStep.instruction, nextStep.distance);
      }
    }
    
    // Check for arrival at final destination
    if (currentStepIndex === route.steps.length - 1 && distanceToStep < 10) {
      Alert.alert('Destination Reached', 'You have arrived at your destination');
      
      // Provide success feedback
      if (enableHapticFeedback) {
        bluetoothService.current.sendHapticFeedback(HapticFeedbackType.SUCCESS, 100);
      }
      
      setIsNavigating(false);
    }
  };
  
  // Convert maneuver to appropriate haptic feedback type
  const getDirectionalHapticFeedback = (maneuver: string): HapticFeedbackType => {
    switch (maneuver) {
      case 'turn-left':
        return HapticFeedbackType.LEFT_DIRECTION;
      case 'turn-right':
        return HapticFeedbackType.RIGHT_DIRECTION;
      case 'straight':
        return HapticFeedbackType.STRAIGHT_DIRECTION;
      default:
        return HapticFeedbackType.MEDIUM;
    }
  };
  
  // Announce navigation instructions using voice
  const announceNavigationStep = (instruction: string, distance: number) => {
    // This would use Speech.speak with proper formatting for distance
    // Implement the voice feedback here using expo-speech
    console.log(`Navigation announcement: ${instruction} in ${distance} meters`);
  };
  
  // Geocode a destination string to coordinates
  const geocodeAndNavigate = async (destinationString: string) => {
    try {
      setIsLoading(true);
      
      const coordinates = await NavigationService.geocodeAddress(destinationString);
      
      if (!coordinates) {
        Alert.alert('Error', 'Could not find this destination');
        setIsLoading(false);
        return;
      }
      
      setDestinationCoords(coordinates);
      startNavigation(coordinates);
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Error', 'Failed to find destination');
      setIsLoading(false);
    }
  };
  
  // Start navigation to destination
  const startNavigation = async (destination: Coordinate) => {
    if (!currentPosition) {
      Alert.alert('Error', 'Cannot determine your current location');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Calculate route
      const newRoute = await NavigationService.getRoute(
        currentPosition,
        destination,
        'walking',
        wheelchairMode
      );
      
      if (!newRoute) {
        Alert.alert('Error', 'Could not calculate a route to this destination');
        setIsLoading(false);
        return;
      }
      
      setRoute(newRoute);
      setCurrentStepIndex(0);
      setIsNavigating(true);
      
      // Initial step announcement
      if (newRoute.steps.length > 0 && enableVoiceGuidance) {
        const firstStep = newRoute.steps[0];
        announceNavigationStep(firstStep.instruction, firstStep.distance);
      }
      
      // Success haptic feedback
      if (enableHapticFeedback) {
        bluetoothService.current.sendHapticFeedback(HapticFeedbackType.SUCCESS, 80);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to start navigation');
      setIsLoading(false);
    }
  };
  
  // Stop navigation
  const stopNavigation = () => {
    setIsNavigating(false);
    setRoute(null);
    setCurrentStepIndex(0);
    
    // Feedback to confirm stop
    if (enableHapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };
  
  // Render path visualization (arrows and direction indicators)
  const renderPathVisualization = () => {
    if (!isNavigating || !route || !heading || !showPathVisualization) return null;
    
    const currentStep = route.steps[currentStepIndex];
    if (!currentStep) return null;
    
    // Calculate bearing (direction) to next step
    const bearingToTarget = currentPosition ? 
      NavigationService.calculateBearing(currentPosition, currentStep.coordinate) : 0;
    
    // Calculate the relative angle (where user needs to turn)
    // heading is where the device is pointing, bearingToTarget is where they need to go
    const relativeAngle = bearingToTarget - heading;
    const normalizedAngle = ((relativeAngle + 360) % 360) - 180; // Convert to -180 to 180 range
    
    // Determine the arrow direction based on angle
    let arrowDirection: 'forward' | 'left' | 'right' | 'back' = 'forward';
    if (normalizedAngle > 30 && normalizedAngle < 150) {
      arrowDirection = 'right';
    } else if (normalizedAngle < -30 && normalizedAngle > -150) {
      arrowDirection = 'left';
    } else if (Math.abs(normalizedAngle) > 150) {
      arrowDirection = 'back';
    }
    
    // Get arrow icon based on direction
    const getArrowIcon = () => {
      switch (arrowDirection) {
        case 'forward':
          return 'arrow-up';
        case 'left':
          return 'arrow-back';
        case 'right':
          return 'arrow-forward';
        case 'back':
          return 'arrow-down';
      }
    };
    
    const distanceToStep = currentPosition ? 
      NavigationService.calculateDistance(currentPosition, currentStep.coordinate) : 0;
    
    return (
      <View style={styles.pathVisualizationContainer}>
        {/* Direction arrow */}
        <Animated.View 
          style={[
            styles.directionArrow,
            { opacity: arrowOpacity }
          ]}
        >
          <Ionicons name={getArrowIcon()} size={60} color="#FFDD00" />
        </Animated.View>
        
        {/* Distance and instruction */}
        <View style={styles.directionInfoContainer}>
          <ThemedText style={styles.distanceText}>
            {Math.round(distanceToStep)}m
          </ThemedText>
          <ThemedText style={styles.instructionText}>
            {currentStep.instruction}
          </ThemedText>
        </View>
        
        {/* Draw dots showing the path ahead (simplified visualization) */}
        <View style={styles.pathDotsContainer}>
          {route.steps.slice(currentStepIndex, currentStepIndex + 3).map((step, index) => (
            <View 
              key={index} 
              style={[
                styles.pathDot,
                index === 0 && styles.currentPathDot
              ]} 
            />
          ))}
        </View>
      </View>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={'back' as CameraType}
        onCameraReady={() => setIsCameraReady(true)}
      >
        {/* Path visualization overlay */}
        {renderPathVisualization()}
        
        {/* Navigation controls and info */}
        <View style={styles.controlsContainer}>
          {/* Show destination and ETA if navigating */}
          {isNavigating && route && (
            <View style={styles.navigationInfoCard}>
              <ThemedText style={styles.destinationText}>
                {destinationName || 'Destination'}
              </ThemedText>
              <ThemedText style={styles.etaText}>
                ETA: {Math.ceil(route.duration / 60)} min ({(route.distance / 1000).toFixed(1)} km)
              </ThemedText>
              
              <TouchableOpacity 
                style={styles.stopButton}
                onPress={stopNavigation}
              >
                <ThemedText style={styles.stopButtonText}>End Navigation</ThemedText>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Toggle button for path visualization */}
          <TouchableOpacity
            style={styles.togglePathButton}
            onPress={() => setShowPathVisualization(!showPathVisualization)}
          >
            <Ionicons 
              name={showPathVisualization ? "eye" : "eye-off"} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
          
          {/* Close button */}
          {onClose && (
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Wheelchair mode indicator */}
        {wheelchairMode && (
          <View style={styles.wheelchairModeIndicator}>
            <FontAwesome5 name="wheelchair" size={20} color="#4CAF50" />
            <ThemedText style={styles.wheelchairModeText}>
              Wheelchair Mode Active
            </ThemedText>
          </View>
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>
                Calculating route...
              </ThemedText>
            </View>
          </View>
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
  pathVisualizationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionArrow: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionInfoContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
    maxWidth: '80%',
  },
  distanceText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  pathDotsContainer: {
    flexDirection: 'row',
    marginTop: 20,
  },
  pathDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 5,
  },
  currentPathDot: {
    backgroundColor: '#FFDD00',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  controlsContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
  },
  navigationInfoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  destinationText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  etaText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
  },
  stopButton: {
    backgroundColor: '#F44336',
    borderRadius: 5,
    padding: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  stopButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  togglePathButton: {
    position: 'absolute',
    top: 0,
    right: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelchairModeIndicator: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  wheelchairModeText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  },
});

export default ARPathNavigation;