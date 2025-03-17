// services/ObstacleDetectionService.ts
import { BluetoothService, HapticFeedbackType } from './BluetoothService';
import * as Speech from 'expo-speech';

// Importation conditionnelle de TensorFlow
let tf: any;
try {
  tf = require('@tensorflow/tfjs');
} catch (error) {
  console.warn('TensorFlow.js could not be imported, using mock implementation');
  // Mock simple pour le développement
  tf = {
    ready: async () => {},
    loadGraphModel: async () => ({
      executeAsync: async () => [
        { array: async () => [[]] },
        { array: async () => [[0.9, 0.8]] },
        { array: async () => [[1, 2]] },
        { array: async () => [2] }
      ],
    }),
    expandDims: () => ({ id: 'mockTensor' }),
    dispose: () => {},
  };
}

// Types d'obstacles détectables
export enum ObstacleType {
  PERSON = 'person',
  CAR = 'car',
  BICYCLE = 'bicycle',
  STAIRS = 'stairs',
  DOOR = 'door',
  CROSSWALK = 'crosswalk',
  POLE = 'pole',
  CURB = 'curb',
  POTHOLE = 'pothole'
}

export class ObstacleDetectionService {
  private static instance: ObstacleDetectionService;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private bluetoothService: BluetoothService;
  private model: any = null;
  
  // Configuration pour différents handicaps
  private config = {
    wheelchairMode: false,
    detectionThreshold: 0.6, // Seuil de confiance
    alertDistance: 2.0, // Mètres
    alertFrequency: 1500, // ms
    lastAlertTime: 0, // Horodatage
  };
  
  // Obstacles critiques selon le mode
  private criticalObstacles = {
    default: [
      ObstacleType.CAR, 
      ObstacleType.BICYCLE, 
      ObstacleType.POLE
    ],
    wheelchair: [
      ObstacleType.STAIRS, 
      ObstacleType.CURB, 
      ObstacleType.POTHOLE
    ]
  };
  
  private constructor() {
    this.bluetoothService = BluetoothService.getInstance();
  }
  
  public static getInstance(): ObstacleDetectionService {
    if (!ObstacleDetectionService.instance) {
      ObstacleDetectionService.instance = new ObstacleDetectionService();
    }
    return ObstacleDetectionService.instance;
  }
  
  // Initialise le service et charge les modèles
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      // Initialiser TensorFlow.js
      await tf.ready();
      
