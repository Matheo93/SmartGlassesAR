// app/(tabs)/index.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Image,
  useWindowDimensions,
  Platform,
  Alert
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemedText } from '../../components/ui/ThemedText';
import { ThemedView } from '../../components/ui/ThemedView';

export default function HomeScreen() {
  const [isConnected, setIsConnected] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [lastUsedFeature, setLastUsedFeature] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  
  // Column layout calculation for the feature grid
  const numColumns = width > 500 ? 3 : 2;
  
  // Mock connect to glasses
  const toggleConnection = () => {
    setIsConnected(!isConnected);
    
    if (!isConnected) {
      Alert.alert(
        'Connected',
        'Successfully connected to Smart Glasses',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Disconnected',
        'Smart Glasses have been disconnected',
        [{ text: 'OK' }]
      );
    }
  };
  
  // Navigate to a specific feature
  const navigateToFeature = (feature: string) => {
    setLastUsedFeature(feature);
    
    if (feature === 'camera') {
      router.navigate('/(tabs)/camera');
    } else if (feature === 'settings') {
      router.navigate('/(tabs)/explore');
    } else {
      // For other features, we navigate to camera and then open the appropriate modal
      // This would need to be implemented with state management in a real app
      router.navigate('/(tabs)/camera');
    }
  };
  
  // Feature data for grid
  const features = [
    {
      id: 'translation',
      name: 'Translation',
      icon: <Ionicons name="language-outline" size={32} color="#2196F3" />,
      description: 'Real-time text translation',
    },
    {
      id: 'signLanguage',
      name: 'Sign Language',
      icon: <FontAwesome5 name="sign-language" size={32} color="#4CAF50" />,
      description: 'Sign language recognition',
    },
    {
      id: 'navigation',
      name: 'Navigation',
      icon: <Ionicons name="navigate-outline" size={32} color="#FF9800" />,
      description: 'Accessible navigation assistance',
    },
    {
      id: 'voiceAssistant',
      name: 'Voice Control',
      icon: <Ionicons name="mic-outline" size={32} color="#9C27B0" />,
      description: 'Hands-free voice commands',
    },
    {
      id: 'camera',
      name: 'Camera',
      icon: <Ionicons name="camera-outline" size={32} color="#F44336" />,
      description: 'Take photos and videos',
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: <Ionicons name="settings-outline" size={32} color="#607D8B" />,
      description: 'Configure your glasses',
    },
  ];
  
  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.title}>Smart Glasses</ThemedText>
        <ThemedText style={styles.subtitle}>Accessibility Assistant</ThemedText>
      </View>
      
      {/* Device status card */}
      <View style={styles.deviceCard}>
        <View style={styles.deviceIconContainer}>
          <Ionicons 
            name={isConnected ? "glasses" : "glasses-outline"} 
            size={60} 
            color={isConnected ? "#2196F3" : "#757575"} 
          />
        </View>
        
        <View style={styles.deviceInfo}>
          <ThemedText style={styles.deviceName}>Smart Glasses X1</ThemedText>
          <ThemedText style={styles.deviceStatus}>
            {isConnected ? "Connected" : "Disconnected"}
          </ThemedText>
          
          {isConnected && (
            <View style={styles.batteryContainer}>
              <Ionicons 
                name={batteryLevel > 20 ? "battery-full" : "battery-dead"} 
                size={14} 
                color={batteryLevel > 20 ? "#4CAF50" : "#F44336"} 
              />
              <ThemedText style={styles.batteryText}>{batteryLevel}%</ThemedText>
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={[styles.connectButton, isConnected && styles.disconnectButton]}
          onPress={toggleConnection}
        >
          <ThemedText style={styles.connectButtonText}>
            {isConnected ? "Disconnect" : "Connect"}
          </ThemedText>
        </TouchableOpacity>
      </View>
      
      {/* Quick access to last used feature */}
      {lastUsedFeature && (
        <View style={styles.lastUsedContainer}>
          <ThemedText style={styles.sectionTitle}>Last Used</ThemedText>
          <TouchableOpacity 
            style={styles.lastUsedFeature}
            onPress={() => navigateToFeature(lastUsedFeature)}
          >
            {features.find(f => f.id === lastUsedFeature)?.icon}
            <ThemedText style={styles.lastUsedFeatureName}>
              {features.find(f => f.id === lastUsedFeature)?.name}
            </ThemedText>
            <Ionicons name="chevron-forward" size={20} color="#777" />
          </TouchableOpacity>
        </View>
      )}
      
      {/* Features Grid */}
      <ThemedText style={styles.sectionTitle}>Features</ThemedText>
      <ScrollView style={styles.featuresContainer}>
        <View style={[styles.featuresGrid, { gap: 12 }]}>
          {features.map((feature, index) => (
            <TouchableOpacity
              key={feature.id}
              style={[
                styles.featureItem,
                { width: `${100 / numColumns - 3}%` }
              ]}
              onPress={() => navigateToFeature(feature.id)}
            >
              <View style={styles.featureIconContainer}>
                {feature.icon}
              </View>
              <ThemedText style={styles.featureName}>{feature.name}</ThemedText>
              <ThemedText style={styles.featureDescription}>
                {feature.description}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      
      {/* Quick access to camera */}
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={() => navigateToFeature('camera')}
      >
        <Ionicons name="camera" size={28} color="white" />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginTop: Platform.OS === 'ios' ? 50 : 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.7,
    marginTop: 4,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  deviceIconContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 16,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  deviceStatus: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  batteryText: {
    fontSize: 12,
    marginLeft: 4,
  },
  connectButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  connectButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  lastUsedContainer: {
    marginBottom: 20,
  },
  lastUsedFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  lastUsedFeatureName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  featuresContainer: {
    flex: 1,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 80, // Space for the floating camera button
  },
  featureItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 30,
    marginBottom: 12,
  },
  featureName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});