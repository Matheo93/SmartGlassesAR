// services/PowerManagementService.ts
import { AppState, AppStateStatus } from 'react-native';
import { BluetoothService } from './BluetoothService';
import { NavigationService } from './NavigationService';

export class PowerManagementService {
  private static instance: PowerManagementService;
  private appStateSubscription: any;
  private lastActiveTimestamp: number = Date.now();
  private activeBatteryPolling: boolean = false;
  private batteryCheckInterval: any;
  
  // Services managés
  private bluetoothService: BluetoothService;
  
  private constructor() {
    this.bluetoothService = BluetoothService.getInstance();
    
    // Surveille l'état de l'application
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }
  
  public static getInstance(): PowerManagementService {
    if (!PowerManagementService.instance) {
      PowerManagementService.instance = new PowerManagementService();
    }
    return PowerManagementService.instance;
  }
  
  // Gère les changements d'état de l'application
  private handleAppStateChange(nextAppState: AppStateStatus) {
    if (nextAppState === 'active') {
      this.activateBatteryMonitoring();
      // Réactive les services en mode normal
      console.log('App active: resuming normal power mode');
    } else if (nextAppState === 'background') {
      this.deactivateBatteryMonitoring();
      // Désactive certains services ou passe en mode basse consommation
      console.log('App in background: entering low power mode');
    }
  }
  
  // Active la surveillance de la batterie
  private activateBatteryMonitoring() {
    if (!this.activeBatteryPolling) {
      this.activeBatteryPolling = true;
      
      // Vérifie le niveau de batterie toutes les 5 minutes
      this.batteryCheckInterval = setInterval(async () => {
        try {
          const batteryLevel = await this.bluetoothService.getBatteryLevel();
          
          // Si batterie faible (< 15%), déclenche des économies d'énergie
          if (batteryLevel < 15) {
            this.enterLowBatteryMode();
          }
        } catch (error) {
          console.error('Error checking battery level:', error);
        }
      }, 5 * 60 * 1000);
    }
  }
  
  // Désactive la surveillance de la batterie
  private deactivateBatteryMonitoring() {
    if (this.activeBatteryPolling) {
      clearInterval(this.batteryCheckInterval);
      this.activeBatteryPolling = false;
    }
  }
  
  // Mode batterie faible
  private enterLowBatteryMode() {
    // Configurez les services pour consommer moins d'énergie
    // Par exemple, réduisez les fréquences de mise à jour, désactivez certaines fonctions
    
    console.log('Entering low battery mode');
    
    // Exemple: réduire la luminosité
    this.bluetoothService.sendConfiguration({
      displayBrightness: 40, // Réduit à 40%
      hapticFeedbackEnabled: true,
      voiceAssistantEnabled: true,
      batteryThreshold: 10
    });
  }
  
  // Nettoyage quand le service est détruit
  public destroy() {
    this.deactivateBatteryMonitoring();
    this.appStateSubscription.remove();
  }
}