      // Charger le modèle de détection d'objets
      this.model = await tf.loadGraphModel(
        'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1', 
        { fromTFHub: true }
      );
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing ObstacleDetectionService:', error);
      return false;
    }
  }
  
  // Met à jour la configuration
  public updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // Mise à jour dynamique selon le mode fauteuil roulant
    if (newConfig.wheelchairMode !== undefined) {
      console.log(`Obstacle detection: ${newConfig.wheelchairMode ? 'Wheelchair' : 'Standard'} mode activated`);
    }
  }
  
  // Démarre la détection d'obstacles
  public async startDetection(): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    this.isRunning = true;
    return true;
  }
  
  // Arrête la détection
  public stopDetection(): void {
    this.isRunning = false;
  }
  
  // Traite une image de la caméra pour détecter les obstacles
  public async processFrame(imageTensor: any): Promise<void> {
    if (!this.isRunning || !this.model) return;
    
    try {
      // Évite les alertes trop fréquentes
      const now = Date.now();
      if (now - this.config.lastAlertTime < this.config.alertFrequency) {
        return;
      }
      
      // Ajoute une dimension (batch)
      const batched = tf.expandDims(imageTensor);
      
      // Effectue la détection
      const predictions = await this.model.executeAsync(batched);
      
      // Nettoie le tenseur batch
      tf.dispose(batched);
      
      // Traite les résultats de la détection en utilisant une approche plus robuste aux erreurs
      if (Array.isArray(predictions) && predictions.length >= 4) {
        const [boxesTensor, scoresTensor, classesTensor, numDetectionsTensor] = predictions;
        
        try {
          // Convertit en tableaux JavaScript pour traitement avec gestion des erreurs
          const boxesArray = await boxesTensor.array();
          const scoresArray = await scoresTensor.array();
          const classesArray = await classesTensor.array();
          const numDetectionsArray = await numDetectionsTensor.array();
          
          // Nettoie les tenseurs
          predictions.forEach((tensor: any) => tensor.dispose());
          
          // Vérifier la structure des données reçues
          if (Array.isArray(boxesArray) && boxesArray.length > 0 &&
              Array.isArray(scoresArray) && scoresArray.length > 0 &&
              Array.isArray(classesArray) && classesArray.length > 0 &&
              numDetectionsArray) {
                
            // Analyse des détections
            this.analyzeDetections(
              boxesArray[0], 
              scoresArray[0], 
              classesArray[0], 
              typeof numDetectionsArray === 'number' ? 
                numDetectionsArray : 
                (Array.isArray(numDetectionsArray) && numDetectionsArray.length > 0 ? 
                  numDetectionsArray[0] : 
                  0)
            );
          }
        } catch (error) {
          console.error('Error processing tensor data:', error);
        }
      }
    } catch (error) {
      console.error('Error in obstacle detection:', error);
    }
  }
  
  // Analyse les détections et alerte si nécessaire
  private async analyzeDetections(
    boxes: number[][],
    scores: number[],
    classes: number[],
    numDetections: number
  ): Promise<void> {
    // Liste des classes COCO (simplifiée)
    const cocoClasses = [
      'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck',
      'traffic light', 'fire hydrant', 'stop sign', 'bench'
    ];
    
    // Obstacles détectés avec confiance élevée
    const detectedObstacles: Array<{
      type: string;
      confidence: number;
      estimatedDistance: number;
      box: number[];
    }> = [];
    
    for (let i = 0; i < Math.min(20, numDetections); i++) {
      if (scores[i] > this.config.detectionThreshold) {
        // Vérifier si la classe existe et l'index est valide
        const classIndex = Math.round(classes[i]) - 1;
        const className = classIndex >= 0 && classIndex < cocoClasses.length ? 
          cocoClasses[classIndex] : 'unknown';
          
        const box = boxes[i];
        
        // Vérifier si la box est bien formée
        if (box && box.length >= 4) {
          // Estime la distance en fonction de la taille de la boîte
          // Plus grand = plus proche
          const boxArea = (box[2] - box[0]) * (box[3] - box[1]);
          const estimatedDistance = 1.0 / (boxArea * 10); // Formule simplifiée
          
          detectedObstacles.push({
            type: className,
            confidence: scores[i],
            estimatedDistance,
            box
          });
        }
      }
    }
    
    // Identifie les obstacles critiques selon le mode
    const criticalObstacleTypes = this.config.wheelchairMode ? 
      this.criticalObstacles.wheelchair : 
      this.criticalObstacles.default;
    
    const criticalObstacles = detectedObstacles.filter(obstacle => 
      criticalObstacleTypes.includes(obstacle.type as ObstacleType) && 
      obstacle.estimatedDistance < this.config.alertDistance
    );
    
    // Alerte l'utilisateur si des obstacles critiques sont détectés
    if (criticalObstacles.length > 0) {
      // Trie par distance (plus proche d'abord)
      criticalObstacles.sort((a, b) => a.estimatedDistance - b.estimatedDistance);
      
      // Alerte pour l'obstacle le plus proche
      const nearestObstacle = criticalObstacles[0];
      await this.alertObstacle(nearestObstacle.type as ObstacleType, nearestObstacle.estimatedDistance);
      
      // Met à jour le temps de la dernière alerte
      this.config.lastAlertTime = Date.now();
    }
  }
  
  // Alerte l'utilisateur d'un obstacle
  private async alertObstacle(type: ObstacleType, distance: number): Promise<void> {
    try {
      // Retour haptique
      await this.bluetoothService.sendHapticFeedback(
        HapticFeedbackType.WARNING,
        100
      );
      
      // Message vocal
      const distanceText = distance < 1 ? 
        "très proche" : 
        `à environ ${distance.toFixed(0)} mètres`;
      
      // Traduit le type d'obstacle en français
      const obstacleNames: Record<ObstacleType, string> = {
        [ObstacleType.PERSON]: 'personne',
        [ObstacleType.CAR]: 'voiture',
        [ObstacleType.BICYCLE]: 'vélo',
        [ObstacleType.STAIRS]: 'escalier',
        [ObstacleType.DOOR]: 'porte',
        [ObstacleType.CROSSWALK]: 'passage piéton',
        [ObstacleType.POLE]: 'poteau',
        [ObstacleType.CURB]: 'bordure',
        [ObstacleType.POTHOLE]: 'nid de poule'
      };
      
      const obstacleName = obstacleNames[type] || 'obstacle';
      const alertMessage = `Attention: ${obstacleName} ${distanceText}`;
      
      await Speech.speak(alertMessage, {
        language: 'fr-FR',
        pitch: 1.2, // Légèrement plus aigu pour l'urgence
        rate: 1.1, // Légèrement plus rapide pour l'urgence
      });
    } catch (error) {
      console.error('Error alerting obstacle:', error);
    }
  }
}