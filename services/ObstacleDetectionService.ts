// ObstacleDetectionService.ts - Service de détection d'obstacles avec vision par ordinateur
import { BluetoothService, HapticFeedbackType } from './BluetoothService';
import * as Speech from 'expo-speech';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import ApiConfig from './ApiConfig';
import { Dimensions, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Rank, Tensor, Tensor3D, Tensor4D } from '@tensorflow/tfjs';

// Déclaration de fonctions utilitaires pour contourner les problèmes de type avec TensorFlow.js
// Ces fonctions permettent d'éviter les erreurs de typage strict
const tfPredict = (model: any, inputs: any): tf.Tensor => {
  return (model as any).predict(inputs);
};

// Constantes pour les dimensions de l'écran
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// Types d'obstacles
export enum ObstacleType {
  PERSON = 'person',
  CAR = 'car',
  BICYCLE = 'bicycle',
  STAIRS = 'stairs',
  DOOR = 'door',
  CROSSWALK = 'crosswalk',
  POLE = 'pole',
  CURB = 'curb',
  POTHOLE = 'pothole',
  DOG = 'dog',
  CHAIR = 'chair',
  BENCH = 'bench',
  TABLE = 'table',
  TREE = 'tree',
  FIRE_HYDRANT = 'fire_hydrant',
  STOP_SIGN = 'stop_sign',
  TRAFFIC_LIGHT = 'traffic_light',
  UNKNOWN = 'unknown'
}

// Classes du dataset COCO pour le modèle MobileNet SSD
const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train',
  'truck', 'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter',
  'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear',
  'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase',
  'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat',
  'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle',
  'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut',
  'cake', 'chair', 'couch', 'potted plant', 'bed', 'dining table',
  'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock',
  'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

// Correspondance entre les classes COCO et nos types d'obstacles
const COCO_TO_OBSTACLE_MAP: { [key: string]: ObstacleType } = {
  'person': ObstacleType.PERSON,
  'bicycle': ObstacleType.BICYCLE,
  'car': ObstacleType.CAR,
  'stop sign': ObstacleType.STOP_SIGN,
  'traffic light': ObstacleType.TRAFFIC_LIGHT,
  'chair': ObstacleType.CHAIR,
  'bench': ObstacleType.BENCH,
  'dining table': ObstacleType.TABLE,
  'dog': ObstacleType.DOG,
  'fire hydrant': ObstacleType.FIRE_HYDRANT
};

// Obstacles personnalisés que nous détecterons en utilisant notre propre modèle ou des heuristiques
const CUSTOM_OBSTACLES = [
  ObstacleType.STAIRS,
  ObstacleType.DOOR,
  ObstacleType.CROSSWALK,
  ObstacleType.POLE,
  ObstacleType.CURB,
  ObstacleType.POTHOLE
];

// Interface pour les obstacles détectés
export interface DetectedObstacle {
  type: ObstacleType;
  confidence: number;
  distance: number; // Distance estimée en mètres
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isCritical: boolean; // Indique si c'est critique pour l'utilisateur
}

/**
 * Service de détection d'obstacles utilisant TensorFlow.js et l'API Vision
 */
export class ObstacleDetectionService {
  private static instance: ObstacleDetectionService;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private bluetoothService: BluetoothService;
  private model: tf.GraphModel | null = null;
  private customModel: tf.LayersModel | null = null; // Modèle pour les obstacles personnalisés comme les escaliers
  private lastProcessedTime: number = 0;
  private lastAlertTime: number = 0;
  private imageWidth: number = 300;
  private imageHeight: number = 300;
  private deviceWidth: number = Dimensions.get('window').width;
  private deviceHeight: number = Dimensions.get('window').height;
  
  // Configuration
  private config = {
    wheelchairMode: false,
    detectionThreshold: 0.6, // Seuil de confiance
    alertDistance: 3.0, // Alerte pour les obstacles plus proches que cette distance (mètres)
    alertFrequency: 1500, // Intervalle minimum en ms entre les alertes
    processingFrequency: 500, // Traiter les images tous les X ms
    focalLength: 800, // Longueur focale estimée pour le calcul de distance
    useVoiceAlerts: true,
    useHapticFeedback: true
  };
  
