// services/BluetoothService.ts
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

export interface GlassesConfig {
  displayBrightness: number; // 0-100
  hapticFeedbackEnabled: boolean;
  voiceAssistantEnabled: boolean;
  batteryThreshold: number; // 0-100
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
}

// Bluetooth Service for Smart Glasses
export class BluetoothService {
  private static instance: BluetoothService;
  private bleManager: any;
  private connectedDevice: BluetoothDevice | null = null;
  
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
        if (Platform.Version >= 31) { // Android 12+
          bluetoothScanGranted = await PermissionsAndroid.request(
            'android.permission.BLUETOOTH_SCAN'
          ) === PermissionsAndroid.RESULTS.GRANTED;
          
          bluetoothConnectGranted = await PermissionsAndroid.request(
            'android.permission.BLUETOOTH_CONNECT'
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
  
  // Check Bluetooth state (enabled/disabled)
  public async isBluetoothEnabled(): Promise<boolean> {
    try {
      const state = await this.bleManager.state();
      return state === 'PoweredOn';
    } catch (error) {
      console.error('Error checking Bluetooth state:', error);
      return false;
    }
  }
  
  // Start scanning for devices
  public startScan(
    onDeviceFound: (device: BluetoothDevice) => void,
    onError: (error: Error) => void
  ): void {
    try {
      this.bleManager.startDeviceScan(
        null, // Scan for all services
        { allowDuplicates: false },
        (error: Error | null, device: BluetoothDevice | null) => {
          if (error) {
            onError(error);
            return;
          }
          
          if (device && device.name) {
            onDeviceFound(device);
          }
        }
      );
    } catch (error) {
      onError(error as Error);
    }
  }
  
  // Stop scanning
  public stopScan(): void {
    this.bleManager.stopDeviceScan();
  }
  
  // Connect to device
  public async connectToDevice(
    deviceId: string,
    onConnected: (device: BluetoothDevice) => void,
    onDisconnected: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const device = await this.bleManager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
      
      // Setup disconnection listener
      device.onDisconnected((error: Error | null, disconnectedDevice: BluetoothDevice | null) => {
        this.connectedDevice = null;
        onDisconnected();
        
        if (error) {
          onError(error);
        }
      });
      
      this.connectedDevice = device;
      onConnected(device);
    } catch (error) {
      onError(error as Error);
    }
  }
  
  // Disconnect from device
  public async disconnectFromDevice(): Promise<void> {
    if (this.connectedDevice) {
      await this.bleManager.cancelConnection(this.connectedDevice.id);
      this.connectedDevice = null;
    }
  }
  
  // Get battery level
  public async getBatteryLevel(): Promise<number> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }
    
    try {
      const characteristic = await this.bleManager.readCharacteristicForService(
        GLASSES_SERVICE_UUID,
        BATTERY_CHARACTERISTIC_UUID
      );
      
      if (characteristic.value) {
        const data = Buffer.from(characteristic.value, 'base64');
        return data[0]; // 0-100 percentage
      }
      
      throw new Error('Invalid battery data');
    } catch (error) {
      console.error('Error reading battery level:', error);
      throw error;
    }
  }
  
  // Send haptic feedback
  public async sendHapticFeedback(
    type: HapticFeedbackType,
    intensity: number = 100 // 0-100
  ): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }
    
    try {
      const data = Buffer.alloc(2);
      data[0] = type;
      data[1] = Math.max(0, Math.min(100, intensity));
      
      await this.bleManager.writeCharacteristicWithResponseForService(
        GLASSES_SERVICE_UUID,
        HAPTIC_FEEDBACK_CHARACTERISTIC_UUID,
        data.toString('base64')
      );
    } catch (error) {
      console.error('Error sending haptic feedback:', error);
      throw error;
    }
  }
  
  // Send configuration to glasses
  public async sendConfiguration(config: GlassesConfig): Promise<void> {
    if (!this.connectedDevice) {
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
  }, []);
  
  // Start scanning for devices
  const startScan = useCallback(async () => {
    try {
      setIsScanning(true);
      setError(null);
      setDevices([]);
      
      bluetoothService.startScan(
        (device) => {
          setDevices((prevDevices) => {
            // Avoid duplicates
            if (prevDevices.some((d) => d.id === device.id)) {
              return prevDevices;
            }
            
            return [...prevDevices, device];
          });
        },
        (err) => {
          setError(`Scan error: ${err.message}`);
          setIsScanning(false);
        }
      );
      
      // Auto-stop scan after 10 seconds
      setTimeout(() => {
        if (isScanning) {
          stopScan();
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
    bluetoothService.stopScan();
    setIsScanning(false);
  }, []);
  
  // Connect to device
  const connectToDevice = useCallback(async (deviceId: string) => {
    try {
      setIsConnecting(true);
      setError(null);
      
      await bluetoothService.connectToDevice(
        deviceId,
        (device) => {
          setConnectedDevice(device);
          setIsConnecting(false);
          
          // Get initial battery level
          bluetoothService.getBatteryLevel()
            .then((level) => {
              setBatteryLevel(level);
            })
            .catch((err) => {
              console.error('Error getting battery level:', err);
            });
        },
        () => {
          setConnectedDevice(null);
          setError('Device disconnected');
        },
        (err) => {
          setError(`Connection error: ${err.message}`);
          setIsConnecting(false);
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Connection error: ${message}`);
      setIsConnecting(false);
    }
  }, []);
  
  // Disconnect from device
  const disconnect = useCallback(async () => {
    try {
      await bluetoothService.disconnectFromDevice();
      setConnectedDevice(null);
      setBatteryLevel(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Disconnection error: ${message}`);
    }
  }, []);

  // In a test component, validate the connection flow
const testBluetoothConnection = async () => {
    const bluetoothService = BluetoothService.getInstance();
    
    try {
      // Initialize and request permissions
      const hasPermissions = await bluetoothService.requestPermissions();
      if (!hasPermissions) {
        console.error('Bluetooth permissions denied');
        return;
      }
      
      // Scan for devices
      let foundDevices: BluetoothDevice[] = [];
      bluetoothService.startScan(
        (device) => {
          console.log('Device found:', device);
          foundDevices.push(device);
        },
        (error) => {
          console.error('Scan error:', error);
        }
      );
      
      // Stop scan after 10 seconds
      setTimeout(() => {
        bluetoothService.stopScan();
        console.log('Scan completed. Found devices:', foundDevices);
        
        // Try to connect to a test device if found
        if (foundDevices.length > 0) {
          bluetoothService.connectToDevice(
            foundDevices[0].id,
            (device) => {
              console.log('Connected to device:', device);
              
              // Test haptic feedback
              bluetoothService.sendHapticFeedback(HapticFeedbackType.SHORT);
            },
            () => {
              console.log('Device disconnected');
            },
            (error) => {
              console.error('Connection error:', error);
            }
          );
        }
      }, 10000);
    } catch (error) {
      console.error('Bluetooth test error:', error);
    }
  };
  
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
      const level = await bluetoothService.getBatteryLevel();
      setBatteryLevel(level);
      return level;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Battery level error: ${message}`);
      return 0;
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

export default BluetoothService;