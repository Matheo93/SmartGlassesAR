import React, { useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  Alert
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '../../components/ui/ThemedText';

// Define the camera type as string literal type
type CameraFacing = 'front' | 'back';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraFacing>('back');
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  
  const cameraRef = useRef(null);

  // Request camera permission if not granted
  if (!permission) {
    return (
      <View style={styles.container}>
        <ThemedText>Requesting camera permission...</ThemedText>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedText style={styles.text}>
          We need your permission to use the camera
        </ThemedText>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <ThemedText style={styles.buttonText}>Grant Permission</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Toggle feature modal
  const toggleFeature = (feature: string) => {
    if (activeFeature === feature) {
      setActiveFeature(null);
    } else {
      setActiveFeature(feature);
      Alert.alert(`${feature} Mode Activated`, 
                 `This would open the ${feature} interface in a real app.`);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.featureButton}
            onPress={() => toggleFeature('Translation')}
          >
            <Ionicons name="language-outline" size={24} color="white" />
            <ThemedText style={styles.featureText}>Translate</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureButton}
            onPress={() => toggleFeature('Navigation')}
          >
            <Ionicons name="navigate-outline" size={24} color="white" />
            <ThemedText style={styles.featureText}>Navigate</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureButton}
            onPress={() => toggleFeature('Sign Language')}
          >
            <Ionicons name="hand-left-outline" size={24} color="white" />
            <ThemedText style={styles.featureText}>Sign</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.featureButton}
            onPress={() => toggleFeature('Voice Assistant')}
          >
            <Ionicons name="mic-outline" size={24} color="white" />
            <ThemedText style={styles.featureText}>Voice</ThemedText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.flipButton}
          onPress={() => setCameraType(current => 
            current === 'back' ? 'front' : 'back'
          )}
        >
          <Ionicons name="camera-reverse-outline" size={30} color="white" />
        </TouchableOpacity>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  featureButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 10,
  },
  featureText: {
    color: 'white',
    marginTop: 5,
    fontSize: 12,
  },
  flipButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 50,
  },
  text: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  }
});