  // Obstacles critiques selon le mode
  private criticalObstacles = {
    default: [
      ObstacleType.CAR, 
      ObstacleType.BICYCLE, 
      ObstacleType.PERSON,
      ObstacleType.FIRE_HYDRANT,
      ObstacleType.POLE
    ],
    wheelchair: [
      ObstacleType.STAIRS, 
      ObstacleType.CURB, 
      ObstacleType.POTHOLE,
      ObstacleType.POLE,
      ObstacleType.CAR
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
  
  // Initialiser TensorFlow et charger les modèles
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    try {
      console.log('Initialisation de TensorFlow...');
      await tf.ready();
      console.log('TensorFlow est prêt');
      
      // Configuration pour l'optimisation de la mémoire sur mobile
      await tf.setBackend('webgl');
      tf.env().set('WEBGL_CPU_FORWARD', true);
      tf.env().set('WEBGL_PACK', false);
      
      // Charger le modèle MobileNet SSD depuis TF Hub
      console.log('Chargement du modèle de détection d\'objets...');
      this.model = await tf.loadGraphModel(
        'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1', 
        { fromTFHub: true }
      );
      
      // Charger le modèle personnalisé pour les obstacles spécifiques aux fauteuils roulants
      try {
        console.log('Chargement du modèle d\'obstacles pour fauteuil roulant...');
        this.customModel = await tf.loadLayersModel(
          'https://storage.googleapis.com/your-bucket/wheelchair_obstacles/model.json'
        );
      } catch (e) {
        console.warn('Modèle personnalisé non disponible, utilisation du modèle par défaut uniquement');
      }
      
      this.isInitialized = true;
      console.log('Modèles chargés avec succès');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du service de détection d\'obstacles:', error);
      return false;
    }
  }
  
