// SignLanguageRecognitionService.ts - Service de reconnaissance du langage des signes
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import * as ImageManipulator from 'expo-image-manipulator';
import ApiConfig from './ApiConfig';

// Types de signes
export enum SignType {
  ALPHABET = 'alphabet',
  WORD = 'word',
  PHRASE = 'phrase',
  DYNAMIC = 'dynamic'
}

// Points clés des mains selon MediaPipe
export enum HandLandmark {
  WRIST = 0,
  THUMB_CMC = 1,
  THUMB_MCP = 2,
  THUMB_IP = 3,
  THUMB_TIP = 4,
  INDEX_FINGER_MCP = 5,
  INDEX_FINGER_PIP = 6,
  INDEX_FINGER_DIP = 7,
  INDEX_FINGER_TIP = 8,
  MIDDLE_FINGER_MCP = 9,
  MIDDLE_FINGER_PIP = 10,
  MIDDLE_FINGER_DIP = 11,
  MIDDLE_FINGER_TIP = 12,
  RING_FINGER_MCP = 13,
  RING_FINGER_PIP = 14,
  RING_FINGER_DIP = 15,
  RING_FINGER_TIP = 16,
  PINKY_MCP = 17,
  PINKY_PIP = 18,
  PINKY_DIP = 19,
  PINKY_TIP = 20
}

// Interface pour les points clés des mains
export interface HandKeypoints {
  landmarks: [number, number, number][]; // coordonnées x, y, z
  handedness: 'Left' | 'Right';
  score: number; // Confiance de détection
}

// Interface pour les signes reconnus
export interface RecognizedSign {
  type: SignType;
  value: string;
  confidence: number;
  language: string; // 'asl', 'bsl', 'lsf', etc.
  timestamp: Date;
}

// Dictionnaire de langage des signes mappant les poses des mains aux signes
interface SignDictionary {
  [key: string]: {
    value: string;
    type: SignType;
    language: string;
    confidence: number;
  };
}
interface MediaPipeHandsInterface {
    createDetector(config: any): Promise<any>;
  }
  const MediaPipeHands: MediaPipeHandsInterface = {
    createDetector: async (config: any) => {
      console.log('Creating MediaPipe Hands detector with config:', config);
      // This is a mock that will be replaced with actual implementation
      return {
        estimateHands: async (image: any) => {
          // Return empty results for now
          return [];
        }
      };
    }
  };
/**
 * Service de reconnaissance du langage des signes
 * Implémente la détection des mains avec MediaPipe et la classification des gestes
 */
export class SignLanguageRecognitionService {
  private static instance: SignLanguageRecognitionService;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  
  private handDetector: any = null; // Détecteur MediaPipe Hands
  private signClassificationModel: tf.LayersModel | null = null; // Modèle TensorFlow pour la classification des signes
  
  private lastProcessedTime: number = 0;
  private lastDetectedSign: RecognizedSign | null = null;
  private handTrackingHistory: HandKeypoints[][] = []; // Historique des positions des mains pour les signes dynamiques
  
  // Configuration
  private config = {
    recognitionThreshold: 0.65, // Seuil de confiance
    processingFrequency: 300, // Traiter les images tous les X ms
    trackingHistorySize: 30, // Nombre d'images à conserver pour les signes dynamiques
    supportedLanguages: ['asl', 'bsl', 'lsf'], // Langues des signes américaine, britannique, française
    activeLanguage: 'asl',
    speakRecognizedSigns: true
  };
  
  // Dictionnaires de signes pour chaque langue supportée
  private signDictionaries: { [language: string]: SignDictionary } = {
    'asl': {}, // Sera chargé pendant l'initialisation
    'bsl': {},
    'lsf': {}
  };
  
  private constructor() {
    // Initialiser avec des modèles vides
  }
  
