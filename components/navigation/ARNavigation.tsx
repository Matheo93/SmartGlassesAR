// components/navigation/ARNavigation.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Switch
} from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import NavigationService, { TransportMode } from '../../services/NavigationService';

// Define coordinate interface without creating a conflict
interface NavigationCoordinate {
  latitude: number;
  longitude: number;
}

type NavigationProps = {
  onClose?: () => void;
  initialDestination?: string;
  wheelchairMode?: boolean;
};

// Mock direction data for demo
interface MockDirection {
  direction: string;
  distance: string;
  nextTurn: string;
  estimatedArrivalTime: string;
}

export const ARNavigation: React.FC<NavigationProps> = ({
  onClose,
  initialDestination,
  wheelchairMode: initialWheelchairMode = false,
}) => {
  // State variables
  const [currentPosition, setCurrentPosition] = useState<NavigationCoordinate | null>(null);
  const [destination, setDestination] = useState<string>(initialDestination || '');
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wheelchairMode, setWheelchairMode] = useState(initialWheelchairMode);
  const [transportMode, setTransportMode] = useState<TransportMode>('walking');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [showHeatmapLegend, setShowHeatmapLegend] = useState(false);
  
  const cameraRef = useRef<CameraView | null>(null);
  
  // Mock navigation data
  const mockDirection: MockDirection = {
    direction: 'right',
    distance: '100m',
    nextTurn: 'Turn right on Main Street',
    estimatedArrivalTime: '10 minutes'
  };
  
  // Get current position on component mount
  useEffect(() => {
    if (Platform.OS !== 'web') {
      getCurrentPosition();
    } else {
      // Mock position for web
      setCurrentPosition({
        latitude: 48.8584,
        longitude: 2.2945
      });
    }
  }, []);
  
  // Get current position
  const getCurrentPosition = () => {
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentPosition({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error getting location:', err);
        setError('Failed to get current location. Please check permissions.');
        setIsLoading(false);
        
        // Set mock position for demo
        setCurrentPosition({
          latitude: 48.8584,
          longitude: 2.2945
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };
  
  // Start navigation
  const startNavigation = () => {
    if (!destination.trim()) {
      Alert.alert('Navigation Error', 'Please enter a destination');
      return;
    }
    
    setIsLoading(true);
    
    // Create a navigation service instance
    const navigationService = NavigationService.getInstance();
    
    // First geocode the destination to get coordinates
    NavigationService.geocodeAddress(destination)
      .then((destCoords: NavigationCoordinate | null) => {
        if (!destCoords) {
          throw new Error('Could not find destination');
        }
        
        // Then get the actual route with wheelchair mode if enabled
        return navigationService.startNavigation(
          destCoords,
          transportMode,
          wheelchairMode
        );
      })
      .then((route: any) => {
        if (route) {
          setIsNavigating(true);
          // Process route for display
        } else {
          Alert.alert('Navigation Error', 'Could not calculate a route');
        }
      })
      .catch((error: Error) => {
        Alert.alert('Error', error.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };
  
  // Stop navigation
  const stopNavigation = () => {
    setIsNavigating(false);
  };
  
  // Toggle wheelchair mode with haptic feedback
  const toggleWheelchairMode = () => {
    setWheelchairMode((prev: boolean) => !prev);
    // In a real app, we would provide haptic feedback here
  };
  
  // Render direction arrow
  const renderDirectionArrow = () => {
    if (!isNavigating) return null;
    
    return (
      <View style={styles.arrowContainer}>
        <View style={styles.arrow}>
          <Ionicons 
            name={mockDirection.direction === 'right' ? 'arrow-forward' : 
                 mockDirection.direction === 'left' ? 'arrow-back' : 'arrow-up'} 
            size={60} 
            color="#FFDD00" 
          />
        </View>
        <ThemedText style={styles.distanceText}>
          {mockDirection.distance}
        </ThemedText>
        <ThemedText style={styles.nextTurnText}>
          {mockDirection.nextTurn}
        </ThemedText>
      </View>
    );
  };
  
  // Render ETA
  const renderETA = () => {
    if (!isNavigating) return null;
    
    return (
      <View style={styles.etaContainer}>
        <Ionicons name="time-outline" size={20} color="white" />
        <ThemedText style={styles.etaText}>
          ETA: {mockDirection.estimatedArrivalTime}
        </ThemedText>
      </View>
    );
  };
  
  // Render accessibility heatmap (mock data for wheelchair accessibility)
  const renderAccessibilityHeatmap = () => {
    if (!wheelchairMode || !isNavigating) return null;
    
    return (
      <View style={styles.heatmapContainer}>
        {/* This would be replaced with actual heatmap visualization */}
        <TouchableOpacity 
          style={styles.heatmapLegendButton}
          onPress={() => setShowHeatmapLegend(!showHeatmapLegend)}
        >
          <FontAwesome5 name="wheelchair" size={16} color="white" />
          <ThemedText style={styles.heatmapButtonText}>
            Accessibility
          </ThemedText>
        </TouchableOpacity>
        
        {showHeatmapLegend && (
          <View style={styles.heatmapLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#00FF00' }]} />
              <ThemedText style={styles.legendText}>Good accessibility</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#FFFF00' }]} />
              <ThemedText style={styles.legendText}>Moderate challenges</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#FF0000' }]} />
              <ThemedText style={styles.legendText}>Poor accessibility</ThemedText>
            </View>
          </View>
        )}
      </View>
    );
  };
  
  // Render transport mode selector
  const renderTransportModes = () => {
    return (
      <View style={styles.transportModeContainer}>
        <TouchableOpacity
          style={[
            styles.transportModeButton,
            transportMode === 'walking' && styles.activeTransportButton
          ]}
          onPress={() => setTransportMode('walking')}
        >
          <Ionicons name="walk-outline" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.transportModeButton,
            transportMode === 'bicycling' && styles.activeTransportButton
          ]}
          onPress={() => setTransportMode('bicycling')}
        >
          <Ionicons name="bicycle-outline" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.transportModeButton,
            transportMode === 'driving' && styles.activeTransportButton
          ]}
          onPress={() => setTransportMode('driving')}
        >
          <Ionicons name="car-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={'back' as CameraType}
        onCameraReady={() => setIsCameraReady(true)}
      >
        {/* Destination input */}
        {!isNavigating && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.destinationInput}
              placeholder="Enter destination..."
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor="#999"
            />
            <TouchableOpacity 
              style={styles.startButton}
              onPress={startNavigation}
              disabled={isLoading || destination.trim() === ''}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <ThemedText style={styles.startButtonText}>Go</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {/* AR direction arrow */}
        {renderDirectionArrow()}
        
        {/* ETA display */}
        {renderETA()}
        
        {/* Accessibility heatmap */}
        {renderAccessibilityHeatmap()}
        
        {/* Transport mode selector */}
        {renderTransportModes()}
        
        {/* Wheelchair mode toggle */}
        <View style={styles.wheelchairModeContainer}>
          <FontAwesome5 name="wheelchair" size={20} color="white" />
          <ThemedText style={styles.wheelchairModeText}>
            Wheelchair Mode
          </ThemedText>
          <Switch
            value={wheelchairMode}
            onValueChange={toggleWheelchairMode}
            trackColor={{ false: '#767577', true: '#4CAF50' }}
            thumbColor={wheelchairMode ? '#8BC34A' : '#f4f3f4'}
          />
        </View>
        
        {/* Navigation controls */}
        <View style={styles.controls}>
          {isNavigating ? (
            <TouchableOpacity 
              style={styles.stopButton}
              onPress={stopNavigation}
            >
              <ThemedText style={styles.stopButtonText}>
                Stop Navigation
              </ThemedText>
            </TouchableOpacity>
          ) : null}
          
          {onClose && (
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
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
  inputContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  destinationInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  startButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  arrowContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  arrow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 20,
  },
  nextTurnText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  etaContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  etaText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 5,
  },
  controls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
  },
  stopButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transportModeContainer: {
    position: 'absolute',
    left: 20,
    bottom: 100,
    flexDirection: 'column',
    gap: 10,
  },
  transportModeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTransportButton: {
    backgroundColor: '#2196F3',
  },
  wheelchairModeContainer: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  wheelchairModeText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
    marginRight: 8,
  },
  heatmapContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
  },
  heatmapLegendButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  heatmapButtonText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
  },
  heatmapLegend: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    color: 'white',
    fontSize: 12,
  },
});

export default ARNavigation;