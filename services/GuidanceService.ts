// services/GuidanceService.ts
import { NavigationService, NavigationStep, Coordinate, RouteDetails } from './NavigationService';
import { BluetoothService, HapticFeedbackType } from './BluetoothService';
import * as Speech from 'expo-speech';

export class GuidanceService {
  private static instance: GuidanceService;
  private bluetoothService: BluetoothService;
  private navigationService: NavigationService;
  private voiceAssistantService: any;
  
  private isNavigating: boolean = false;
  private currentStep: NavigationStep | null = null;
  private destination: Coordinate | null = null;
  private currentRoute: RouteDetails | null = null;
  
  private userPreferences: {
    voiceGuidance: boolean;
    hapticFeedback: boolean;
    detailedInstructions: boolean;
    alertDistance: number; // en mètres
  };
  
  private constructor() {
    this.bluetoothService = BluetoothService.getInstance();
    this.navigationService = new NavigationService();
    this.voiceAssistantService = null; // Sera initialisé plus tard si nécessaire
    
    this.userPreferences = {
      voiceGuidance: true,
      hapticFeedback: true,
      detailedInstructions: true,
      alertDistance: 15 // mètres
    };
  }
  
  public static getInstance(): GuidanceService {
    if (!GuidanceService.instance) {
      GuidanceService.instance = new GuidanceService();
    }
    return GuidanceService.instance;
  }
  