  public static getInstance(): SignLanguageRecognitionService {
    if (!SignLanguageRecognitionService.instance) {
      SignLanguageRecognitionService.instance = new SignLanguageRecognitionService();
    }
    return SignLanguageRecognitionService.instance;
  }
  
  // Initialiser TensorFlow et les modèles MediaPipe
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      console.log('Initialisation de TensorFlow...');
      await tf.ready();
      console.log('TensorFlow est prêt');
      
      // Essayer d'initialiser le détecteur de mains
      // Note: Dans une implémentation réelle, nous utiliserions un wrapper natif pour MediaPipe Hands
      try {
        this.handDetector = await this.initializeHandDetector();
        console.log('Détecteur de mains MediaPipe initialisé avec succès');
      } catch (e) {
        console.warn('Impossible d\'initialiser MediaPipe Hands, utilisation de l\'API Vision comme solution de repli', e);
        // Dans ce cas, nous utiliserons l'API Vision comme solution de repli
      }
      
      // Charger le modèle de classification du langage des signes
      console.log('Chargement du modèle de classification des signes...');
      try {
        this.signClassificationModel = await tf.loadLayersModel(
          'https://storage.googleapis.com/sign_language_models/model.json'
        );
        console.log('Modèle de classification des signes chargé avec succès');
      } catch (e) {
        console.log('Modèle de classification non disponible, utilisation de la correspondance de règles');
      }
      
      // Charger les dictionnaires de signes
      await this.loadSignDictionaries();
      
