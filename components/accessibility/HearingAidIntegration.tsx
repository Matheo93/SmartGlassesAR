// components/accessibility/HearingAidIntegration.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
    View, 
    StyleSheet, 
    TouchableOpacity, 
    Switch,
    Alert,
    Platform,
    ScrollView,
    ActivityIndicator
  } from 'react-native';
  import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { BluetoothService } from '../../services/BluetoothService';

// Audio processing presets for different environments
enum AudioPreset {
  CONVERSATION = 'conversation',
  NOISY = 'noisy_environment',
  MUSIC = 'music',
  LECTURE = 'lecture',
  CUSTOM = 'custom'
}

// Audio filter types
enum FilterType {
  NOISE_REDUCTION = 'noise_reduction',
  SPEECH_ENHANCEMENT = 'speech_enhancement',
  BASS_BOOST = 'bass_boost',
  TREBLE_BOOST = 'treble_boost',
  DIRECTIONAL = 'directional'
}

// Filter settings
interface FilterSettings {
  [FilterType.NOISE_REDUCTION]: number; // 0-100
  [FilterType.SPEECH_ENHANCEMENT]: number; // 0-100
  [FilterType.BASS_BOOST]: number; // 0-100
  [FilterType.TREBLE_BOOST]: number; // 0-100
  [FilterType.DIRECTIONAL]: number; // 0-360 (degrees)
}

// Preset definitions
const PRESET_SETTINGS: Record<AudioPreset, FilterSettings> = {
  [AudioPreset.CONVERSATION]: {
    [FilterType.NOISE_REDUCTION]: 60,
    [FilterType.SPEECH_ENHANCEMENT]: 80,
    [FilterType.BASS_BOOST]: 30,
    [FilterType.TREBLE_BOOST]: 60,
    [FilterType.DIRECTIONAL]: 0 // front-facing
  },
  [AudioPreset.NOISY]: {
    [FilterType.NOISE_REDUCTION]: 90,
    [FilterType.SPEECH_ENHANCEMENT]: 90,
    [FilterType.BASS_BOOST]: 40,
    [FilterType.TREBLE_BOOST]: 70,
    [FilterType.DIRECTIONAL]: 0 // front-facing
  },
  [AudioPreset.MUSIC]: {
    [FilterType.NOISE_REDUCTION]: 30,
    [FilterType.SPEECH_ENHANCEMENT]: 40,
    [FilterType.BASS_BOOST]: 80,
    [FilterType.TREBLE_BOOST]: 70,
    [FilterType.DIRECTIONAL]: 180 // all around
  },
  [AudioPreset.LECTURE]: {
    [FilterType.NOISE_REDUCTION]: 70,
    [FilterType.SPEECH_ENHANCEMENT]: 90,
    [FilterType.BASS_BOOST]: 20,
    [FilterType.TREBLE_BOOST]: 60,
    [FilterType.DIRECTIONAL]: 0 // front-facing
  },
  [AudioPreset.CUSTOM]: {
    [FilterType.NOISE_REDUCTION]: 50,
    [FilterType.SPEECH_ENHANCEMENT]: 50,
    [FilterType.BASS_BOOST]: 50,
    [FilterType.TREBLE_BOOST]: 50,
    [FilterType.DIRECTIONAL]: 0
  }
};

// Device types
enum HearingDeviceType {
  HEARING_AID = 'hearing_aid',
  COCHLEAR_IMPLANT = 'cochlear_implant',
  SMART_EARBUDS = 'smart_earbuds',
  BONE_CONDUCTION = 'bone_conduction'
}

// Connected device information
interface HearingDevice {
  id: string;
  name: string;
  type: HearingDeviceType;
  batteryLevel?: number;
  isConnected: boolean;
  lastConnected?: Date;
}

// Component props
interface HearingAidIntegrationProps {
  onClose?: () => void;
}

