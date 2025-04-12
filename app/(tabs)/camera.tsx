// app/(tabs)/camera.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  Platform,
  SafeAreaView,
  StatusBar,
  Alert,
  Image
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { ThemedText } from '../../components/ui/ThemedText';
import { ThemedView } from '../../components/ui/ThemedView';

// Import accessibility components
import { RealTimeTranslation } from '../../components/accessibility/RealTimeTranslation';
import { SignLanguageRecognition } from '../../components/accessibility/SignLanguageRecognition';
import { VoiceAssistant } from '../../components/accessibility/VoiceAssistant';
import { ARPathNavigation } from '../../components/navigation/ARNavigation';
import { BluetoothConnection } from '../../components/BluetoothConnection';

// Modal type for feature selection
type ActiveModal = 
  | 'translation' 
  | 'signLanguage' 
  | 'navigation' 
  | 'voiceAssistant' 
  | 'bluetooth' 
  | null;

export default function CameraScreen() {
  // Camera permission hooks
  const [permission, requestPermission] = useCameraPermissions();
  
  // State for camera and UI
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [wheelchairMode, setWheelchairMode] = useState(false);
  const [flashMode, setFlashMode] = useState('off');
  
  // Photo capture state
  const [photo, setPhoto] = useState<any>(null);
  
  // Ref for camera
  const cameraRef = useRef<CameraView | null>(null);
  
  // Check additional permissions on component mount
  useEffect(() => {
    const checkPermissions = async () => {
      // Location permissions are important for navigation features
      if (Platform.OS !== 'web') {
        navigator.geolocation.getCurrentPosition(
          () => console.log('Location permission granted'),
          (error) => console.log('Location permission error:', error)
        );
      }
    };
    
    checkPermissions();
  }, []);
  
  // Request camera permission if not granted
  if (!permission) {
    return <ThemedView style={styles.container} />;
  }
  
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <ThemedText style={styles.permissionText}>
          We need your permission to use the camera
        </ThemedText>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={requestPermission}
        >
          <ThemedText style={styles.permissionButtonText}>
            Grant Permission
          </ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  // Toggle between front and back camera
  const toggleCameraType = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
  };
  
  // Toggle flash mode
  const toggleFlash = () => {
    // Flash mode would need to be implemented differently
    // For now, we're just toggling the state
    setFlashMode(current => (current === 'off' ? 'on' : 'off'));
    
    // Display a message since we can't directly control flash
    Alert.alert(
      'Flash Mode', 
      `Flash is now ${flashMode === 'off' ? 'ON' : 'OFF'}`,
      [{ text: 'OK' }]
    );
  };
  
  // Toggle wheelchair mode for navigation
  const toggleWheelchairMode = () => {
    setWheelchairMode(prev => !prev);
    Alert.alert(
      'Wheelchair Mode',
      wheelchairMode 
        ? 'Wheelchair mode has been disabled' 
        : 'Wheelchair mode has been enabled',
      [{ text: 'OK' }]
    );
  };
  
  // Take a photo
  const takePhoto = async () => {
    if (cameraRef.current && isCameraReady) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          exif: true,
        });
        setPhoto(photo);
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to take photo');
      }
    }
  };
  
  // Clear captured photo
  const clearPhoto = () => {
    setPhoto(null);
  };
  
  // Open a feature modal
  const openModal = (modal: ActiveModal) => {
    setActiveModal(modal);
    setIsMenuOpen(false);
  };
  
  // Close the active modal
  const closeModal = () => {
    setActiveModal(null);
  };
  
  // Render the feature menu
  const renderFeatureMenu = () => {
    if (!isMenuOpen) return null;
    
    return (
      <View style={styles.featureMenu}>
        <TouchableOpacity 
          style={styles.featureMenuItem}
          onPress={() => openModal('translation')}
        >
          <Ionicons name="language-outline" size={24} color="white" />
          <ThemedText style={styles.featureMenuItemText}>
            Real-Time Translation
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.featureMenuItem}
          onPress={() => openModal('signLanguage')}
        >
          <FontAwesome5 name="sign-language" size={24} color="white" />
          <ThemedText style={styles.featureMenuItemText}>
            Sign Language
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.featureMenuItem}
          onPress={() => openModal('navigation')}
        >
          <Ionicons name="navigate-outline" size={24} color="white" />
          <ThemedText style={styles.featureMenuItemText}>
            Navigation
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.featureMenuItem}
          onPress={() => openModal('voiceAssistant')}
        >
          <Ionicons name="mic-outline" size={24} color="white" />
          <ThemedText style={styles.featureMenuItemText}>
            Voice Assistant
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.featureMenuItem}
          onPress={() => openModal('bluetooth')}
        >
          <Ionicons name="bluetooth-outline" size={24} color="white" />
          <ThemedText style={styles.featureMenuItemText}>
            Connect Glasses
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.featureMenuItem, 
            wheelchairMode && styles.activeFeatureMenuItem
          ]}
          onPress={toggleWheelchairMode}
        >
          <FontAwesome5 name="wheelchair" size={24} color="white" />
          <ThemedText style={styles.featureMenuItemText}>
            {wheelchairMode ? 'Wheelchair Mode: ON' : 'Wheelchair Mode: OFF'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  };
  
  // If there's a captured photo, show it with controls
  if (photo) {
    return (
      <SafeAreaView style={styles.photoPreviewContainer}>
        <View style={styles.photoPreview}>
          <Image
            source={{ uri: photo.uri }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.photoControls}>
          <TouchableOpacity
            style={styles.photoControlButton}
            onPress={clearPhoto}
          >
            <Ionicons name="close-circle" size={30} color="white" />
            <ThemedText style={styles.photoControlText}>Cancel</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.photoControlButton}
            onPress={() => {
              // Save or share photo functionality would go here
              Alert.alert('Success', 'Photo saved!');
              clearPhoto();
            }}
          >
            <Ionicons name="checkmark-circle" size={30} color="white" />
            <ThemedText style={styles.photoControlText}>Save</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        onCameraReady={() => setIsCameraReady(true)}
      >
        {/* Feature menu */}
        {renderFeatureMenu()}
        
        {/* Status bar showing connected glasses */}
        <View style={styles.glassesStatusBar}>
          <Ionicons name="glasses" size={18} color="#2196F3" />
          <ThemedText style={styles.glassesStatusText}>
            Smart Glasses: Disconnected
          </ThemedText>
        </View>
        
        {/* Camera controls */}
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Ionicons 
              name={isMenuOpen ? "close" : "menu"} 
              size={28} 
              color="white" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePhoto}
            disabled={!isCameraReady}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleCameraType}
          >
            <Ionicons name="camera-reverse-outline" size={28} color="white" />
          </TouchableOpacity>
        </View>
        
        {/* Secondary controls */}
        <View style={styles.secondaryControls}>
          <TouchableOpacity
            style={styles.secondaryControlButton}
            onPress={toggleFlash}
          >
            <Ionicons 
              name={flashMode === 'on' ? "flash" : "flash-off"} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.secondaryControlButton}
            onPress={() => openModal('voiceAssistant')}
          >
            <Ionicons name="mic" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </CameraView>
      
      {/* Feature Modals */}
      <Modal
        visible={activeModal === 'translation'}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <RealTimeTranslation onClose={closeModal} />
      </Modal>
      
      <Modal
        visible={activeModal === 'signLanguage'}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <SignLanguageRecognition onClose={closeModal} />
      </Modal>
      
      <Modal
        visible={activeModal === 'navigation'}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <ARPathNavigation 
          onClose={closeModal}
          wheelchairMode={wheelchairMode}
        />
      </Modal>
      
      <Modal
        visible={activeModal === 'voiceAssistant'}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <VoiceAssistant 
          onClose={closeModal}
          onNavigate={(destination) => {
            closeModal();
            setTimeout(() => {
              openModal('navigation');
            }, 500);
          }}
          onTranslate={() => {
            closeModal();
            setTimeout(() => {
              openModal('translation');
            }, 500);
          }}
          onTakePicture={takePhoto}
        />
      </Modal>
      
      <Modal
        visible={activeModal === 'bluetooth'}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <BluetoothConnection onClose={closeModal} />
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 18,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
  },
  secondaryControls: {
    position: 'absolute',
    top: 100,
    right: 20,
    flexDirection: 'column',
    gap: 20,
  },
  secondaryControlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureMenu: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: 15,
  },
  featureMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeFeatureMenuItem: {
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
    borderRadius: 8,
  },
  featureMenuItemText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 15,
  },
  glassesStatusBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
  },
  glassesStatusText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 8,
  },
  photoPreviewContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  photoPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '90%',
    height: '90%',
  },
  photoControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  photoControlButton: {
    alignItems: 'center',
  },
  photoControlText: {
    color: 'white',
    marginTop: 8,
  },
});