  // Mettre à jour la configuration
  public updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    console.log(`Détection d'obstacles: configuration mise à jour`, this.config);
  }
  
  // Démarrer la détection
  public async startDetection(): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }
    
    this.isRunning = true;
    return true;
  }
  
  // Arrêter la détection
  public stopDetection(): void {
    this.isRunning = false;
  }
  
  // Traiter une image de la caméra avec TensorFlow.js
  public async processFrame(imageData: { uri: string } | tf.Tensor3D): Promise<DetectedObstacle[]> {
    if (!this.isRunning || !this.model) return [];
    
    // Vérifier si nous devons traiter cette image (limitation de la fréquence)
    const now = Date.now();
    if (now - this.lastProcessedTime < this.config.processingFrequency) {
      return [];
    }
    
    this.lastProcessedTime = now;
    
    try {
      // Gestion de la mémoire - libérer tous les tenseurs précédents
      tf.engine().startScope();
      
      // Préparer le tenseur d'image
      let imageTensor: tf.Tensor3D;
      
      if ('uri' in imageData) {
        // Pour React Native, convertir l'image en tenseur
        try {
          // Pour les appareils à mémoire limitée, redimensionner d'abord l'image
          const resizedImage = await ImageManipulator.manipulateAsync(
            imageData.uri,
            [{ resize: { width: this.imageWidth, height: this.imageHeight } }],
            { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 }
          );
          
          // Utiliser expo-gl pour créer efficacement un tenseur à partir de l'image
          const imgBuffer = await FileSystem.readAsStringAsync(resizedImage.uri, 
            { encoding: FileSystem.EncodingType.Base64 });
          
          // Créer un canvas ou utiliser le contexte expo-gl pour décoder l'image
          // Ceci est spécifique à la plateforme et nécessiterait une implémentation réelle
          imageTensor = await this.imageToTensor(imgBuffer);
        } catch (imgError) {
          console.error('Erreur de traitement d\'image:', imgError);
          throw imgError;
        }
      } else {
        // Nous avons déjà un tenseur
        imageTensor = imageData;
      }
      
      // Obtenir les dimensions pour une utilisation ultérieure
      const [height, width] = imageTensor.shape.slice(0, 2);
      // Prétraiter l'image pour le modèle
      const preprocessed = tf.tidy(() => {
        // Normaliser les valeurs de pixels à [0, 1]
        const normalized = tf.div(imageTensor, 255) as tf.Tensor3D;
        
        // Redimensionner si nécessaire (MobileNet SSD attend 300x300)
        if (width !== 300 || height !== 300) {
          return tf.image.resizeBilinear(normalized, [300, 300]);
        }
        return normalized;
      });
      
      // Ajouter la dimension du batch
      const batched = tf.expandDims(preprocessed);
      
      // Exécuter l'inférence
      const result = await this.model.executeAsync(batched) as tf.Tensor[];
      
      // Traiter les résultats
      const boxes = result[0];
      const scores = result[1];
      const classes = result[2];
      const numDetections = result[3];
      
      // Convertir en tableaux JavaScript utilisables
      const boxesArray = await boxes.array();
      const scoresArray = await scores.array();
      const classesArray = await classes.array();
      const numDetectionsArray = await numDetections.array();
      
      // Traiter les détections dans notre format DetectedObstacle
      const detectedObstacles: DetectedObstacle[] = [];
      
      // Définir une fonction récursive pour extraire une valeur numérique
      const extractNumericValue = (data: any): number => {
        if (typeof data === 'number') {
          return data;
        } else if (Array.isArray(data)) {
          if (data.length === 0) return 0;
          return extractNumericValue(data[0]);
        }
        return 0;
      };
      
      // Extraire la valeur numérique
      const numDetectionsValue = extractNumericValue(numDetectionsArray);
      const numValidDetections = Math.min(100, numDetectionsValue);
      
      // Type casting for proper array access
      const scoresTyped = Array.isArray(scoresArray) ? 
        (Array.isArray(scoresArray[0]) ? scoresArray as number[][] : [scoresArray as number[]]) : 
        [[]] as number[][];
        
      const classesTyped = Array.isArray(classesArray) ? 
        (Array.isArray(classesArray[0]) ? classesArray as number[][] : [classesArray as number[]]) : 
        [[]] as number[][];
        
      const boxesTyped = Array.isArray(boxesArray) ? 
        (Array.isArray(boxesArray[0]) ? boxesArray as number[][][] : [boxesArray as number[][]]) : 
        [[[]]] as number[][][];
      
      for (let i = 0; i < numValidDetections; i++) {
        // Safety checks for array indexing
        if (!scoresTyped[0] || !classesTyped[0] || !boxesTyped[0]) continue;
        
        const score = scoresTyped[0][i];
        
        // Filtrer selon le seuil de confiance
        if (!score || score < this.config.detectionThreshold) continue;
        
        const classId = Math.round(classesTyped[0][i]);
        const className = classId > 0 && classId <= COCO_CLASSES.length ? 
          COCO_CLASSES[classId - 1] : 'unknown';
        
        // Correspondre la classe COCO à nos types d'obstacles
        const obstacleType = COCO_TO_OBSTACLE_MAP[className] || ObstacleType.POLE;
        
        // Obtenir les coordonnées de la boîte [y1, x1, y2, x2] et convertir en [x, y, w, h]
        const box = boxesTyped[0][i];
        if (!box || box.length < 4) continue;
        
        const [y1, x1, y2, x2] = box;
        
        const boundingBox = {
          x: x1 * width,
          y: y1 * height,
          width: (x2 - x1) * width,
          height: (y2 - y1) * height
        };
        
        // Estimer la distance en utilisant notre algorithme
        const distance = this.estimateDistance(boundingBox, obstacleType);
        
        // Vérifier si ce type d'obstacle est critique pour les utilisateurs en fauteuil roulant
        const isCritical = this.config.wheelchairMode
          ? this.criticalObstacles.wheelchair.includes(obstacleType)
          : this.criticalObstacles.default.includes(obstacleType);
        
        detectedObstacles.push({
          type: obstacleType,
          confidence: score,
          distance,
          boundingBox,
          isCritical
        });
      }
      
      // Appliquer la détection personnalisée pour les obstacles spécifiques au fauteuil roulant si nécessaire
      if (this.config.wheelchairMode && this.customModel) {
        await this.detectCustomObstacles(imageData, detectedObstacles);
      }
      
      // Trier par criticité et distance
      detectedObstacles.sort((a, b) => {
        // Obstacles critiques d'abord
        if (a.isCritical && !b.isCritical) return -1;
        if (!a.isCritical && b.isCritical) return 1;
        
        // Puis par distance
        return a.distance - b.distance;
      });
      
      // Traiter les alertes en fonction des obstacles détectés
      this.processAlerts(detectedObstacles);
      
      // Nettoyage de la mémoire
      tf.engine().endScope();
      if ('uri' in imageData && imageTensor) {
        tf.dispose(imageTensor);
      }
      
      // Explicit disposal of all tensors
      tf.dispose([boxes, scores, classes, numDetections, ...result]);
      tf.dispose(batched);
      tf.dispose(preprocessed);
      
      return detectedObstacles;
    } catch (error) {
      console.error('Erreur lors du traitement de l\'image:', error);
      tf.engine().endScope(); // Assurer le nettoyage même en cas d'erreur
      return [];
    }
  }
  
  // Méthode auxiliaire pour convertir l'image en tenseur (exemple simplifié)
  // Ceci est la méthode corrigée qui résout le problème à la ligne 277
  private async imageToTensor(base64Image: string): Promise<tf.Tensor3D> {
    return new Promise<tf.Tensor3D>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Utiliser tf.tidy pour une meilleure gestion de la mémoire
        const tensor = tf.tidy(() => {
          // Créer un tenseur à partir de l'image en utilisant fromPixels
          // cette ligne était la source de l'erreur
          const pixels = img as unknown as ImageData;
          
          // Création du tenseur avec un cast explicite vers Tensor3D
          const tempTensor = tf.browser.fromPixels(pixels);
          
          // Garantir que c'est bien un Tensor3D en créant une copie
          return tf.clone(tempTensor) as tf.Tensor3D;
        });
        
        // Résoudre la promesse avec le tenseur 3D
        resolve(tensor);
      };
      img.onerror = (err) => {
        console.error("Erreur lors du chargement de l'image:", err);
        // Fallback: Créer un petit tenseur en cas d'erreur
        const fallbackTensor = tf.zeros([1, 1, 3]) as tf.Tensor3D;
        resolve(fallbackTensor);
      };
      img.src = `data:image/jpeg;base64,${base64Image}`;
    });
  }
  
  // Traiter une image avec l'API Google Cloud Vision
  public async processImageWithVision(imageUri: string): Promise<DetectedObstacle[]> {
    try {
      // Vérifier si nous devons traiter cette image (limitation de la fréquence)
      const now = Date.now();
      if (now - this.lastProcessedTime < this.config.processingFrequency) {
        return [];
      }
      
      this.lastProcessedTime = now;
      
      // Convertir l'image en base64
      const base64Image = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Préparer la requête pour l'API Vision
      const body = JSON.stringify({
        requests: [
          {
            features: [
              { type: 'OBJECT_LOCALIZATION', maxResults: 15 },
              { type: 'LABEL_DETECTION', maxResults: 10 },
              { type: 'TEXT_DETECTION', maxResults: 5 }, // Pour détecter les panneaux
            ],
            image: {
              content: base64Image
            }
          }
        ]
      });
      
      // Appeler l'API Vision
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.VISION_API}?key=${ApiConfig.getApiKey()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body
        }
      );
      
      const data = await response.json();
      const detectedObstacles: DetectedObstacle[] = [];
      
      if (data.responses && data.responses[0]) {
        // Traiter les objets localisés
        if (data.responses[0].localizedObjectAnnotations) {
          for (const object of data.responses[0].localizedObjectAnnotations) {
            // Mappage du nom d'objet à notre type d'obstacle
            let obstacleType: ObstacleType | undefined;
            
            // Correspondance simple
            switch(object.name.toLowerCase()) {
              case 'person':
                obstacleType = ObstacleType.PERSON;
                break;
              case 'car':
              case 'vehicle':
              case 'truck':
                obstacleType = ObstacleType.CAR;
                break;
              case 'bicycle':
                obstacleType = ObstacleType.BICYCLE;
                break;
              case 'chair':
                obstacleType = ObstacleType.CHAIR;
                break;
              case 'table':
                obstacleType = ObstacleType.TABLE;
                break;
              case 'dog':
                obstacleType = ObstacleType.DOG;
                break;
              case 'traffic light':
                obstacleType = ObstacleType.TRAFFIC_LIGHT;
                break;
              case 'stop sign':
                obstacleType = ObstacleType.STOP_SIGN;
                break;
              case 'pole':
              case 'street light':
                obstacleType = ObstacleType.POLE;
                break;
              default:
                obstacleType = ObstacleType.POLE; // Par défaut
            }
            
            if (obstacleType) {
              // Calculer la boîte englobante
              const boundingPoly = object.boundingPoly.normalizedVertices;
              
              // Convertir les coordonnées normalisées en pixels
              const x = boundingPoly[0].x * this.deviceWidth;
              const y = boundingPoly[0].y * this.deviceHeight;
              const width = (boundingPoly[1].x - boundingPoly[0].x) * this.deviceWidth;
              const height = (boundingPoly[2].y - boundingPoly[0].y) * this.deviceHeight;
              
              const boundingBox = { x, y, width, height };
              
              // Estimer la distance basée sur la taille de la boîte englobante
              const distance = this.estimateDistance(boundingBox, obstacleType);
              
              // Vérifier si ce type d'obstacle est critique
              const isCritical = this.config.wheelchairMode
                ? this.criticalObstacles.wheelchair.includes(obstacleType)
                : this.criticalObstacles.default.includes(obstacleType);
              
              detectedObstacles.push({
                type: obstacleType,
                confidence: object.score,
                distance,
                boundingBox,
                isCritical
              });
            }
          }
        }
        
        // Traiter les détections de texte pour identifier les panneaux spécifiques
        if (data.responses[0].textAnnotations) {
          for (const text of data.responses[0].textAnnotations) {
            const lowerText = text.description.toLowerCase();
            
            // Rechercher des mots-clés associés aux escaliers, rampes, ascenseurs
            if (
              lowerText.includes('stairs') || 
              lowerText.includes('escalier') ||
              lowerText.includes('step') || 
              lowerText.includes('no wheelchair')
            ) {
              // C'est probablement un escalier ou un avertissement
              const vertices = text.boundingPoly.vertices;
              
              // Calculer la boîte englobante
              const x = Math.min(...vertices.map((v: { x: number }) => v.x));
              const y = Math.min(...vertices.map((v: { y: number }) => v.y));
              const maxX = Math.max(...vertices.map((v: { x: number }) => v.x));
              const maxY = Math.max(...vertices.map((v: { y: number }) => v.y));
              const width = maxX - x;
              const height = maxY - y;
              
              const boundingBox = { x, y, width, height };
              
              detectedObstacles.push({
                type: ObstacleType.STAIRS,
                confidence: 0.9, // Confiance élevée car c'est explicitement indiqué
                distance: 5, // Distance arbitraire pour le panneau
                boundingBox,
                isCritical: true
              });
            } else if (
              lowerText.includes('ramp') || 
              lowerText.includes('rampe') ||
              lowerText.includes('elevator') || 
              lowerText.includes('ascenseur') ||
              lowerText.includes('lift') ||
              lowerText.includes('wheelchair access')
            ) {
              // C'est une indication d'accès pour fauteuil roulant
              // On pourrait l'ajouter à une liste d'informations utiles plutôt que d'obstacles
              console.log('Accès pour fauteuil roulant détecté:', lowerText);
            }
          }
        }
      }
      
      // Trier et traiter les alertes comme avec TensorFlow
      if (detectedObstacles.length > 0) {
        // Trier par distance et criticité
        detectedObstacles.sort((a, b) => {
          if (a.isCritical && !b.isCritical) return -1;
          if (!a.isCritical && b.isCritical) return 1;
          return a.distance - b.distance;
        });
        
        // Alerter l'utilisateur si nécessaire
        this.processAlerts(detectedObstacles);
      }
      
      return detectedObstacles;
    } catch (error) {
      console.error('Erreur lors du traitement de l\'image avec Vision API:', error);
      return [];
    }
  }
  
  // Détection d'obstacles personnalisés pour les utilisateurs en fauteuil roulant
  private async detectCustomObstacles(
    imageData: { uri: string } | tf.Tensor3D, 
    detectedObstacles: DetectedObstacle[]
  ): Promise<void> {
    if (!this.customModel) return;
    
    try {
      // Si nous avons déjà un tenseur, l'utiliser ; sinon, convertir à partir de l'URI
      let imageTensor: tf.Tensor3D;
      
      if ('uri' in imageData) {
        // Convertir l'image en tenseur à l'aide de la méthode auxiliaire
        const base64Image = await FileSystem.readAsStringAsync(imageData.uri, 
          { encoding: FileSystem.EncodingType.Base64 });
        imageTensor = await this.imageToTensor(base64Image);
      } else {
        imageTensor = imageData;
      }
      
      // Prétraiter pour le modèle personnalisé
      const preprocessed = tf.tidy(() => {
        return tf.div(tf.expandDims(imageTensor), 255);
      });
      
      // Utiliser la fonction utilitaire pour éviter les problèmes de type
      const predictions = tfPredict(this.customModel, preprocessed);
      
      const predData = await predictions.data();
      
      // Convertir les prédictions en obstacles
      // En supposant que notre modèle personnalisé génère [escaliers, bordure, rampe, nid-de-poule, chemin_étroit]
      const wheelchairObstacles = [
        ObstacleType.STAIRS,
        ObstacleType.CURB,
        'ramp',
        ObstacleType.POTHOLE,
        'narrow_path'
      ];
      
      for (let i = 0; i < predData.length; i++) {
        const confidence = predData[i];
        
        if (confidence > this.config.detectionThreshold) {
          const obstacleType = wheelchairObstacles[i] as ObstacleType;
          
          // Créer une boîte englobante par défaut (ce serait plus précis avec un modèle de détection)
          const boundingBox = {
            x: SCREEN_WIDTH / 4,
            y: SCREEN_HEIGHT / 3,
            width: SCREEN_WIDTH / 2,
            height: SCREEN_HEIGHT / 4
          };
          
          // Une estimation simple de la distance - dans une application réelle, cela proviendrait des données de profondeur
          const distance = 3.0 + (Math.random() * 2.0); 
          
          detectedObstacles.push({
            type: obstacleType,
            confidence,
            distance,
            boundingBox,
            isCritical: true // Tous les obstacles spécifiques aux fauteuils roulants sont critiques
          });
        }
      }
      
      // Nettoyer
      tf.dispose([imageTensor, preprocessed, predictions]);
    } catch (error) {
      console.error('Erreur lors de la détection d\'obstacles personnalisés:', error);
    }
  }
  
  // Estimer la distance basée sur la taille de la boîte englobante et le type d'objet
  private estimateDistance(box: { width: number, height: number }, type: ObstacleType): number {
    // Références de taille du monde réel (mètres)
    const realWorldSizes: { [key in ObstacleType]?: { width: number, height: number } } = {
      [ObstacleType.PERSON]: { width: 0.5, height: 1.7 },
      [ObstacleType.CAR]: { width: 1.8, height: 1.5 },
      [ObstacleType.BICYCLE]: { width: 0.6, height: 1.2 },
      [ObstacleType.POLE]: { width: 0.2, height: 2.0 },
      [ObstacleType.FIRE_HYDRANT]: { width: 0.3, height: 0.7 },
      [ObstacleType.CHAIR]: { width: 0.5, height: 0.8 },
      [ObstacleType.BENCH]: { width: 1.2, height: 0.5 },
      [ObstacleType.STOP_SIGN]: { width: 0.6, height: 0.6 },
      [ObstacleType.TRAFFIC_LIGHT]: { width: 0.3, height: 0.9 },
      [ObstacleType.STAIRS]: { width: 1.0, height: 0.17 } // Par marche
    };
    
    // Référence par défaut si le type d'objet est inconnu
    const defaultObject = { width: 0.5, height: 1.0 };
    
    // Obtenir la référence de taille du monde réel
    const realSize = realWorldSizes[type] || defaultObject;
    
    // Utiliser la hauteur pour le calcul de la distance (plus fiable)
    // Distance = (hauteur réelle * longueur focale) / hauteur en pixels
    let distance = (realSize.height * this.config.focalLength) / box.height;
    
    // Appliquer un facteur de correction basé sur le type d'objet
    const correctionFactors: { [key in ObstacleType]?: number } = {
      [ObstacleType.PERSON]: 1.0,
      [ObstacleType.CAR]: 1.2,
      [ObstacleType.BICYCLE]: 0.9,
      [ObstacleType.POLE]: 1.1,
      [ObstacleType.STAIRS]: 0.8
    };
    
    const correctionFactor = correctionFactors[type] || 1.0;
    distance = distance * correctionFactor;
    
    // S'assurer que la distance n'est pas inférieure à un minimum raisonnable
    return Math.max(distance, 0.5);
  }
  
  // Traiter les obstacles détectés et alerter l'utilisateur si nécessaire
  private processAlerts(obstacles: DetectedObstacle[]): void {
    // Pas d'obstacles à signaler
    if (obstacles.length === 0) return;
    
    // Trouver l'obstacle critique le plus proche
    const criticalObstacles = obstacles.filter(o => 
      o.isCritical && o.distance < this.config.alertDistance
    );
    
    if (criticalObstacles.length === 0) return;
    
    // Obtenir l'obstacle critique le plus proche
    const nearestObstacle = criticalObstacles[0];
    
    // Alerter l'utilisateur
    this.alertObstacle(nearestObstacle);
  }
  
  // Alerter l'utilisateur à propos d'un obstacle
  private async alertObstacle(obstacle: DetectedObstacle): Promise<void> {
    const now = Date.now();
    
    // Vérifier si nous avons alerté récemment pour éviter des alertes trop fréquentes
    if (now - this.lastAlertTime < this.config.alertFrequency) return;
    
    this.lastAlertTime = now;
    
    // Gérer le retour haptique
    if (this.config.useHapticFeedback) {
      // Déterminer l'intensité en fonction de la distance et de la criticité
      const intensity = Math.min(100, Math.floor((
        obstacle.isCritical ? 1.5 : 1.0) * 
        (1 - obstacle.distance / this.config.alertDistance) * 100
      ));
      
      // Sélectionner le modèle haptique en fonction de la position de l'obstacle et du type
      let feedbackType: HapticFeedbackType;
      
      // Déterminer si l'obstacle est à gauche, à droite ou au centre en fonction de sa position x
      const obstaclePosition = obstacle.boundingBox.x < this.imageWidth / 3 ? 'left' :
                             obstacle.boundingBox.x > (this.imageWidth * 2 / 3) ? 'right' : 
                             'center';
                             
      switch (obstaclePosition) {
        case 'left':
          feedbackType = HapticFeedbackType.LEFT_DIRECTION;
          break;
        case 'right':
          feedbackType = HapticFeedbackType.RIGHT_DIRECTION;
          break;
        default:
          feedbackType = obstacle.isCritical ? 
            HapticFeedbackType.WARNING : 
            HapticFeedbackType.MEDIUM;
      }
      
      // Envoyer le retour haptique
      await this.bluetoothService.sendHapticFeedback(feedbackType, intensity);
    }
    
    // Alerte vocale
    if (this.config.useVoiceAlerts) {
      // Formater le message en fonction du type d'objet et de la distance
      let message = `${obstacle.type.replace('_', ' ')} `;
      
      // Ajouter les informations de distance
      if (obstacle.distance < 1) {
        message += `très proche `;
      } else {
        message += `${Math.round(obstacle.distance)} mètres `;
      }
      
      // Ajouter les informations de position
      const obstaclePosition = obstacle.boundingBox.x < this.imageWidth / 3 ? 'à votre gauche' :
                             obstacle.boundingBox.x > (this.imageWidth * 2 / 3) ? 'à votre droite' : 
                             'devant vous';
      message += obstaclePosition;
      
      // Ajouter un avertissement pour les obstacles critiques
      if (obstacle.isCritical && obstacle.distance < 2) {
        message = `Attention! ${message}`;
      }
      
      // Message spécial pour les utilisateurs en fauteuil roulant
      if (this.config.wheelchairMode && 
          (obstacle.type === ObstacleType.STAIRS || 
           obstacle.type === ObstacleType.CURB || 
           obstacle.type === ObstacleType.POTHOLE)) {
        message = `Attention! ${obstacle.type.replace('_', ' ')} détecté. Non accessible en fauteuil roulant.`;
      }
      
      // Prononcer le message
      Speech.speak(message, {
        rate: obstacle.distance < 2 ? 1.2 : 1.0, // Parler plus vite pour les obstacles plus proches
        pitch: obstacle.isCritical ? 1.2 : 1.0,  // Tonalité plus élevée pour les obstacles critiques
      });
    }
  }
  
  // Méthode utilitaire pour calibrer la longueur focale en fonction d'un objet de référence
  public calibrateFocalLength(
    objectRealHeight: number, // Hauteur réelle de l'objet en mètres
    objectPixelHeight: number // Hauteur de l'objet en pixels dans l'image
  ): number {
    // Distance connue en mètres
    const knownDistance = 1.0; // 1 mètre
    
    // Calcul de la longueur focale: f = (P * D) / H
    // où f est la longueur focale, P est la hauteur en pixels, D est la distance, H est la hauteur réelle
    const focalLength = (objectPixelHeight * knownDistance) / objectRealHeight;
    
    // Mettre à jour la configuration
    this.config.focalLength = focalLength;
    
    return focalLength;
  }
}