      this.isInitialized = true;
      console.log('Service de reconnaissance du langage des signes initialisé');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du service de reconnaissance du langage des signes:', error);
      return false;
    }
  }
  
  // Initialiser le détecteur de mains MediaPipe
  private async initializeHandDetector(): Promise<any> {
    // Cette méthode serait remplacée par une véritable intégration avec MediaPipe Hands
    // via un module natif ou un wrapper pour React Native
    
    // Pour cette implémentation, nous implémentons une version mock qui utilisera l'API Vision
    return {
      estimateHands: async (image: any) => {
        return await this.detectHandsWithMediaPipe(image);
      }
    };
  }
  
  // Remplacer cette méthode par une implémentation réelle de MediaPipe Hands
  private async detectHandsWithMediaPipe(imageData: { uri: string }): Promise<HandKeypoints[]> {
    try {
      // L'intégration de MediaPipe Hands pour React Native nécessiterait un module natif
      // Ici, nous démontrerons comment l'utiliser avec un module MediaPipeHands hypothétique
      
      // 1. Pour une implémentation réelle, vous utiliseriez une bibliothèque comme react-native-vision-camera
      // avec le plugin MediaPipe ou similaire
      
      // Créer un détecteur MediaPipe Hands
      if (!this.handDetector) {
        // Initialiser le détecteur de mains (implémentation d'exemple)
        this.handDetector = await MediaPipeHands.createDetector({
          runtime: 'mediapipe',
          modelType: 'full',
          maxHands: 2,
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/'
        });
      }
      
      // Traiter l'image
      // D'abord, convertir dans le format approprié pour MediaPipe
      const imageSource = await this.prepareImageForMediaPipe(imageData.uri);
      
      // Détecter les mains dans l'image
      const hands = await this.handDetector.estimateHands(imageSource, {
        flipHorizontal: false
      });
      
      // Convertir à notre format interne
      return hands.map((hand: any) => {
        // Les points de repère des mains MediaPipe sont au format [x, y, z]
        const landmarks = hand.landmarks.map((landmark: any) => 
          [landmark.x, landmark.y, landmark.z] as [number, number, number]
        );
        
        return {
          landmarks,
          handedness: hand.handedness[0].label as 'Left' | 'Right',
          score: hand.handedness[0].score
        };
      });
    } catch (error) {
      console.error('Erreur lors de l\'utilisation de MediaPipe Hands:', error);
      
      // Solution de repli vers l'API Vision en cas d'échec de MediaPipe
      return this.fallbackToVisionAPI(imageData);
    }
  }
  
  // Méthode auxiliaire pour préparer une image pour MediaPipe
  private async prepareImageForMediaPipe(uri: string): Promise<any> {
    // Convertir l'image au format approprié
    // Cela dépend de l'intégration spécifique de MediaPipe pour React Native
    // Par exemple, il pourrait s'agir d'une image en base64, d'un tenseur ou d'un objet d'image natif
    
    try {
      // Pour un module MediaPipe React Native hypothétique
      const resizedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 640, height: 480 } }],
        { format: ImageManipulator.SaveFormat.JPEG }
      );
      
      return { uri: resizedImage.uri };
    } catch (error) {
      throw new Error(`Échec de la préparation de l'image pour MediaPipe: ${error}`);
    }
  }
  
  // Solution de repli vers l'API Google Cloud Vision si MediaPipe n'est pas disponible
  private async fallbackToVisionAPI(imageData: { uri: string }): Promise<HandKeypoints[]> {
    try {
      // Convertir l'image en base64
      const base64Image = await FileSystem.readAsStringAsync(imageData.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Utiliser l'API Google Cloud Vision pour trouver des visages et déduire les positions des mains
      const apiKey = ApiConfig.getApiKey();
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.VISION_API}?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              features: [
                { type: 'FACE_DETECTION', maxResults: 5 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 }
              ],
              image: { content: base64Image }
            }]
          })
        }
      );
      
      const data = await response.json();
      const handKeypoints: HandKeypoints[] = [];
      
      // Traiter les visages pour déduire les positions des mains
      if (data.responses && data.responses[0] && data.responses[0].faceAnnotations) {
        // Implémentation similaire au code existant, mais améliorée
        for (const face of data.responses[0].faceAnnotations) {
          // Créer des positions de mains estimées basées sur l'emplacement du visage
          // (C'est une approximation - un véritable suivi des mains serait meilleur)
          
          // Obtenir les limites du visage
          const vertices = face.boundingPoly.vertices;
          const faceX = (vertices[0].x + vertices[1].x) / 2;
          const faceY = (vertices[0].y + vertices[2].y) / 2;
          const faceWidth = Math.abs(vertices[1].x - vertices[0].x);
          const faceHeight = Math.abs(vertices[2].y - vertices[0].y);
          
          // Estimer les positions des mains gauche et droite
          const leftHandKeypoints = this.generateEstimatedHandKeypoints(
            faceX - faceWidth, faceY + faceHeight, 'Left'
          );
          
          const rightHandKeypoints = this.generateEstimatedHandKeypoints(
            faceX + faceWidth, faceY + faceHeight, 'Right'
          );
          
          handKeypoints.push(leftHandKeypoints, rightHandKeypoints);
        }
      }
      
      return handKeypoints;
    } catch (error) {
      console.error('Erreur avec la solution de repli de l\'API Vision:', error);
      return [];
    }
  }
  
  // Charger les dictionnaires de signes pour les langues supportées
  private async loadSignDictionaries(): Promise<void> {
    try {
      // Dans une implémentation réelle, nous chargerions ces fichiers depuis des fichiers JSON
      
      // ASL (American Sign Language)
      this.signDictionaries.asl = {
        'a': { value: 'A', type: SignType.ALPHABET, language: 'asl', confidence: 1.0 },
        'b': { value: 'B', type: SignType.ALPHABET, language: 'asl', confidence: 1.0 },
        'c': { value: 'C', type: SignType.ALPHABET, language: 'asl', confidence: 1.0 },
        // ... autres lettres de l'alphabet
        'hello': { value: 'Hello', type: SignType.WORD, language: 'asl', confidence: 1.0 },
        'thank-you': { value: 'Thank you', type: SignType.PHRASE, language: 'asl', confidence: 1.0 },
        'please': { value: 'Please', type: SignType.WORD, language: 'asl', confidence: 1.0 },
        'help': { value: 'Help', type: SignType.WORD, language: 'asl', confidence: 1.0 },
        'yes': { value: 'Yes', type: SignType.WORD, language: 'asl', confidence: 1.0 },
        'no': { value: 'No', type: SignType.WORD, language: 'asl', confidence: 1.0 },
      };
      
      // BSL (British Sign Language)
      this.signDictionaries.bsl = {
        'a': { value: 'A', type: SignType.ALPHABET, language: 'bsl', confidence: 1.0 },
        'b': { value: 'B', type: SignType.ALPHABET, language: 'bsl', confidence: 1.0 },
        'hello': { value: 'Hello', type: SignType.WORD, language: 'bsl', confidence: 1.0 },
        'thank-you': { value: 'Thank you', type: SignType.PHRASE, language: 'bsl', confidence: 1.0 },
      };
      
      // LSF (French Sign Language)
      this.signDictionaries.lsf = {
        'a': { value: 'A', type: SignType.ALPHABET, language: 'lsf', confidence: 1.0 },
        'b': { value: 'B', type: SignType.ALPHABET, language: 'lsf', confidence: 1.0 },
        'bonjour': { value: 'Bonjour', type: SignType.WORD, language: 'lsf', confidence: 1.0 },
        'merci': { value: 'Merci', type: SignType.WORD, language: 'lsf', confidence: 1.0 },
      };
      
      console.log('Dictionnaires de signes chargés');
    } catch (error) {
      console.error('Erreur lors du chargement des dictionnaires de signes:', error);
    }
  }
  
  // Auxiliaire pour générer des points clés de main estimés en fonction de la position
  private generateEstimatedHandKeypoints(
    baseX: number, 
    baseY: number, 
    handedness: 'Left' | 'Right'
  ): HandKeypoints {
    // Générer des points clés de main synthétiques dans une forme de main réaliste
    // Il s'agit d'une estimation simple - un véritable suivi des mains serait meilleur
    
    const landmarks: [number, number, number][] = [];
    
    // Le poignet est à la position de base
    landmarks.push([baseX, baseY, 0]);
    
    // Générer des points clés de la paume
    for (let i = 1; i <= 4; i++) {
      landmarks.push([
        baseX + (handedness === 'Left' ? -5 : 5) * i,
        baseY - 10,
        0
      ]);
    }
    
    // Générer des points clés du pouce
    for (let i = 0; i < 4; i++) {
      landmarks.push([
        baseX + (handedness === 'Left' ? -15 : 15) - (i * 4),
        baseY - 15 - (i * 10),
        0
      ]);
    }
    
    // Générer des points clés des doigts
    for (let finger = 0; finger < 4; finger++) {
      for (let joint = 0; joint < 3; joint++) {
        landmarks.push([
          baseX + (handedness === 'Left' ? -5 : 5) * (finger + 1),
          baseY - 20 - (joint * 10),
          0
        ]);
      }
    }
    
    return {
      landmarks,
      handedness,
      score: 0.7 // Score de confiance pour les mains estimées
    };
  }
  
  // Mettre à jour la configuration
  public updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    console.log(`Reconnaissance du langage des signes: configuration mise à jour`, this.config);
  }
  
  // Démarrer la reconnaissance
  public async startRecognition(): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    this.isRunning = true;
    this.handTrackingHistory = [];
    return true;
  }
  
  // Arrêter la reconnaissance
  public stopRecognition(): void {
    this.isRunning = false;
  }
  
  // Traiter une image de la caméra avec détection améliorée du langage des signes
  public async processFrame(
    imageData: { uri: string } | { base64: string }
  ): Promise<RecognizedSign | null> {
    if (!this.isRunning) return null;
    
    // Vérifier si nous devons traiter cette image (limitation de la fréquence)
    const now = Date.now();
    if (now - this.lastProcessedTime < this.config.processingFrequency) {
      return this.lastDetectedSign;
    }
    
    this.lastProcessedTime = now;
    
    try {
      // Utiliser MediaPipe Hands pour la détection des mains
      const hands = await this.detectHandsWithMediaPipe('uri' in imageData ? imageData : { uri: '' });
      
      if (!hands || hands.length === 0) {
        // Réinitialiser l'historique de suivi si aucune main n'est détectée
        if (this.handTrackingHistory.length > 0) {
          this.handTrackingHistory = [];
        }
        this.lastDetectedSign = null;
        return null;
      }
      
      // Ajouter à l'historique de suivi
      this.handTrackingHistory.push(hands);
      
      // Ne conserver que les images récentes pour l'analyse temporelle
      while (this.handTrackingHistory.length > this.config.trackingHistorySize) {
        this.handTrackingHistory.shift();
      }
      
      // Vérifier les gestes dynamiques si nous avons assez d'images
      if (this.handTrackingHistory.length >= 5) {
        const dynamicSign = await this.recognizeDynamicSign();
        if (dynamicSign) {
          if (this.config.speakRecognizedSigns) {
            Speech.speak(dynamicSign.value);
          }
          this.lastDetectedSign = dynamicSign;
          return dynamicSign;
        }
      }
      
      // Essayer de reconnaître les signes statiques
      const staticSign = await this.recognizeStaticSign(hands);
      if (staticSign) {
        if (this.config.speakRecognizedSigns) {
          Speech.speak(staticSign.value);
        }
        this.lastDetectedSign = staticSign;
        return staticSign;
      }
      
      this.lastDetectedSign = null;
      return null;
    } catch (error) {
      console.error('Erreur lors du traitement de l\'image pour la langue des signes:', error);
      return null;
    }
  }
  
  // Reconnaître un signe statique à partir des points clés des mains avec apprentissage automatique amélioré
  private async recognizeStaticSign(hands: HandKeypoints[]): Promise<RecognizedSign | null> {
    if (hands.length === 0) return null;
    
    // Extraire les caractéristiques des points clés des mains
    const features = this.extractHandFeatures(hands);
    
    if (this.signClassificationModel) {
      // Utiliser le modèle TensorFlow.js pour la classification
      try {
        const inputTensor = tf.tensor2d([features], [1, features.length]);
        
        // Exécuter l'inférence
        const predictions = await this.signClassificationModel.predict(inputTensor) as tf.Tensor;
        const values = await predictions.data();
        
        // Trouver le signe avec la confiance la plus élevée
        const maxIndex = values.indexOf(Math.max(...Array.from(values)));
        const confidence = values[maxIndex];
        
        // Obtenir la clé du signe
        const signKeys = Object.keys(this.signDictionaries[this.config.activeLanguage]);
        if (maxIndex < signKeys.length) {
          const signKey = signKeys[maxIndex];
          const sign = this.signDictionaries[this.config.activeLanguage][signKey];
          
          if (confidence >= this.config.recognitionThreshold) {
            return {
              type: sign.type,
              value: sign.value,
              confidence,
              language: sign.language,
              timestamp: new Date()
            };
          }
        }
        
        // Nettoyer les tenseurs
        tf.dispose([inputTensor, predictions]);
      } catch (error) {
        console.error('Erreur lors de la classification du signe:', error);
      }
    } else {
      // Reconnaissance basée sur des règles comme solution de repli
      // Cela utilise des relations géométriques entre les points clés des mains
      return this.recognizeSignUsingRules(hands);
    }
    
    return null;
  }
  
  // Reconnaissance de signes basée sur des règles - solution de repli
  private recognizeSignUsingRules(hands: HandKeypoints[]): RecognizedSign | null {
    if (hands.length === 0) return null;
    
    const hand = hands[0]; // Utiliser la première main détectée
    
    // Signes ASL courants basés sur les positions des doigts
    // C'est un exemple très simplifié - la détection réelle des signes est plus complexe
    
    // Mesurer les distances entre les points clés
    const thumbTip = hand.landmarks[HandLandmark.THUMB_TIP];
    const indexTip = hand.landmarks[HandLandmark.INDEX_FINGER_TIP];
    const middleTip = hand.landmarks[HandLandmark.MIDDLE_FINGER_TIP];
    const ringTip = hand.landmarks[HandLandmark.RING_FINGER_TIP];
    const pinkyTip = hand.landmarks[HandLandmark.PINKY_TIP];
    const wrist = hand.landmarks[HandLandmark.WRIST];
    
    // Calculer les distances
    const thumbToIndex = this.distance3D(thumbTip, indexTip);
    const indexToMiddle = this.distance3D(indexTip, middleTip);
    const middleToRing = this.distance3D(middleTip, ringTip);
    const ringToPinky = this.distance3D(ringTip, pinkyTip);
    
    // Exemples de règles simples de détection de signes
    
    // "A" en ASL - poing avec pouce sur le côté
    if (thumbToIndex < 0.1 && 
        indexToMiddle < 0.1 && 
        middleToRing < 0.1 && 
        ringToPinky < 0.1) {
      return {
        type: SignType.ALPHABET,
        value: 'A',
        confidence: 0.8,
        language: this.config.activeLanguage,
        timestamp: new Date()
      };
    }
    
    // "B" en ASL - main plate avec doigts ensemble, pouce rentré
    if (indexToMiddle < 0.1 && 
        middleToRing < 0.1 && 
        ringToPinky < 0.1 && 
        this.distance3D(wrist, indexTip) > 0.5) {
      return {
        type: SignType.ALPHABET,
        value: 'B',
        confidence: 0.8,
        language: this.config.activeLanguage,
        timestamp: new Date()
      };
    }
    
    // D'autres règles de détection de signes iraient ici
    
    return null;
  }
  
  // Reconnaître un signe dynamique à partir de l'historique de suivi des mains
  private async recognizeDynamicSign(): Promise<RecognizedSign | null> {
    if (this.handTrackingHistory.length < 5) return null;
    
    // Analyser le mouvement des mains dans le temps
    // Dans une implémentation réelle, nous utiliserions un modèle séquentiel comme LSTM ou GRU
    
    // Simple détection de mouvement pour "hello" ou "merci"
    const firstFrame = this.handTrackingHistory[0];
    const lastFrame = this.handTrackingHistory[this.handTrackingHistory.length - 1];
    
    if (firstFrame.length > 0 && lastFrame.length > 0) {
      const firstWrist = firstFrame[0].landmarks[HandLandmark.WRIST];
      const lastWrist = lastFrame[0].landmarks[HandLandmark.WRIST];
      
      // Calculer le déplacement vertical et horizontal
      const verticalDisplacement = lastWrist[1] - firstWrist[1];
      const horizontalDisplacement = lastWrist[0] - firstWrist[0];
      
      // Mouvement de vague (hello)
      if (Math.abs(horizontalDisplacement) > 50 && Math.abs(verticalDisplacement) < 30) {
        return {
          type: SignType.DYNAMIC,
          value: this.config.activeLanguage === 'lsf' ? 'Bonjour' : 'Hello',
          confidence: 0.75,
          language: this.config.activeLanguage,
          timestamp: new Date()
        };
      }
      
      // Mouvement vers le bas et vers l'avant (merci)
      if (verticalDisplacement > 40 && horizontalDisplacement > 20) {
        return {
          type: SignType.DYNAMIC,
          value: this.config.activeLanguage === 'lsf' ? 'Merci' : 'Thank you',
          confidence: 0.7,
          language: this.config.activeLanguage,
          timestamp: new Date()
        };
      }
    }
    
    return null;
  }
  
  // Extraire les caractéristiques des points clés des mains
  private extractHandFeatures(hands: HandKeypoints[]): number[] {
    const features: number[] = [];
    
    // Traiter toutes les mains détectées
    for (const hand of hands) {
      // Extraire les positions relatives entre les points clés
      const landmarks = hand.landmarks;
      
      // Distance entre le poignet et chaque bout de doigt
      const wrist = landmarks[HandLandmark.WRIST];
      const thumbTip = landmarks[HandLandmark.THUMB_TIP];
      const indexTip = landmarks[HandLandmark.INDEX_FINGER_TIP];
      const middleTip = landmarks[HandLandmark.MIDDLE_FINGER_TIP];
      const ringTip = landmarks[HandLandmark.RING_FINGER_TIP];
      const pinkyTip = landmarks[HandLandmark.PINKY_TIP];
      
      // Calculer les distances euclidiennes
      const distThumb = this.distance3D(wrist, thumbTip);
      const distIndex = this.distance3D(wrist, indexTip);
      const distMiddle = this.distance3D(wrist, middleTip);
      const distRing = this.distance3D(wrist, ringTip);
      const distPinky = this.distance3D(wrist, pinkyTip);
      
      // Ajouter aux caractéristiques
      features.push(distThumb, distIndex, distMiddle, distRing, distPinky);
      
      // Distances entre les bouts des doigts
      features.push(
        this.distance3D(thumbTip, indexTip),
        this.distance3D(thumbTip, middleTip),
        this.distance3D(thumbTip, ringTip),
        this.distance3D(thumbTip, pinkyTip),
        this.distance3D(indexTip, middleTip),
        this.distance3D(middleTip, ringTip),
        this.distance3D(ringTip, pinkyTip)
      );
      
      // Angles entre les segments des doigts
      // Normaliser les coordonnées
      const minX = Math.min(...landmarks.map(l => l[0]));
      const maxX = Math.max(...landmarks.map(l => l[0]));
      const minY = Math.min(...landmarks.map(l => l[1]));
      const maxY = Math.max(...landmarks.map(l => l[1]));
      
      const normalizedLandmarks = landmarks.map(([x, y, z]) => {
        return [
          (x - minX) / (maxX - minX || 1),
          (y - minY) / (maxY - minY || 1),
          z
        ];
      });
      
      // Ajouter toutes les coordonnées normalisées
      normalizedLandmarks.forEach(([x, y, z]) => {
        features.push(x, y, z);
      });
      
      // Ajouter une indication de main gauche/droite
      features.push(hand.handedness === 'Left' ? 0 : 1);
    }
    
    // Si aucune main n'est détectée ou moins que prévu, remplir avec des zéros
    // pour maintenir un vecteur de caractéristiques de taille constante
    const expectedFeatureLength = 200; // Ajuster selon votre modèle
    while (features.length < expectedFeatureLength) {
      features.push(0);
    }
    
    return features;
  }
  
  // Calculer la distance euclidienne 3D entre deux points
  private distance3D(a: [number, number, number], b: [number, number, number]): number {
    return Math.sqrt(
      Math.pow(a[0] - b[0], 2) +
      Math.pow(a[1] - b[1], 2) +
      Math.pow(a[2] - b[2], 2)
    );
  }
  
  // Obtenir le dernier signe détecté
  public getLastDetectedSign(): RecognizedSign | null {
    return this.lastDetectedSign;
  }
  
  // Définir une fonction pour convertir un signe en texte
  public signToText(sign: RecognizedSign): string {
    return sign.value;
  }
  
  // Définir une fonction pour changer la langue active
  public setActiveLanguage(language: string): boolean {
    if (this.config.supportedLanguages.includes(language)) {
      this.config.activeLanguage = language;
      return true;
    }
    return false;
  }
  
  // Vérifier si une langue est supportée
  public isLanguageSupported(language: string): boolean {
    return this.config.supportedLanguages.includes(language);
  }
  
  // Obtenir la liste des langues supportées
  public getSupportedLanguages(): string[] {
    return this.config.supportedLanguages;
  }
}