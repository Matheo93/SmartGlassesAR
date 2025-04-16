// BluetoothService.ts - Service de communication Bluetooth amélioré
import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

// UUID constants for services and characteristics
// These would need to be replaced with the actual UUIDs of your smart glasses
const GLASSES_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const HAPTIC_FEEDBACK_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const BATTERY_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
const DISPLAY_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';

// Types
export interface BluetoothDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  connected: boolean;
  manufacturerData?: string;
  serviceUUIDs?: string[] | null;
  discoverAllServicesAndCharacteristics?: () => Promise<BluetoothDevice>;
  getMtu?: () => Promise<number>;
  onDisconnected?: (callback: (error: Error | null, device: BluetoothDevice | null) => void) => void;
}

export enum HapticFeedbackType {
  SHORT = 0x01,
  MEDIUM = 0x02,
  LONG = 0x03,
  LEFT_DIRECTION = 0x04,
  RIGHT_DIRECTION = 0x05,
  STRAIGHT_DIRECTION = 0x06,
  WARNING = 0x07,
  SUCCESS = 0x08,
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  SCANNING = 'scanning',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface GlassesConfig {
  displayBrightness: number; // 0-100
  hapticFeedbackEnabled: boolean;
  voiceAssistantEnabled: boolean;
  batteryThreshold: number; // 0-100
}

export interface DeviceInfo {
  id: string;
  name: string | null;
  rssi: number | null;
  mtu?: number;
  manufacturer?: string | null;
  serviceUUIDs?: string[] | null;
  isConnected: boolean;
  batteryLevel?: number;
}

// Mock BLE Manager implementation for development and testing
class MockBleManager {
  private mockDevices: BluetoothDevice[] = [
    { id: 'device1', name: 'SmartGlasses-001', rssi: -65, connected: false },
    { id: 'device2', name: 'SmartGlasses-002', rssi: -72, connected: false },
    { id: 'device3', name: 'OtherDevice', rssi: -80, connected: false },
  ];
  
  private connectedDevice: BluetoothDevice | null = null;
  private mockBatteryLevel: number = 75;
  private mockConfig: GlassesConfig = {
    displayBrightness: 70,
    hapticFeedbackEnabled: true,
    voiceAssistantEnabled: true,
    batteryThreshold: 20,
  };
  
  // Start scanning for devices
  startDeviceScan(
    serviceUUIDs: string[] | null,
    options: any,
    callback: (error: Error | null, device: BluetoothDevice | null) => void
  ) {
    // Simulate delay in discovering devices
    setTimeout(() => {
      this.mockDevices.forEach(device => {
        callback(null, device);
      });
    }, 1000);
  }
  
  // Stop scanning
  stopDeviceScan() {
    // No action needed in mock
  }
  
  // Check Bluetooth state
  async state(): Promise<'PoweredOn' | 'PoweredOff'> {
    return 'PoweredOn';
  }
  
