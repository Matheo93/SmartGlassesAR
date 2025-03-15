// components/BluetoothConnection.tsx
import React, { useState, useEffect } from 'react';
import { 
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  Platform
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useBluetooth, HapticFeedbackType, GlassesConfig } from '../services/BluetoothService';
import { ThemedText } from './ui/ThemedText';
import { ThemedView } from './ui/ThemedView';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

type BluetoothConnectionProps = {
  onClose?: () => void;
};

export const BluetoothConnection: React.FC<BluetoothConnectionProps> = ({
  onClose,
}) => {
  // Get Bluetooth service hooks
  const {
    isScanning,
    isConnecting,
    devices,
    connectedDevice,
    batteryLevel,
    error,
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    sendHapticFeedback,
    getBatteryLevel,
    sendConfiguration,
  } = useBluetooth();
  
  // State for configuration
  const [config, setConfig] = useState<GlassesConfig>({
    displayBrightness: 70,
    hapticFeedbackEnabled: true,
    voiceAssistantEnabled: true,
    batteryThreshold: 20,
  });
  
  // UI state
  const [selectedTab, setSelectedTab] = useState<'devices' | 'settings'>('devices');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  
  // Update battery level periodically
  useEffect(() => {
    if (connectedDevice) {
      const interval = setInterval(() => {
        getBatteryLevel().catch(console.error);
      }, 30000); // Every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [connectedDevice, getBatteryLevel]);
  
  // Handle connection
  const handleConnect = (deviceId: string) => {
    connectToDevice(deviceId);
  };
  
  // Handle disconnect
  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from the smart glasses?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect',
          style: 'destructive',
          onPress: disconnect
        }
      ]
    );
  };
  
  // Save configuration
  const handleSaveConfig = async () => {
    try {
      await sendConfiguration(config);
      Alert.alert('Success', 'Configuration saved successfully');
    } catch (error) {
      console.error('Configuration error:', error);
      Alert.alert('Error', 'Failed to save configuration');
    }
  };
  
  // Test haptic feedback
  const handleTestHaptic = (type: HapticFeedbackType) => {
    sendHapticFeedback(type, 100)
      .catch((err) => {
        console.error('Haptic feedback error:', err);
        Alert.alert('Error', 'Failed to send haptic feedback');
      });
  };
  
  // Render battery indicator
  const renderBatteryIndicator = () => {
    let batteryIcon = 'battery-dead';
    let batteryColor = '#F44336';
    
    if (batteryLevel >= 80) {
      batteryIcon = 'battery-full';
      batteryColor = '#4CAF50';
    } else if (batteryLevel >= 50) {
      batteryIcon = 'battery-half';
      batteryColor = '#FFC107';
    } else if (batteryLevel >= 20) {
      batteryIcon = 'battery-low';
      batteryColor = '#FF9800';
    }
    
    return (
      <View style={styles.batteryIndicator}>
        <Ionicons name={batteryIcon as any} size={18} color={batteryColor} />
        <ThemedText style={[styles.batteryText, { color: batteryColor }]}>
          {batteryLevel}%
        </ThemedText>
      </View>
    );
  };
  
  // Render devices list
  const renderDevicesList = () => {
    return (
      <ThemedView style={styles.tabContent}>
        {devices.length === 0 && !isScanning ? (
          <ThemedView style={styles.emptyState}>
            <MaterialIcons name="bluetooth-searching" size={48} color="#BDBDBD" />
            <ThemedText style={styles.emptyStateText}>
              No devices found. Press "Scan" to start searching.
            </ThemedText>
          </ThemedView>
        ) : (
          <ScrollView style={styles.devicesList}>
            {devices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={styles.deviceItem}
                onPress={() => handleConnect(device.id)}
                disabled={isConnecting || (connectedDevice?.id === device.id)}
              >
                <View style={styles.deviceInfo}>
                  <View style={styles.deviceNameContainer}>
                    <Ionicons 
                      name="glasses-outline" 
                      size={20} 
                      color={device.name?.includes('SmartGlasses') ? '#2196F3' : '#777'} 
                    />
                    <ThemedText style={styles.deviceName}>
                      {device.name || 'Unknown Device'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.deviceId}>
                    ID: {device.id.substring(0, 8)}...
                  </ThemedText>
                </View>
                
                {connectedDevice?.id === device.id ? (
                  <View style={styles.connectedIndicator}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    <ThemedText style={styles.connectedText}>Connected</ThemedText>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={24} color="#777" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        
        <View style={styles.scanButtonContainer}>
          <TouchableOpacity 
            style={[styles.scanButton, isScanning && styles.scanningButton]} 
            onPress={isScanning ? stopScan : startScan}
            disabled={isConnecting}
          >
            {isScanning ? (
              <View style={styles.scanningIndicator}>
                <ActivityIndicator size="small" color="white" />
                <ThemedText style={styles.scanButtonText}>Scanning...</ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.scanButtonText}>
                Scan for Glasses
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  };
  
  // Render settings
  const renderSettings = () => {
    if (!connectedDevice) {
      return (
        <ThemedView style={[styles.tabContent, styles.emptyState]}>
          <MaterialIcons name="bluetooth-disabled" size={48} color="#BDBDBD" />
          <ThemedText style={styles.emptyStateText}>
            Please connect to a device first to adjust settings.
          </ThemedText>
        </ThemedView>
      );
    }
    
    return (
      <ThemedView style={styles.tabContent}>
        <ScrollView>
          <View style={styles.settingSection}>
            <ThemedText style={styles.settingSectionTitle}>Display</ThemedText>
            
            <View style={styles.settingItem}>
              <ThemedText>Brightness</ThemedText>
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100}
                  step={5}
                  value={config.displayBrightness}
                  onValueChange={(value: number) => setConfig({ ...config, displayBrightness: value })}
                  minimumTrackTintColor="#2196F3"
                  maximumTrackTintColor="#BDBDBD"
                  thumbTintColor="#2196F3"
                />
                <ThemedText style={styles.sliderValue}>
                  {Math.round(config.displayBrightness)}%
                </ThemedText>
              </View>
            </View>
          </View>
          
          <View style={styles.settingSection}>
            <ThemedText style={styles.settingSectionTitle}>Features</ThemedText>
            
            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="pulse-outline" size={20} color="#2196F3" />
                <ThemedText style={styles.settingLabel}>Haptic Feedback</ThemedText>
              </View>
              <Switch
                value={config.hapticFeedbackEnabled}
                onValueChange={(value) => setConfig({ ...config, hapticFeedbackEnabled: value })}
                trackColor={{ false: '#767577', true: '#81D4FA' }}
                thumbColor={config.hapticFeedbackEnabled ? '#2196F3' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="mic" size={20} color="#2196F3" />
                <ThemedText style={styles.settingLabel}>Voice Assistant</ThemedText>
              </View>
              <Switch
                value={config.voiceAssistantEnabled}
                onValueChange={(value) => setConfig({ ...config, voiceAssistantEnabled: value })}
                trackColor={{ false: '#767577', true: '#81D4FA' }}
                thumbColor={config.voiceAssistantEnabled ? '#2196F3' : '#f4f3f4'}
              />
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.advancedSettingsToggle}
            onPress={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <ThemedText style={styles.advancedSettingsToggleText}>
              {showAdvancedSettings ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
            </ThemedText>
            <Ionicons 
              name={showAdvancedSettings ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color="#777" 
            />
          </TouchableOpacity>
          
          {showAdvancedSettings && (
            <View style={styles.settingSection}>
              <ThemedText style={styles.settingSectionTitle}>Advanced Settings</ThemedText>
              
              <View style={styles.settingItem}>
                <ThemedText>Battery Alert Threshold</ThemedText>
                <View style={styles.sliderContainer}>
                  <Slider
                    style={styles.slider}
                    minimumValue={5}
                    maximumValue={50}
                    step={5}
                    value={config.batteryThreshold}
                    onValueChange={(value: number) => setConfig({ ...config, batteryThreshold: value })}
                    minimumTrackTintColor="#2196F3"
                    maximumTrackTintColor="#BDBDBD"
                    thumbTintColor="#2196F3"
                  />
                  <ThemedText style={styles.sliderValue}>
                    {Math.round(config.batteryThreshold)}%
                  </ThemedText>
                </View>
              </View>
            </View>
          )}
          
          <View style={styles.settingSection}>
            <ThemedText style={styles.settingSectionTitle}>Test Haptic Feedback</ThemedText>
            
            <View style={styles.hapticButtonsContainer}>
              <TouchableOpacity
                style={styles.hapticButton}
                onPress={() => handleTestHaptic(HapticFeedbackType.SHORT)}
              >
                <ThemedText style={styles.hapticButtonText}>Short</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.hapticButton}
                onPress={() => handleTestHaptic(HapticFeedbackType.MEDIUM)}
              >
                <ThemedText style={styles.hapticButtonText}>Medium</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.hapticButton}
                onPress={() => handleTestHaptic(HapticFeedbackType.LONG)}
              >
                <ThemedText style={styles.hapticButtonText}>Long</ThemedText>
              </TouchableOpacity>
            </View>
            
            <View style={styles.hapticButtonsContainer}>
              <TouchableOpacity
                style={styles.hapticButton}
                onPress={() => handleTestHaptic(HapticFeedbackType.LEFT_DIRECTION)}
              >
                <ThemedText style={styles.hapticButtonText}>Left</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.hapticButton}
                onPress={() => handleTestHaptic(HapticFeedbackType.STRAIGHT_DIRECTION)}
              >
                <ThemedText style={styles.hapticButtonText}>Straight</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.hapticButton}
                onPress={() => handleTestHaptic(HapticFeedbackType.RIGHT_DIRECTION)}
              >
                <ThemedText style={styles.hapticButtonText}>Right</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveConfig}
          >
            <ThemedText style={styles.saveButtonText}>Save Configuration</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Smart Glasses Connection</ThemedText>
        
        {connectedDevice && renderBatteryIndicator()}
        
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}
      
      {/* Loading indicator */}
      {isConnecting && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <ThemedText style={styles.loadingText}>
            Connecting to device...
          </ThemedText>
        </View>
      )}
      
      {/* Connected device info */}
      {connectedDevice && !isConnecting && (
        <View style={styles.connectedDeviceContainer}>
          <View style={styles.connectedDeviceInfo}>
            <Ionicons name="glasses" size={24} color="#2196F3" />
            <View style={styles.connectedDeviceDetails}>
              <ThemedText style={styles.connectedDeviceName}>
                {connectedDevice.name || 'Unknown Device'}
              </ThemedText>
              <ThemedText style={styles.connectedDeviceId}>
                Connected • ID: {connectedDevice.id.substring(0, 8)}...
              </ThemedText>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={handleDisconnect}
          >
            <ThemedText style={styles.disconnectButtonText}>Disconnect</ThemedText>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Tabs */}
      {!isConnecting && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'devices' && styles.activeTab]}
            onPress={() => setSelectedTab('devices')}
          >
            <Ionicons
              name="bluetooth"
              size={20}
              color={selectedTab === 'devices' ? '#2196F3' : '#777'}
            />
            <ThemedText style={[
              styles.tabText,
              selectedTab === 'devices' && styles.activeTabText
            ]}>
              Devices
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'settings' && styles.activeTab]}
            onPress={() => setSelectedTab('settings')}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={selectedTab === 'settings' ? '#2196F3' : '#777'}
            />
            <ThemedText style={[
              styles.tabText,
              selectedTab === 'settings' && styles.activeTabText
            ]}>
              Settings
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Tab content */}
      {!isConnecting && (
        selectedTab === 'devices' ? renderDevicesList() : renderSettings()
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  errorContainer: {
    margin: 15,
    padding: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 5,
  },
  errorText: {
    color: '#D32F2F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  connectedDeviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 15,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
  },
  connectedDeviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  connectedDeviceDetails: {
    marginLeft: 10,
  },
  connectedDeviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  connectedDeviceId: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  disconnectButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  disconnectButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 12,
  },
  batteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  tabContainer: {
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
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 15,
  },
  devicesList: {
    flex: 1,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  deviceId: {
    fontSize: 12,
    color: '#777',
  },
  connectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  scanButtonContainer: {
    marginTop: 15,
  },
  scanButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  scanningButton: {
    backgroundColor: '#1976D2',
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    textAlign: 'center',
    marginTop: 15,
    color: '#777',
    fontSize: 16,
  },
  settingSection: {
    marginBottom: 20,
  },
  settingSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    marginLeft: 10,
    fontSize: 16,
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    width: 40,
    textAlign: 'right',
    fontSize: 14,
  },
  advancedSettingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginVertical: 10,
  },
  advancedSettingsToggleText: {
    color: '#2196F3',
    marginRight: 5,
  },
  hapticButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  hapticButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  hapticButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 20,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default BluetoothConnection;