  // Démarre le guidage vers une destination
  public async startGuidance(
    destination: Coordinate,
    mode: 'walking' | 'driving' | 'bicycling' = 'walking',
    wheelchairAccessible: boolean = false
  ): Promise<boolean> {
    try {
      // Obtient la position actuelle
      const currentPosition = await NavigationService.getCurrentLocation();
      if (!currentPosition) {
        this.provideAlert("Impossible d'obtenir votre position actuelle", true);
        return false;
      }
      
      // Calcule l'itinéraire
      const route = await NavigationService.getRoute(
        currentPosition,
        destination,
        mode,
        wheelchairAccessible
      );
      
      if (!route) {
        this.provideAlert("Impossible de calculer un itinéraire", true);
        return false;
      }
      
      this.destination = destination;
      this.currentRoute = route;
      this.isNavigating = true;
      
      // Démarre avec la première étape
      if (route.steps.length > 0) {
        this.currentStep = route.steps[0];
        
        // Indique le début de la navigation
        this.provideAlert(
          `Navigation démarrée. ${route.steps.length} étapes. Distance totale: ${(route.distance / 1000).toFixed(1)} kilomètres.`,
          false
        );
        
        // Annonce la première instruction
        if (this.currentStep) {
          this.announceStep(this.currentStep);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error starting guidance:', error);
      this.provideAlert("Erreur lors du démarrage de la navigation", true);
      return false;
    }
  }
  
  // Met à jour la position actuelle et vérifie la progression
  public async updatePosition(currentPosition: Coordinate): Promise<void> {
    if (!this.isNavigating || !this.currentStep) return;
    
    try {
      // Calcule la distance à l'étape actuelle
      const distanceToStep = NavigationService.calculateDistance(
        currentPosition,
        this.currentStep.coordinate
      );
      
      // Si on approche de l'étape actuelle
      if (distanceToStep <= this.userPreferences.alertDistance) {
        // Signaler l'approche avec des vibrations directionnelles
        this.provideDirectionalHapticFeedback(this.currentStep.maneuver);
        
        // Si on est très proche, passer à l'étape suivante
        if (distanceToStep <= 5) {
          this.moveToNextStep();
        }
      }
    } catch (error) {
      console.error('Error updating position in guidance:', error);
    }
  }
  
  // Passe à l'étape suivante
  private async moveToNextStep(): Promise<void> {
    if (!this.currentRoute || !this.currentStep) return;
    
    // Obtient les étapes actuelles
    const steps = this.currentRoute.steps;
    
    const currentIndex = steps.findIndex(
      step => step.coordinate.latitude === this.currentStep?.coordinate.latitude &&
              step.coordinate.longitude === this.currentStep?.coordinate.longitude
    );
    
    if (currentIndex < 0) return;
    
    // Passer à l'étape suivante s'il y en a une
    if (currentIndex < steps.length - 1) {
      this.currentStep = steps[currentIndex + 1];
      if (this.currentStep) {
        this.announceStep(this.currentStep);
      }
    } else {
      // C'était la dernière étape, on est arrivé
      this.announceArrival();
      this.stopGuidance();
    }
  }
  
  // Annonce une étape avec le mode adapté aux préférences
  private async announceStep(step: NavigationStep): Promise<void> {
    const instruction = step.instruction;
    
    // Convertit les distances en format plus humain
    let formattedDistance = '';
    if (step.distance < 10) {
      formattedDistance = 'tout de suite';
    } else if (step.distance < 100) {
      formattedDistance = 'dans quelques mètres';
    } else {
      formattedDistance = `dans ${Math.round(step.distance)} mètres`;
    }
    
    const announcement = `${formattedDistance}, ${instruction}`;
    
    // Annonce vocale si activée
    if (this.userPreferences.voiceGuidance) {
      await Speech.speak(announcement, {
        language: 'fr-FR',
        pitch: 1.0,
        rate: 0.9,
      });
    }
    
    // Retour haptique selon le type de manœuvre
    if (this.userPreferences.hapticFeedback) {
      this.provideDirectionalHapticFeedback(step.maneuver);
    }
  }
  
  // Annonce l'arrivée à destination
  private async announceArrival(): Promise<void> {
    const announcement = "Vous êtes arrivé à destination.";
    
    // Annonce vocale si activée
    if (this.userPreferences.voiceGuidance) {
      await Speech.speak(announcement, {
        language: 'fr-FR',
        pitch: 1.0,
        rate: 0.9,
      });
    }
    
    // Retour haptique pour l'arrivée
    if (this.userPreferences.hapticFeedback) {
      await this.bluetoothService.sendHapticFeedback(
        HapticFeedbackType.SUCCESS,
        100
      );
    }
  }
  
  // Fournit un retour haptique directionnel
// In GuidanceService.ts - implement haptic feedback
private async provideDirectionalHapticFeedback(
  maneuver: 'straight' | 'turn-left' | 'turn-right' | 'uturn' | 'arrive' | 'depart'
): Promise<void> {
  try {
    let feedbackType: HapticFeedbackType;
    
    switch (maneuver) {
      case 'turn-left':
        feedbackType = HapticFeedbackType.LEFT_DIRECTION;
        break;
      case 'turn-right':
        feedbackType = HapticFeedbackType.RIGHT_DIRECTION;
        break;
      case 'straight':
        feedbackType = HapticFeedbackType.STRAIGHT_DIRECTION;
        break;
      case 'arrive':
        feedbackType = HapticFeedbackType.SUCCESS;
        break;
      case 'depart':
        feedbackType = HapticFeedbackType.SHORT;
        break;
      case 'uturn':
        // Séquence de deux impulsions gauche pour faire demi-tour
        await this.bluetoothService.sendHapticFeedback(
          HapticFeedbackType.LEFT_DIRECTION,
          100
        );
        await new Promise(resolve => setTimeout(resolve, 500));
        feedbackType = HapticFeedbackType.LEFT_DIRECTION;
        break;
      default:
        feedbackType = HapticFeedbackType.MEDIUM;
    }
    
    await this.bluetoothService.sendHapticFeedback(feedbackType, 100);
  } catch (error) {
    console.error('Error providing directional haptic feedback:', error);
  }
}
  
  // Fournit une alerte à l'utilisateur
  private async provideAlert(message: string, isWarning: boolean): Promise<void> {
    // Annonce vocale
    if (this.userPreferences.voiceGuidance) {
      await Speech.speak(message, {
        language: 'fr-FR',
        pitch: isWarning ? 1.2 : 1.0,
        rate: isWarning ? 1.1 : 0.9,
      });
    }
    
    // Retour haptique
    if (this.userPreferences.hapticFeedback) {
      await this.bluetoothService.sendHapticFeedback(
        isWarning ? HapticFeedbackType.WARNING : HapticFeedbackType.MEDIUM,
        100
      );
    }
  }
  
  // Arrête le guidage
  public stopGuidance(): void {
    this.isNavigating = false;
    this.currentStep = null;
    this.destination = null;
    this.currentRoute = null;
  }
  
  // Met à jour les préférences utilisateur
  public updatePreferences(preferences: Partial<GuidanceService['userPreferences']>): void {
    this.userPreferences = {
      ...this.userPreferences,
      ...preferences
    };
  }
}