  // Connect to device
  async connectToDevice(deviceId: string): Promise<BluetoothDevice> {
    const device = this.mockDevices.find(d => d.id === deviceId);
    
    if (!device) {
      throw new Error('Device not found');
    }
    
    // Simulate connection delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        device.connected = true;
        this.connectedDevice = device;
        resolve(device);
      }, 1500);
    });
  }
  
  // Disconnect from device
  async cancelConnection(deviceId?: string): Promise<void> {
    if (this.connectedDevice) {
      this.connectedDevice.connected = false;
      this.connectedDevice = null;
    }
  }
  
  // Discover services and characteristics
  async discoverAllServicesAndCharacteristics(device: BluetoothDevice): Promise<BluetoothDevice> {
    // Simulate discovery delay
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(device);
      }, 1000);
    });
  }
  
  // Read battery level
  async readCharacteristicForService(
    serviceUUID: string,
    characteristicUUID: string
  ): Promise<{ value: string }> {
    if (characteristicUUID === BATTERY_CHARACTERISTIC_UUID) {
      // Return mock battery level
      return {
        value: Buffer.from([this.mockBatteryLevel]).toString('base64')
      };
    }
    
    throw new Error('Characteristic not supported in mock');
  }
  
  // Write to characteristic
  async writeCharacteristicWithResponseForService(
    serviceUUID: string,
    characteristicUUID: string,
    value: string
  ): Promise<void> {
    // Handle haptic feedback
    if (characteristicUUID === HAPTIC_FEEDBACK_CHARACTERISTIC_UUID) {
      console.log('Mock haptic feedback sent');
      return;
    }
    
    // Handle configuration
    if (characteristicUUID === DISPLAY_CHARACTERISTIC_UUID) {
      const buffer = Buffer.from(value, 'base64');
      
      // Update mock config based on the received data
      this.mockConfig = {
        displayBrightness: buffer[0],
        hapticFeedbackEnabled: buffer[1] === 1,
        voiceAssistantEnabled: buffer[2] === 1,
        batteryThreshold: buffer[3],
      };
      
      console.log('Mock config updated:', this.mockConfig);
      return;
    }
    
    throw new Error('Characteristic not supported in mock');
  }
  
  // Set up notifications for a characteristic
  async monitorCharacteristicForService(
    serviceUUID: string,
    characteristicUUID: string,
    listener: (error: Error | null, characteristic: any) => void
  ): Promise<void> {
    // Simulate occasional battery updates
    if (characteristicUUID === BATTERY_CHARACTERISTIC_UUID) {
      setInterval(() => {
        // Decrease battery by 1% randomly
        if (Math.random() > 0.7) {
          this.mockBatteryLevel = Math.max(0, this.mockBatteryLevel - 1);
          
          listener(null, {
            value: Buffer.from([this.mockBatteryLevel]).toString('base64')
          });
        }
      }, 10000);
    }
  }
  
  // Get MTU
  async getMtu(deviceId: string): Promise<number> {
    return 512; // Mock MTU value
  }
  
  // Setup disconnection listener
  onDeviceDisconnected(
    deviceId: string,
    listener: (error: Error | null, device: any) => void
  ) {
    // Mock implementation - return a function to remove the listener
    return {
      remove: () => {}
    };
  }
  
  // Enable Bluetooth (Android only)
  async enable(): Promise<void> {
    // Mock implementation - do nothing
  }
}

/**
 * Service amélioré de gestion Bluetooth pour la communication avec les lunettes
 * et l'envoi de retour haptique
 */
export class BluetoothService {
  private static instance: BluetoothService;
  private bleManager: any;
  private device: BluetoothDevice | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private connectionStateListeners: ((state: ConnectionState) => void)[] = [];
  private deviceDiscoveryListeners: ((devices: BluetoothDevice[]) => void)[] = [];
  private discoveredDevices: Map<string, BluetoothDevice> = new Map();
  private connectSubscription: any = null;
  private reconnectAttempts = 0;
  private scanTimeout: any = null;
  private batteryCheckInterval: any = null;
  
  // Configuration
  private config = {
    serviceLookupName: 'SmartGlasses',
    scanTimeout: 10000,
    reconnectAttempts: 3,
    autoConnect: true,
    debug: false
  };
  
  private constructor() {
    try {
      // Use the mock BLE manager for development
      this.bleManager = new MockBleManager();
      
      // In a real application, we would use a real BLE library:
      // if (Platform.OS !== 'web') {
      //   const { BleManager } = require('react-native-ble-plx');
      //   this.bleManager = new BleManager();
      // } else {
      //   throw new Error('Bluetooth not supported on web');
      // }
      
      // Listen for state changes
      if (this.bleManager.onStateChange) {
        this.bleManager.onStateChange((state: string) => {
          if (state === 'PoweredOn' && this.config.autoConnect) {
            this.scanAndConnect();
          }
        }, true);
      }
    } catch (error) {
      console.error('Error initializing BLE manager:', error);
    }
  }
  
  // Get singleton instance
  public static getInstance(): BluetoothService {
    if (!BluetoothService.instance) {
      BluetoothService.instance = new BluetoothService();
    }
    return BluetoothService.instance;
  }
  