export const HearingAidIntegration: React.FC<HearingAidIntegrationProps> = ({
  onClose
}) => {
  // Device and connection state
  const [isScanning, setIsScanning] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<HearingDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<HearingDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<HearingDevice | null>(null);
  
  // Audio processing state
  const [activePreset, setActivePreset] = useState<AudioPreset>(AudioPreset.CONVERSATION);
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({...PRESET_SETTINGS[AudioPreset.CONVERSATION]});
  const [audioLevel, setAudioLevel] = useState<number>(70);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  
  // Feature toggles
  const [isAudioProcessingEnabled, setIsAudioProcessingEnabled] = useState(true);
  const [isLiveTranscriptionEnabled, setIsLiveTranscriptionEnabled] = useState(false);
  const [isAutomaticAdjustmentEnabled, setIsAutomaticAdjustmentEnabled] = useState(true);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'devices' | 'settings' | 'transcription'>('devices');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Service and recorder refs
  const bluetoothService = useRef(BluetoothService.getInstance());
  const recording = useRef<Audio.Recording | null>(null);
  const transcriptionTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Load saved devices and settings on mount
  useEffect(() => {
    loadSavedDevices();
    
    // Setup audio session
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          // Use numeric values directly to avoid API compatibility issues
          interruptionModeIOS: 1, // DoNotMix value
          interruptionModeAndroid: 1, // DoNotMix value
        });
      } catch (error) {
        console.error('Error setting up audio:', error);
      }
    };
    
    setupAudio();
    
    // Start live transcription if enabled
    if (isLiveTranscriptionEnabled) {
      startTranscription();
    }
    
    return () => {
      stopTranscription();
    };
  }, []);
  
  // Effect to handle live transcription toggle
  useEffect(() => {
    if (isLiveTranscriptionEnabled) {
      startTranscription();
    } else {
      stopTranscription();
    }
  }, [isLiveTranscriptionEnabled]);
  
  // Load saved devices (simulated for demo)
  const loadSavedDevices = () => {
    // Mock paired devices
    const mockPairedDevices: HearingDevice[] = [
      {
        id: '001',
        name: 'Oticon More™ 1',
        type: HearingDeviceType.HEARING_AID,
        batteryLevel: 75,
        isConnected: false,
        lastConnected: new Date(Date.now() - 24 * 3600 * 1000) // yesterday
      },
      {
        id: '002',
        name: 'Phonak Audéo Paradise',
        type: HearingDeviceType.HEARING_AID,
        batteryLevel: 90,
        isConnected: false,
        lastConnected: new Date(Date.now() - 2 * 24 * 3600 * 1000) // 2 days ago
      },
      {
        id: '003',
        name: 'Cochlear™ Nucleus 7',
        type: HearingDeviceType.COCHLEAR_IMPLANT,
        batteryLevel: 60,
        isConnected: false
      }
    ];
    
    setPairedDevices(mockPairedDevices);
  };
  
  // Start scanning for devices
  const startScan = () => {
    setIsScanning(true);
    
    // Simulate device discovery
    setTimeout(() => {
      const newDevice: HearingDevice = {
        id: '004',
        name: 'Starkey Livio Edge AI',
        type: HearingDeviceType.HEARING_AID,
        isConnected: false
      };
      
      // Check if device is already paired
      if (!pairedDevices.some(device => device.id === newDevice.id)) {
        setPairedDevices(prev => [...prev, newDevice]);
      }
      
      setIsScanning(false);
    }, 3000);
  };
  
  // Connect to device
  const connectToDevice = (device: HearingDevice) => {
    setIsScanning(false);
    
    // Update device connection status
    const updatedDevices = pairedDevices.map(d => {
      if (d.id === device.id) {
        return { ...d, isConnected: true, lastConnected: new Date() };
      }
      return d;
    });
    
    setPairedDevices(updatedDevices);
    setConnectedDevices(prev => [...prev, { ...device, isConnected: true, lastConnected: new Date() }]);
    setSelectedDevice({ ...device, isConnected: true, lastConnected: new Date() });
    
    // Provide haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    // Announce connection
    // Fix: Use async/await properly with Speech.isSpeakingAsync()
    const announceConnection = async () => {
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) {
        Speech.stop();
      }
      Speech.speak(`Connected to ${device.name}`);
    };
    
    announceConnection();
    
    // Apply current audio settings
    applyAudioSettings();
  };
  
  // Disconnect from device
  const disconnectDevice = (device: HearingDevice) => {
    // Update device connection status
    const updatedDevices = pairedDevices.map(d => {
      if (d.id === device.id) {
        return { ...d, isConnected: false };
      }
      return d;
    });
    
    setPairedDevices(updatedDevices);
    setConnectedDevices(prev => prev.filter(d => d.id !== device.id));
    
    if (selectedDevice?.id === device.id) {
      setSelectedDevice(null);
    }
    
    // Provide haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    
    // Announce disconnection
    // Fix: Use async/await properly with Speech.isSpeakingAsync()
    const announceDisconnection = async () => {
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) {
        Speech.stop();
      }
      Speech.speak(`Disconnected from ${device.name}`);
    };
    
    announceDisconnection();
  };
  
  // Update and apply filter settings
  const updateFilterSetting = (filter: FilterType, value: number) => {
    const updatedSettings = { ...filterSettings, [filter]: value };
    setFilterSettings(updatedSettings);
    
    // If it's not a custom preset, switch to custom
    if (activePreset !== AudioPreset.CUSTOM) {
      setActivePreset(AudioPreset.CUSTOM);
    }
    
    // Apply the new settings
    applyAudioSettings();
  };
  
  // Apply preset
  const applyPreset = (preset: AudioPreset) => {
    setActivePreset(preset);
    setFilterSettings({...PRESET_SETTINGS[preset]});
    
    // Apply the preset settings
    applyAudioSettings();
    
    // Provide haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Announce preset change
    // Fix: Use async/await properly with Speech.isSpeakingAsync()
    const announcePresetChange = async () => {
      const isSpeaking = await Speech.isSpeakingAsync();
      if (isSpeaking) {
        Speech.stop();
      }
      
      const presetNames = {
        [AudioPreset.CONVERSATION]: 'Conversation',
        [AudioPreset.NOISY]: 'Noisy Environment',
        [AudioPreset.MUSIC]: 'Music',
        [AudioPreset.LECTURE]: 'Lecture',
        [AudioPreset.CUSTOM]: 'Custom'
      };
      
      Speech.speak(`Applied ${presetNames[preset]} preset`);
    };
    
    announcePresetChange();
  };
  
  // Apply current audio settings to connected devices
  const applyAudioSettings = () => {
    if (connectedDevices.length === 0) return;
    
    // In a real app, we would send these settings to the connected hearing devices
    console.log('Applying audio settings:', {
      audioLevel,
      filterSettings,
      activePreset,
      isAudioProcessingEnabled
    });
    
    // Simulate sending settings to device
    if (selectedDevice) {
      console.log(`Sending settings to ${selectedDevice.name}`);
    }
  };
  
  // Reset to default settings
  const resetToDefault = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all audio settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          onPress: () => {
            setActivePreset(AudioPreset.CONVERSATION);
            setFilterSettings({...PRESET_SETTINGS[AudioPreset.CONVERSATION]});
            setAudioLevel(70);
            applyAudioSettings();
          } 
        }
      ]
    );
  };
  
  // Start live transcription
  const startTranscription = async () => {
    if (isTranscribing) return;
    
    try {
      // Request audio recording permission
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone permission is required for transcription');
        setIsLiveTranscriptionEnabled(false);
        return;
      }
      
      setIsTranscribing(true);
      setTranscription('Listening...');
      
      // Start recording
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recording.current = rec;
      
      // Set up periodic transcription
      transcriptionTimer.current = setInterval(async () => {
        if (recording.current) {
          await processTranscription();
        }
      }, 5000); // Process every 5 seconds
      
    } catch (error) {
      console.error('Error starting transcription:', error);
      setIsTranscribing(false);
      setIsLiveTranscriptionEnabled(false);
    }
  };
  
  // Process the current recording for transcription
  const processTranscription = async () => {
    if (!recording.current) return;
    
    try {
      // Stop current recording
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;
      
      if (!uri) {
        throw new Error('No recording URI available');
      }
      
      // Start a new recording while processing the previous one
      const { recording: newRec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recording.current = newRec;
      
      // In a real app, we would send the audio to a speech-to-text service
      // For demo, simulate a transcription result
      simulateTranscription();
      
    } catch (error) {
      console.error('Error processing transcription:', error);
    }
  };
  
  // Simulate transcription result
  const simulateTranscription = () => {
    const mockTranscriptions = [
      "Hello, how are you today?",
      "Could you please speak up a little?",
      "It's nice to meet you. My name is Sarah.",
      "Can you tell me where the nearest restroom is?",
      "I'm having trouble hearing in this noisy environment.",
      "The weather is really nice today, isn't it?",
      "Would you mind repeating that last part?",
      "I'm interested in learning more about this topic."
    ];
    
    const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
    setTranscription(randomTranscription);
  };
  
  // Stop transcription
  const stopTranscription = async () => {
    if (transcriptionTimer.current) {
      clearInterval(transcriptionTimer.current);
      transcriptionTimer.current = null;
    }
    
    if (recording.current) {
      await recording.current.stopAndUnloadAsync();
      recording.current = null;
    }
    
    setIsTranscribing(false);
  };
  
  // Render device item
  const renderDeviceItem = (device: HearingDevice) => {
    return (
      <View key={device.id} style={styles.deviceItem}>
        <View style={styles.deviceIconContainer}>
          <Ionicons
            name={
              device.type === HearingDeviceType.HEARING_AID ? "ear" :  // Fix: Changed from "hearing" to "ear"
              device.type === HearingDeviceType.COCHLEAR_IMPLANT ? "medkit" :
              device.type === HearingDeviceType.SMART_EARBUDS ? "headset" :
              "bluetooth"
            }
            size={24}
            color="#2196F3"
          />
        </View>
        
        <View style={styles.deviceInfo}>
          <ThemedText style={styles.deviceName}>{device.name}</ThemedText>
          <ThemedText style={styles.deviceType}>
            {device.type.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </ThemedText>
          
          {device.batteryLevel !== undefined && (
            <View style={styles.batteryIndicator}>
              <Ionicons
                name={
                  device.batteryLevel > 80 ? "battery-full" :
                  device.batteryLevel > 50 ? "battery-half" :
                  device.batteryLevel > 20 ? "battery-dead" :
                  "warning"
                }
                size={14}
                color={
                  device.batteryLevel > 20 ? "#4CAF50" : "#F44336"
                }
              />
              <ThemedText style={styles.batteryText}>
                {device.batteryLevel}%
              </ThemedText>
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={[
            styles.connectButton,
            device.isConnected ? styles.disconnectButton : {}
          ]}
          onPress={() => device.isConnected ? disconnectDevice(device) : connectToDevice(device)}
        >
          <ThemedText style={styles.connectButtonText}>
            {device.isConnected ? 'Disconnect' : 'Connect'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Render settings controls
  const renderSettings = () => {
    return (
      <ScrollView style={styles.settingsContainer}>
        {/* Audio level */}
        <View style={styles.settingSection}>
          <View style={styles.settingSectionHeader}>
            <ThemedText style={styles.settingSectionTitle}>Main Volume</ThemedText>
          </View>
          
          <View style={styles.volumeControl}>
            <TouchableOpacity
              style={styles.volumeButton}
              onPress={() => {
                const newLevel = Math.max(0, audioLevel - 5);
                setAudioLevel(newLevel);
                applyAudioSettings();
              }}
            >
              <Ionicons name="volume-low" size={24} color="#2196F3" />
            </TouchableOpacity>
            
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={audioLevel}
              onValueChange={(value) => setAudioLevel(value)}
              onSlidingComplete={applyAudioSettings}
              minimumTrackTintColor="#2196F3"
              maximumTrackTintColor="#BDBDBD"
              thumbTintColor="#2196F3"
            />
            
            <TouchableOpacity
              style={styles.volumeButton}
              onPress={() => {
                const newLevel = Math.min(100, audioLevel + 5);
                setAudioLevel(newLevel);
                applyAudioSettings();
              }}
            >
              <Ionicons name="volume-high" size={24} color="#2196F3" />
            </TouchableOpacity>
            
            <ThemedText style={styles.volumeText}>{Math.round(audioLevel)}%</ThemedText>
          </View>
        </View>
        
        {/* Presets */}
        <View style={styles.settingSection}>
          <View style={styles.settingSectionHeader}>
            <ThemedText style={styles.settingSectionTitle}>Environment Presets</ThemedText>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsContainer}
          >
            <TouchableOpacity
              style={[
                styles.presetButton,
                activePreset === AudioPreset.CONVERSATION ? styles.activePresetButton : {}
              ]}
              onPress={() => applyPreset(AudioPreset.CONVERSATION)}
            >
              <Ionicons name="people" size={24} color={activePreset === AudioPreset.CONVERSATION ? 'white' : '#2196F3'} />
              <ThemedText style={[
                styles.presetButtonText,
                activePreset === AudioPreset.CONVERSATION ? styles.activePresetButtonText : {}
              ]}>Conversation</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.presetButton,
                activePreset === AudioPreset.NOISY ? styles.activePresetButton : {}
              ]}
              onPress={() => applyPreset(AudioPreset.NOISY)}
            >
              <Ionicons name="restaurant" size={24} color={activePreset === AudioPreset.NOISY ? 'white' : '#2196F3'} />
              <ThemedText style={[
                styles.presetButtonText,
                activePreset === AudioPreset.NOISY ? styles.activePresetButtonText : {}
              ]}>Noisy</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.presetButton,
                activePreset === AudioPreset.MUSIC ? styles.activePresetButton : {}
              ]}
              onPress={() => applyPreset(AudioPreset.MUSIC)}
            >
              <Ionicons name="musical-notes" size={24} color={activePreset === AudioPreset.MUSIC ? 'white' : '#2196F3'} />
              <ThemedText style={[
                styles.presetButtonText,
                activePreset === AudioPreset.MUSIC ? styles.activePresetButtonText : {}
              ]}>Music</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.presetButton,
                activePreset === AudioPreset.LECTURE ? styles.activePresetButton : {}
              ]}
              onPress={() => applyPreset(AudioPreset.LECTURE)}
            >
              <Ionicons name="school" size={24} color={activePreset === AudioPreset.LECTURE ? 'white' : '#2196F3'} />
              <ThemedText style={[
                styles.presetButtonText,
                activePreset === AudioPreset.LECTURE ? styles.activePresetButtonText : {}
              ]}>Lecture</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.presetButton,
                activePreset === AudioPreset.CUSTOM ? styles.activePresetButton : {}
              ]}
              onPress={() => applyPreset(AudioPreset.CUSTOM)}
            >
              <Ionicons name="options" size={24} color={activePreset === AudioPreset.CUSTOM ? 'white' : '#2196F3'} />
              <ThemedText style={[
                styles.presetButtonText,
                activePreset === AudioPreset.CUSTOM ? styles.activePresetButtonText : {}
              ]}>Custom</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>
        
        {/* Feature toggles */}
        <View style={styles.settingSection}>
          <View style={styles.settingSectionHeader}>
            <ThemedText style={styles.settingSectionTitle}>Features</ThemedText>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="options" size={20} color="#2196F3" />
              <ThemedText style={styles.settingLabel}>Audio Processing</ThemedText>
            </View>
            <Switch
              value={isAudioProcessingEnabled}
              onValueChange={(value) => {
                setIsAudioProcessingEnabled(value);
                applyAudioSettings();
              }}
              trackColor={{ false: '#767577', true: '#81D4FA' }}
              thumbColor={isAudioProcessingEnabled ? '#2196F3' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="text" size={20} color="#2196F3" />
              <ThemedText style={styles.settingLabel}>Live Transcription</ThemedText>
            </View>
            <Switch
              value={isLiveTranscriptionEnabled}
              onValueChange={setIsLiveTranscriptionEnabled}
              trackColor={{ false: '#767577', true: '#81D4FA' }}
              thumbColor={isLiveTranscriptionEnabled ? '#2196F3' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="analytics" size={20} color="#2196F3" />
              <ThemedText style={styles.settingLabel}>Auto Environment Adjustment</ThemedText>
            </View>
            <Switch
              value={isAutomaticAdjustmentEnabled}
              onValueChange={(value) => {
                setIsAutomaticAdjustmentEnabled(value);
                if (value) {
                  // In a real app, we would analyze the environment and adjust settings
                  applyAudioSettings();
                }
              }}
              trackColor={{ false: '#767577', true: '#81D4FA' }}
              thumbColor={isAutomaticAdjustmentEnabled ? '#2196F3' : '#f4f3f4'}
            />
          </View>
        </View>
        
        {/* Advanced settings */}
        <TouchableOpacity
          style={styles.advancedSettingsButton}
          onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}
        >
          <ThemedText style={styles.advancedSettingsButtonText}>
            {showAdvancedSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
          </ThemedText>
          <Ionicons
            name={showAdvancedSettings ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#2196F3"
          />
        </TouchableOpacity>
        
        {showAdvancedSettings && (
          <View style={styles.advancedSettings}>
            {/* Noise Reduction */}
            <View style={styles.filterSetting}>
              <View style={styles.filterLabelContainer}>
                <ThemedText style={styles.filterLabel}>Noise Reduction</ThemedText>
                <ThemedText style={styles.filterValue}>{filterSettings[FilterType.NOISE_REDUCTION]}%</ThemedText>
              </View>
              <Slider
                style={styles.filterSlider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={filterSettings[FilterType.NOISE_REDUCTION]}
                onValueChange={(value) => updateFilterSetting(FilterType.NOISE_REDUCTION, value)}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#BDBDBD"
                thumbTintColor="#2196F3"
              />
            </View>
            
            {/* Speech Enhancement */}
            <View style={styles.filterSetting}>
              <View style={styles.filterLabelContainer}>
                <ThemedText style={styles.filterLabel}>Speech Enhancement</ThemedText>
                <ThemedText style={styles.filterValue}>{filterSettings[FilterType.SPEECH_ENHANCEMENT]}%</ThemedText>
              </View>
              <Slider
                style={styles.filterSlider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={filterSettings[FilterType.SPEECH_ENHANCEMENT]}
                onValueChange={(value) => updateFilterSetting(FilterType.SPEECH_ENHANCEMENT, value)}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#BDBDBD"
                thumbTintColor="#2196F3"
              />
            </View>
            
            {/* Bass Boost */}
            <View style={styles.filterSetting}>
              <View style={styles.filterLabelContainer}>
                <ThemedText style={styles.filterLabel}>Bass Boost</ThemedText>
                <ThemedText style={styles.filterValue}>{filterSettings[FilterType.BASS_BOOST]}%</ThemedText>
              </View>
              <Slider
                style={styles.filterSlider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={filterSettings[FilterType.BASS_BOOST]}
                onValueChange={(value) => updateFilterSetting(FilterType.BASS_BOOST, value)}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#BDBDBD"
                thumbTintColor="#2196F3"
              />
            </View>
            
            {/* Treble Boost */}
            <View style={styles.filterSetting}>
              <View style={styles.filterLabelContainer}>
                <ThemedText style={styles.filterLabel}>Treble Boost</ThemedText>
                <ThemedText style={styles.filterValue}>{filterSettings[FilterType.TREBLE_BOOST]}%</ThemedText>
              </View>
              <Slider
                style={styles.filterSlider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={filterSettings[FilterType.TREBLE_BOOST]}
                onValueChange={(value) => updateFilterSetting(FilterType.TREBLE_BOOST, value)}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#BDBDBD"
                thumbTintColor="#2196F3"
              />
            </View>
            
            {/* Reset button */}
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetToDefault}
            >
              <ThemedText style={styles.resetButtonText}>Reset to Default</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };
  
  // Render transcription tab
  const renderTranscription = () => {
    return (
      <View style={styles.transcriptionContainer}>
        {isTranscribing ? (
          <View style={styles.activeTranscriptionContainer}>
            <View style={styles.transcriptionStatusBar}>
              <View style={styles.transcriptionStatus}>
                <View style={styles.recordingIndicator} />
                <ThemedText style={styles.transcriptionStatusText}>
                  Listening...
                </ThemedText>
              </View>
              
              <TouchableOpacity
                style={styles.transcriptionControlButton}
                onPress={() => setIsLiveTranscriptionEnabled(false)}
              >
                <Ionicons name="stop" size={20} color="white" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.transcriptionContent}>
              <ThemedText style={styles.transcriptionText}>
                {transcription}
              </ThemedText>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.inactiveTranscriptionContainer}>
            <Ionicons name="mic-off" size={48} color="#BDBDBD" />
            <ThemedText style={styles.inactiveTranscriptionText}>
              Live transcription is disabled
            </ThemedText>
            <TouchableOpacity
              style={styles.startTranscriptionButton}
              onPress={() => setIsLiveTranscriptionEnabled(true)}
            >
              <ThemedText style={styles.startTranscriptionButtonText}>
                Enable Transcription
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Hearing Aid Integration</ThemedText>
        {connectedDevices.length > 0 && (
          <View style={styles.connectedDeviceIndicator}>
            <Ionicons name="bluetooth" size={16} color="#4CAF50" />
            <ThemedText style={styles.connectedDeviceText}>
              {connectedDevices.length} {connectedDevices.length === 1 ? 'device' : 'devices'} connected
            </ThemedText>
          </View>
        )}
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'devices' && styles.activeTab]}
          onPress={() => setActiveTab('devices')}
        >
          <Ionicons
            name="bluetooth"
            size={20}
            color={activeTab === 'devices' ? '#2196F3' : '#757575'}
          />
          <ThemedText style={[styles.tabText, activeTab === 'devices' && styles.activeTabText]}>
            Devices
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons
            name="options"
            size={20}
            color={activeTab === 'settings' ? '#2196F3' : '#757575'}
          />
          <ThemedText style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            Settings
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transcription' && styles.activeTab]}
          onPress={() => setActiveTab('transcription')}
        >
          <Ionicons
            name="text"
            size={20}
            color={activeTab === 'transcription' ? '#2196F3' : '#757575'}
          />
          <ThemedText style={[styles.tabText, activeTab === 'transcription' && styles.activeTabText]}>
            Transcription
          </ThemedText>
        </TouchableOpacity>
      </View>
      
      {/* Tab content */}
      {activeTab === 'devices' && (
        <View style={styles.tabContent}>
          <View style={styles.devicesHeader}>
            <ThemedText style={styles.devicesTitle}>Paired Devices</ThemedText>
            <TouchableOpacity
              style={styles.scanButton}
              onPress={startScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color="white" />
                  <ThemedText style={styles.scanButtonText}>Scan</ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.devicesList}>
            {pairedDevices.length === 0 ? (
              <View style={styles.noDevicesContainer}>
                <Ionicons name="bluetooth" size={48} color="#BDBDBD" />
                <ThemedText style={styles.noDevicesText}>
                  No paired devices found
                </ThemedText>
                <ThemedText style={styles.noDevicesSubText}>
                  Tap "Scan" to search for nearby devices
                </ThemedText>
              </View>
            ) : (
              pairedDevices.map(device => renderDeviceItem(device))
            )}
          </ScrollView>
        </View>
      )}
      
      {activeTab === 'settings' && renderSettings()}
      
      {activeTab === 'transcription' && renderTranscription()}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  connectedDeviceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginRight: 10,
  },
  connectedDeviceText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 5,
  },
  closeButton: {
    padding: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    marginLeft: 5,
    color: '#757575',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  devicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  devicesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  scanButtonText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 12,
  },
  devicesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  noDevicesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  noDevicesText: {
    fontSize: 16,
    marginTop: 15,
    color: '#757575',
  },
  noDevicesSubText: {
    fontSize: 14,
    marginTop: 5,
    color: '#BDBDBD',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
  },
  deviceType: {
    fontSize: 12,
    color: '#757575',
    marginTop: 3,
  },
  batteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  batteryText: {
    fontSize: 12,
    marginLeft: 5,
    color: '#757575',
  },
  connectButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  connectButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  settingsContainer: {
    flex: 1,
    padding: 20,
  },
  settingSection: {
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  settingSectionHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
    marginBottom: 10,
  },
  settingSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  volumeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  volumeButton: {
    padding: 5,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  volumeText: {
    width: 45,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: 'bold',
  },
  presetsContainer: {
    paddingVertical: 10,
  },
  presetButton: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },
  activePresetButton: {
    backgroundColor: '#2196F3',
  },
  presetButtonText: {
    marginTop: 5,
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '500',
  },
  activePresetButtonText: {
    color: 'white',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    marginLeft: 10,
  },
  advancedSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  advancedSettingsButtonText: {
    color: '#2196F3',
    marginRight: 5,
  },
  advancedSettings: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  filterSetting: {
    marginBottom: 15,
  },
  filterLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  filterLabel: {
    fontSize: 14,
  },
  filterValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  filterSlider: {
    height: 40,
  },
  resetButton: {
    backgroundColor: '#F44336',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  transcriptionContainer: {
    flex: 1,
    padding: 20,
  },
  activeTranscriptionContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },
  transcriptionStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  transcriptionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'red',
    marginRight: 10,
  },
  transcriptionStatusText: {
    color: 'white',
    fontWeight: 'bold',
  },
  transcriptionControlButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcriptionContent: {
    flex: 1,
    padding: 15,
  },
  transcriptionText: {
    fontSize: 18,
    lineHeight: 28,
  },
  inactiveTranscriptionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveTranscriptionText: {
    marginTop: 15,
    marginBottom: 20,
    color: '#757575',
  },
  startTranscriptionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  startTranscriptionButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default HearingAidIntegration;