  // Update configuration
  public updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    if (this.config.debug) {
      console.log('Bluetooth config updated:', this.config);
    }
  }
  
  // Initialize Bluetooth service
  public async initialize(): Promise<boolean> {
    try {
      // Check Bluetooth state
      const state = await this.bleManager.state();
      
      if (state === 'PoweredOn') {
        if (this.config.autoConnect) {
          this.scanAndConnect();
        }
        return true;
      } else {
        // On Android, we can try to enable Bluetooth
        if (Platform.OS === 'android') {
          try {
            await this.bleManager.enable();
            if (this.config.autoConnect) {
              this.scanAndConnect();
            }
            return true;
          } catch (error) {
            console.error('Error enabling Bluetooth:', error);
            this.updateConnectionState(ConnectionState.ERROR);
            return false;
          }
        } else {
          // On iOS, user must enable Bluetooth manually
          console.log('Bluetooth is not enabled');
          this.updateConnectionState(ConnectionState.DISCONNECTED);
          return false;
        }
      }
    } catch (error) {
      console.error('Error initializing Bluetooth:', error);
      this.updateConnectionState(ConnectionState.ERROR);
      return false;
    }
  }
  
  // Request required permissions for Bluetooth
  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        // For Android 12+, we need to request fine location, and Bluetooth permissions
        const grantedLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        let bluetoothScanGranted = true;
        let bluetoothConnectGranted = true;
        
        // Check Android version for newer Bluetooth permissions
        if (parseInt(Platform.Version.toString(), 10) >= 31) { // Android 12+
          bluetoothScanGranted = await PermissionsAndroid.request(
            'android.permission.BLUETOOTH_SCAN' as any
          ) === PermissionsAndroid.RESULTS.GRANTED;
          
          bluetoothConnectGranted = await PermissionsAndroid.request(
            'android.permission.BLUETOOTH_CONNECT' as any
          ) === PermissionsAndroid.RESULTS.GRANTED;
        }
        
        return (
          grantedLocation === PermissionsAndroid.RESULTS.GRANTED &&
          bluetoothScanGranted &&
          bluetoothConnectGranted
        );
      } catch (error) {
        console.error('Error requesting permissions:', error);
        return false;
      }
    }
    
    // For iOS, permissions are requested at runtime
    return true;
  }
  
  // Scan for devices and connect
  public async scanAndConnect(): Promise<void> {
    if (this.connectionState === ConnectionState.SCANNING || 
        this.connectionState === ConnectionState.CONNECTING) {
      return;
    }
    
    try {
      this.updateConnectionState(ConnectionState.SCANNING);
      this.discoveredDevices.clear();
      
      // Stop any ongoing scan
      this.bleManager.stopDeviceScan();
      
      // Set a timeout for scanning
      this.scanTimeout = setTimeout(() => {
        this.bleManager.stopDeviceScan();
        if (this.connectionState === ConnectionState.SCANNING) {
          this.updateConnectionState(ConnectionState.DISCONNECTED);
        }
      }, this.config.scanTimeout);
      
      // Start scanning for devices
      this.bleManager.startDeviceScan(null, null, (error: Error | null, device: BluetoothDevice | null) => {
        if (error) {
          console.error('Error scanning for devices:', error);
          this.updateConnectionState(ConnectionState.ERROR);
          clearTimeout(this.scanTimeout);
          return;
        }
        
        // Use a more thorough check that TypeScript will be happy with
        if (device && typeof device.name === 'string' && device.name.includes(this.config.serviceLookupName)) {
          // Store discovered device
          this.discoveredDevices.set(device.id, device);
          
          // Notify listeners
          this.notifyDeviceDiscoveryListeners();
          
          // Automatically connect to first device found
          if (this.config.autoConnect && this.connectionState === ConnectionState.SCANNING) {
            this.connectToDevice(device);
          }
        }
      });
    } catch (error) {
      console.error('Error scanning and connecting:', error);
      this.updateConnectionState(ConnectionState.ERROR);
    }
  }
  public async isBluetoothEnabled(): Promise<boolean> {
    try {
      const state = await this.bleManager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      return false;
    }
  }
  // Connect to a specific device
  public async connectToDevice(device: BluetoothDevice): Promise<boolean> {
    try {
      // Stop scanning
      this.bleManager.stopDeviceScan();
      clearTimeout(this.scanTimeout);
      
      this.updateConnectionState(ConnectionState.CONNECTING);
      
      // Connect to device
      this.device = await this.bleManager.connectToDevice(device.id);
      if (this.device && this.device.discoverAllServicesAndCharacteristics) {
        await this.device.discoverAllServicesAndCharacteristics();
      }
      
      // Setup disconnection handler
      this.connectSubscription = this.bleManager.onDeviceDisconnected(
        this.device?.id || '', // Use optional chaining and provide default empty string
        (error: Error | null, disconnectedDevice: BluetoothDevice | null) => {
          this.handleDisconnection(error);
        }
      );
      
      // Start periodic battery checks
      this.startBatteryCheck();
      
      this.updateConnectionState(ConnectionState.CONNECTED);
      return true;
    } catch (error) {
      console.error('Error connecting to device:', error);
      this.updateConnectionState(ConnectionState.ERROR);
      return false;
    }
  }
  
  // Disconnect device
  public async disconnect(): Promise<void> {
    try {
      if (this.device && this.device.connected) {
        await this.bleManager.cancelConnection(this.device.id);
      }
      
      if (this.connectSubscription) {
        this.connectSubscription.remove();
        this.connectSubscription = null;
      }
      
      this.stopBatteryCheck();
      this.device = null;
      this.updateConnectionState(ConnectionState.DISCONNECTED);
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }
  
  // Handle disconnection
  private handleDisconnection(error: Error | null): void {
    if (this.config.debug) {
      console.log('Device disconnected:', error ? error.message : 'normal disconnection');
    }
    
    this.stopBatteryCheck();
    
    // Try to reconnect if disconnection wasn't voluntary
    if (this.connectionState !== ConnectionState.DISCONNECTED && 
        this.reconnectAttempts < this.config.reconnectAttempts) {
      this.reconnectAttempts++;
      
      if (this.config.debug) {
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.config.reconnectAttempts}`);
      }
      
      setTimeout(() => {
        if (this.device) {
          this.connectToDevice(this.device);
        } else {
          this.scanAndConnect();
        }
      }, 1000);
    } else {
      this.updateConnectionState(ConnectionState.DISCONNECTED);
      this.reconnectAttempts = 0;
    }
  }
  
  // Start periodic battery checks
  private startBatteryCheck(): void {
    this.stopBatteryCheck();
    
    this.batteryCheckInterval = setInterval(async () => {
      await this.checkBatteryLevel();
    }, 30000); // Check every 30 seconds
    
    // Check immediately
    this.checkBatteryLevel();
  }
  
  // Stop periodic battery checks
  private stopBatteryCheck(): void {
    if (this.batteryCheckInterval) {
      clearInterval(this.batteryCheckInterval);
      this.batteryCheckInterval = null;
    }
  }
  
  // Check battery level
  public async checkBatteryLevel(): Promise<number | null> {
    try {
      if (!this.device || !this.device.connected) {
        return null;
      }
      
      const characteristic = await this.bleManager.readCharacteristicForService(
        GLASSES_SERVICE_UUID,
        BATTERY_CHARACTERISTIC_UUID
      );
      
      if (characteristic && characteristic.value) {
        const bytes = Buffer.from(characteristic.value, 'base64');
        const batteryLevel = bytes[0];
        
        if (this.config.debug) {
          console.log('Battery level:', batteryLevel);
        }
        
        return batteryLevel;
      }
      
      return null;
    } catch (error) {
      if (this.config.debug) {
        console.error('Error reading battery level:', error);
      }
      return null;
    }
  }
  
  // Get connected device info
  public async getConnectedDeviceInfo(): Promise<DeviceInfo | null> {
    try {
      if (!this.device || !this.device.connected) {
        return null;
      }
      
      let batteryLevel: number | null = null;
      try {
        if (this.device && this.device.connected) {
          const characteristic = await this.bleManager.readCharacteristicForService(
            GLASSES_SERVICE_UUID,
            BATTERY_CHARACTERISTIC_UUID
          );
          
          if (characteristic && characteristic.value) {
            const bytes = Buffer.from(characteristic.value, 'base64');
            batteryLevel = bytes[0];
          }
        }
      } catch (error) {
        console.error('Error reading battery level:', error);
      }
      
      let mtu = 512; // Default value
      
      try {
        if (this.device && this.device.getMtu) {
          mtu = await this.device.getMtu();
        }
      } catch {
        // Keep the default value if there's an error
      }
      
      return {
        id: this.device.id,
        name: this.device.name,
        rssi: this.device.rssi,
        mtu,
        manufacturer: this.device.manufacturerData ? this.parseManufacturerData(this.device.manufacturerData) : null,
        serviceUUIDs: this.device.serviceUUIDs,
        isConnected: this.device.connected,
        batteryLevel: batteryLevel || undefined
      };
    } catch (error) {
      console.error('Error getting connected device info:', error);
      return null;
    }
  }
  
  // Parse manufacturer data
  private parseManufacturerData(data: string): string {
    try {
      const buffer = Buffer.from(data, 'base64');
      return buffer.toString('hex');
    } catch (error) {
      return 'Unknown';
    }
  }
  
  // Send haptic feedback
  public async sendHapticFeedback(
    type: HapticFeedbackType,
    intensity: number = 100 // 0-100
  ): Promise<boolean> {
    try {
      if (!this.device || !this.device.connected) {
        return false;
      }
      
      // Limit intensity between 0 and 100
      intensity = Math.max(0, Math.min(100, intensity));
      
      // Create data packet
      const data = Buffer.alloc(2);
      data[0] = type;
      data[1] = intensity;
      
      // Convert to Base64 for BLE
      const base64Data = data.toString('base64');
      
      // Write to characteristic
      await this.bleManager.writeCharacteristicWithResponseForService(
        GLASSES_SERVICE_UUID,
        HAPTIC_FEEDBACK_CHARACTERISTIC_UUID,
        base64Data
      );
      
      return true;
    } catch (error) {
      console.error('Error sending haptic feedback:', error);
      return false;
    }
  }
  
  // Send haptic sequence
  public async sendHapticSequence(
    sequence: Array<{ type: HapticFeedbackType, intensity: number, duration: number }>
  ): Promise<boolean> {
    try {
      for (const item of sequence) {
        const success = await this.sendHapticFeedback(item.type, item.intensity);
        if (!success) {
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, item.duration));
      }
      return true;
    } catch (error) {
      console.error('Error sending haptic sequence:', error);
      return false;
    }
  }
  
  // Send configuration to glasses
  public async sendConfiguration(config: GlassesConfig): Promise<void> {
    if (!this.device || !this.device.connected) {
      throw new Error('No device connected');
    }
    
    try {
      const data = Buffer.alloc(4);
      data[0] = Math.max(0, Math.min(100, config.displayBrightness));
      data[1] = config.hapticFeedbackEnabled ? 1 : 0;
      data[2] = config.voiceAssistantEnabled ? 1 : 0;
      data[3] = Math.max(0, Math.min(100, config.batteryThreshold));
      
      await this.bleManager.writeCharacteristicWithResponseForService(
        GLASSES_SERVICE_UUID,
        DISPLAY_CHARACTERISTIC_UUID,
        data.toString('base64')
      );
    } catch (error) {
      console.error('Error sending configuration:', error);
      throw error;
    }
  }
  
  // Update connection state and notify listeners
  private updateConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    
    // Notify listeners
    this.connectionStateListeners.forEach(listener => {
      listener(state);
    });
    
    if (this.config.debug) {
      console.log('Bluetooth connection state:', state);
    }
  }
  
  // Get current connection state
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  // Add connection state listener
  public addConnectionStateListener(listener: (state: ConnectionState) => void): () => void {
    this.connectionStateListeners.push(listener);
    
    // Return a function to remove the listener
    return () => {
      this.connectionStateListeners = this.connectionStateListeners.filter(l => l !== listener);
    };
  }
  
  // Add device discovery listener
  public addDeviceDiscoveryListener(listener: (devices: BluetoothDevice[]) => void): () => void {
    this.deviceDiscoveryListeners.push(listener);
    
    // Return a function to remove the listener
    return () => {
      this.deviceDiscoveryListeners = this.deviceDiscoveryListeners.filter(l => l !== listener);
    };
  }
  
  // Notify device discovery listeners
  private notifyDeviceDiscoveryListeners(): void {
    const devices = Array.from(this.discoveredDevices.values());
    this.deviceDiscoveryListeners.forEach(listener => {
      listener(devices);
    });
  }
  
  // Cleanup resources
  public cleanup(): void {
    this.bleManager.stopDeviceScan();
    clearTimeout(this.scanTimeout);
    this.stopBatteryCheck();
    
    if (this.connectSubscription) {
      this.connectSubscription.remove();
      this.connectSubscription = null;
    }
    
    if (this.device && this.device.connected) {
      this.bleManager.cancelConnection(this.device.id);
    }
    
    this.connectionStateListeners = [];
    this.deviceDiscoveryListeners = [];
    this.discoveredDevices.clear();
    this.device = null;
  }
}

// React Hook for using the Bluetooth service
export function useBluetooth() {
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // Get the singleton instance of BluetoothService
  const bluetoothService = BluetoothService.getInstance();
  
  // Initialize - request permissions on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const hasPermissions = await bluetoothService.requestPermissions();
        
        if (!hasPermissions) {
          setError('Bluetooth permissions denied');
          return;
        }
        
        const isEnabled = await bluetoothService.isBluetoothEnabled();
        
        if (!isEnabled) {
          setError('Bluetooth is not enabled');
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Initialization error: ${message}`);
      }
    };
    
    initialize();
    
    // Monitor connection state
    const removeListener = bluetoothService.addConnectionStateListener((state) => {
      setIsScanning(state === ConnectionState.SCANNING);
      setIsConnecting(state === ConnectionState.CONNECTING);
      if (state === ConnectionState.CONNECTED) {
        bluetoothService.getConnectedDeviceInfo().then(info => {
          if (info) {
            setConnectedDevice({
              id: info.id,
              name: info.name,
              rssi: info.rssi,
              connected: true
            });
            if (info.batteryLevel) {
              setBatteryLevel(info.batteryLevel);
            }
          }
        });
      } else if (state === ConnectionState.DISCONNECTED) {
        setConnectedDevice(null);
      }
    });
    
    return () => {
      removeListener();
    };
  }, []);
  
  // Start scanning for devices
  const startScan = useCallback(async () => {
    try {
      setIsScanning(true);
      setError(null);
      setDevices([]);
      
      // Add discovery listener
      const removeListener = bluetoothService.addDeviceDiscoveryListener((discoveredDevices) => {
        setDevices(discoveredDevices);
      });
      
      bluetoothService.scanAndConnect();
      
      // Auto-stop scan after 10 seconds
      setTimeout(() => {
        if (isScanning) {
          stopScan();
          removeListener();
        }
      }, 10000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Scan error: ${message}`);
      setIsScanning(false);
    }
  }, [isScanning]);
  
  // Stop scanning
  const stopScan = useCallback(() => {
    setIsScanning(false);
  }, []);
  
  // Connect to device
  const connectToDevice = useCallback(async (deviceId: string) => {
    try {
      setIsConnecting(true);
      setError(null);
      
      const device = devices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found');
      }
      
      const success = await bluetoothService.connectToDevice(device);
      
      if (success) {
        const info = await bluetoothService.getConnectedDeviceInfo();
        if (info) {
          setConnectedDevice({
            id: info.id,
            name: info.name,
            rssi: info.rssi,
            connected: true
          });
          if (info.batteryLevel) {
            setBatteryLevel(info.batteryLevel);
          }
        }
      }
      
      setIsConnecting(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Connection error: ${message}`);
      setIsConnecting(false);
    }
  }, [devices]);
  
  // Disconnect from device
  const disconnect = useCallback(async () => {
    try {
      await bluetoothService.disconnect();
      setConnectedDevice(null);
      setBatteryLevel(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Disconnection error: ${message}`);
    }
  }, []);
  
  // Send haptic feedback
  const sendHapticFeedback = useCallback(async (
    type: HapticFeedbackType,
    intensity: number = 100
  ) => {
    try {
      await bluetoothService.sendHapticFeedback(type, intensity);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Haptic feedback error: ${message}`);
    }
  }, []);
  
  // Get battery level
  const getBatteryLevel = useCallback(async () => {
    try {
      const level = await bluetoothService.checkBatteryLevel();
      if (level !== null) {
        setBatteryLevel(level);
      }
      return level;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Battery level error: ${message}`);
      return null;
    }
  }, []);
  
  // Send configuration
  const sendConfiguration = useCallback(async (config: GlassesConfig) => {
    try {
      await bluetoothService.sendConfiguration(config);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Configuration error: ${message}`);
      throw err;
    }
  }, []);
  
  // Return the hook interface
  return {
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
  };
}

// Test Bluetooth connection
export const testBluetoothConnection = async () => {
  const bluetoothService = BluetoothService.getInstance();
  
  try {
    // Initialize and request permissions
    const hasPermissions = await bluetoothService.requestPermissions();
    if (!hasPermissions) {
      console.error('Bluetooth permissions denied');
      return;
    }
    
    // Add discovery listener to log found devices
    const removeListener = bluetoothService.addDeviceDiscoveryListener((devices) => {
      console.log('Devices found:', devices);
    });
    
    // Start scanning
    bluetoothService.scanAndConnect();
    
    // Stop scan after 10 seconds
    setTimeout(() => {
      removeListener();
      
      // Check if we connected to any device
      const state = bluetoothService.getConnectionState();
      if (state === ConnectionState.CONNECTED) {
        console.log('Connected to device');
        
        // Test haptic feedback
        bluetoothService.sendHapticFeedback(HapticFeedbackType.SUCCESS);
      } else {
        console.log('No device connected');
      }
    }, 10000);
  } catch (error) {
    console.error('Bluetooth test error:', error);
  }
};

export default BluetoothService;