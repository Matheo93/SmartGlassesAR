// components/navigation/ARNavigation.tsx - Version améliorée avec chemins fléchés 3D
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  Platform,
  Dimensions,
  Animated
} from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { BluetoothService, HapticFeedbackType } from '../../services/BluetoothService';
import NavigationService, { Coordinate, RouteDetails } from '../../services/NavigationService';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import ApiConfig from '../../services/ApiConfig';

interface ARNavigationProps {
  onClose?: () => void;
  destination?: string | Coordinate;
  wheelchairMode?: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const ARNavigation: React.FC<ARNavigationProps> = ({
  onClose,
  destination: initialDestination,
  wheelchairMode = false
}) => {
  // État de la caméra et de l'appareil
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coordinate | null>(null);
  const [destinationName, setDestinationName] = useState<string>('');
  const [route, setRoute] = useState<RouteDetails | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [arrowOpacity] = useState(new Animated.Value(1));
  const [showPathVisualization, setShowPathVisualization] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const [routeAlternatives, setRouteAlternatives] = useState<RouteDetails[]>([]);
  const [showAlternatives, setShowAlternatives] = useState(false);
  
  // Références pour les services et renderers
  const bluetoothService = useRef(BluetoothService.getInstance());
  const navigationService = useRef(NavigationService.getInstance());
  const cameraRef = useRef<CameraView | null>(null);
  const glViewRef = useRef<GLView | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef3D = useRef<THREE.PerspectiveCamera | null>(null);
  const pathMeshesRef = useRef<THREE.Object3D[]>([]);
  const lastMapUpdateTime = useRef(0);
  
  // Suivi de la localisation
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;
    
    const setupLocationTracking = async () => {
      try {
        // Demander les permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'La localisation est nécessaire pour la navigation');
          return;
        }
        
        // Commencer à surveiller la position
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 2, // Mettre à jour tous les 2 mètres
            timeInterval: 1000 // Ou toutes les secondes
          },
          (location) => {
            const newPosition = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            
            setCurrentPosition(newPosition);
            
            // Vérifier si nous sommes en train de naviguer et mettre à jour la progression
            if (isNavigating && route && currentStepIndex < route.steps.length) {
              updateNavigationProgress(newPosition);
            }
            
            // Mettre à jour la visualisation AR
            if (sceneReady) {
              // Limiter les updates AR à 5 par seconde maximum pour la performance
              const now = Date.now();
              if (now - lastMapUpdateTime.current > 200) { // 200ms = 5fps
                updateARVisualization(newPosition);
                lastMapUpdateTime.current = now;
              }
            }
          }
        );
        
        // Commencer à surveiller le cap
        headingSubscription = await Location.watchHeadingAsync((headingData) => {
          setHeading(headingData.trueHeading);
          
          // Mettre à jour l'orientation dans la visualisation AR
          if (sceneReady && cameraRef3D.current) {
            updateAROrientation(headingData.trueHeading);
          }
        });
        
        // Obtenir la position initiale
        const initialPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation
        });
        
        setCurrentPosition({
          latitude: initialPosition.coords.latitude,
          longitude: initialPosition.coords.longitude
        });
      } catch (error) {
        console.error('Erreur lors de la configuration du suivi de la localisation:', error);
        Alert.alert('Erreur', 'Impossible d\'accéder aux services de localisation');
      }
    };
    
    setupLocationTracking();
    
    // Si une destination initiale est fournie, démarrer automatiquement la navigation
    if (initialDestination) {
      if (typeof initialDestination === 'string') {
        setDestinationName(initialDestination);
        geocodeAndNavigate(initialDestination);
      } else {
        setDestinationCoords(initialDestination);
        startNavigation(initialDestination);
      }
    }
    
    // Animer l'opacité de la flèche pour attirer l'attention
    const startArrowAnimation = () => {
      Animated.sequence([
        Animated.timing(arrowOpacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true
        }),
        Animated.timing(arrowOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true
        })
      ]).start(() => startArrowAnimation());
    };
    
    startArrowAnimation();
    
    // Nettoyage
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (headingSubscription) {
        headingSubscription.remove();
      }
      // Nettoyer les ressources Three.js
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      cleanupARResources();
    };
  }, [initialDestination, isNavigating, route, currentStepIndex, sceneReady]);

  // Mettre à jour la progression de la navigation en fonction de la position actuelle
  const updateNavigationProgress = (position: Coordinate) => {
    if (!route || currentStepIndex >= route.steps.length) return;
    
    const currentStep = route.steps[currentStepIndex];
    const distanceToStep = NavigationService.calculateDistance(position, currentStep.coordinate);
    
    // Fournir un retour haptique lorsque l'utilisateur se rapproche d'un tournant
    if (distanceToStep < 30 && distanceToStep > 20) {
      // S'approche du tournant - retour léger
      bluetoothService.current.sendHapticFeedback(HapticFeedbackType.SHORT, 40);
    } else if (distanceToStep < 20 && distanceToStep > 10) {
      // Se rapproche - retour moyen
      bluetoothService.current.sendHapticFeedback(HapticFeedbackType.MEDIUM, 60);
    } else if (distanceToStep < 10) {
      // Très proche - fort retour directionnel
      const directionalFeedback = getDirectionalHapticFeedback(currentStep.maneuver);
      bluetoothService.current.sendHapticFeedback(directionalFeedback, 100);
    }
    
    // Passer à l'étape suivante si on est à moins de 5 mètres de l'étape actuelle
    if (distanceToStep < 5 && currentStepIndex < route.steps.length - 1) {
      const nextStep = route.steps[currentStepIndex + 1];
      setCurrentStepIndex(currentStepIndex + 1);
      
      // Annoncer la nouvelle étape avec le guidage vocal si activé
      announceNavigationStep(nextStep.instruction, nextStep.distance);
    }
    
    // Vérifier l'arrivée à la destination finale
    if (currentStepIndex === route.steps.length - 1 && distanceToStep < 10) {
      Alert.alert('Destination atteinte', 'Vous êtes arrivé à destination');
      
      // Fournir un retour de succès
      bluetoothService.current.sendHapticFeedback(HapticFeedbackType.SUCCESS, 100);
      
      setIsNavigating(false);
    }
  };

  // Convertir la manœuvre en type de retour haptique approprié
  const getDirectionalHapticFeedback = (maneuver: string): HapticFeedbackType => {
    switch (maneuver) {
      case 'turn-left':
        return HapticFeedbackType.LEFT_DIRECTION;
      case 'turn-right':
        return HapticFeedbackType.RIGHT_DIRECTION;
      case 'straight':
        return HapticFeedbackType.STRAIGHT_DIRECTION;
      default:
        return HapticFeedbackType.MEDIUM;
    }
  };

  // Annoncer les instructions de navigation à l'aide de la voix
  const announceNavigationStep = (instruction: string, distance: number) => {
    // Ici, nous utiliserions expo-speech avec la formatage approprié pour la distance
    console.log(`Annonce de navigation: ${instruction} dans ${distance} mètres`);
  };

  // Géocoder une destination textuelle en coordonnées - amélioré avec Places API
  const geocodeAndNavigate = async (destinationString: string) => {
    try {
      setIsLoading(true);
      
      // Vérifier le quota API
      if (!ApiConfig.trackApiCall('maps')) {
        Alert.alert('Limite API atteinte', 'Veuillez réessayer plus tard.');
        setIsLoading(false);
        return;
      }
      
      // Validation de l'entrée
      if (!destinationString.trim()) {
        Alert.alert('Erreur', 'Veuillez entrer une destination valide');
        setIsLoading(false);
        return;
      }
      
      // Utiliser Places Autocomplete pour de meilleurs résultats
      try {
        const placeResponse = await fetch(
          `${ApiConfig.API_ENDPOINTS.PLACES_AUTOCOMPLETE}?key=${ApiConfig.getApiKey()}&input=${encodeURIComponent(destinationString)}&language=fr`
        );
        
        const placeData = await placeResponse.json();
        
        if (placeData.predictions && placeData.predictions.length > 0) {
          const placeId = placeData.predictions[0].place_id;
          
          // Obtenir les détails du lieu
          const detailsResponse = await fetch(
            `${ApiConfig.API_ENDPOINTS.PLACES_DETAILS}?key=${ApiConfig.getApiKey()}&place_id=${placeId}&fields=name,geometry`
          );
          
          const detailsData = await detailsResponse.json();
          
          if (detailsData.result && detailsData.result.geometry) {
            const coordinates = {
              latitude: detailsData.result.geometry.location.lat,
              longitude: detailsData.result.geometry.location.lng
            };
            
            setDestinationName(detailsData.result.name || destinationString);
            setDestinationCoords(coordinates);
            startNavigation(coordinates);
            return;
          }
        }
      } catch (placeError) {
        console.warn('Error with Places API, falling back to Geocoding:', placeError);
      }
      
      // Solution de repli: utiliser le géocodage standard
      const coordinates = await NavigationService.geocodeAddress(destinationString);
      
      if (!coordinates) {
        Alert.alert('Erreur', 'Destination introuvable');
        setIsLoading(false);
        return;
      }
      
      setDestinationName(destinationString);
      setDestinationCoords(coordinates);
      startNavigation(coordinates);
    } catch (error) {
      console.error('Erreur de géocodage:', error);
      Alert.alert('Erreur', 'Impossible de trouver la destination');
      setIsLoading(false);
    }
  };

  // Démarrer la navigation vers une destination
  const startNavigation = async (destination: Coordinate) => {
    if (!currentPosition) {
      Alert.alert('Erreur', 'Impossible de déterminer votre position actuelle');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Vérifier le quota API
      if (!ApiConfig.trackApiCall('maps')) {
        Alert.alert('Limite API atteinte', 'Veuillez réessayer plus tard.');
        setIsLoading(false);
        return;
      }
      
      // Calculer l'itinéraire
      const newRoute = await NavigationService.getRoute(
        currentPosition,
        destination,
        'walking',
        wheelchairMode
      );
      
      if (!newRoute) {
        Alert.alert('Erreur', 'Impossible de calculer un itinéraire vers cette destination');
        setIsLoading(false);
        return;
      }
      
      // Stocker l'itinéraire principal et les alternatives
      setRoute(newRoute);
      if (newRoute.alternatives && newRoute.alternatives.length > 0) {
        setRouteAlternatives(newRoute.alternatives);
      } else {
        setRouteAlternatives([]);
      }
      
      setCurrentStepIndex(0);
      setIsNavigating(true);
      
      // Annonce initiale de l'étape
      if (newRoute.steps.length > 0) {
        const firstStep = newRoute.steps[0];
        announceNavigationStep(firstStep.instruction, firstStep.distance);
      }
      
      // Retour haptique de succès
      bluetoothService.current.sendHapticFeedback(HapticFeedbackType.SUCCESS, 80);
      
      // Initialiser la visualisation AR avec le nouvel itinéraire
      initARPathVisualization(newRoute);
      
      setIsLoading(false);
    } catch (error) {
      console.error('Erreur de navigation:', error);
      Alert.alert('Erreur', 'Échec du démarrage de la navigation');
      setIsLoading(false);
    }
  };

  // Changer d'itinéraire pour une alternative
  const switchToAlternativeRoute = (alternativeIndex: number) => {
    if (!routeAlternatives || alternativeIndex >= routeAlternatives.length) return;
    
    // Mettre à jour l'itinéraire actif
    const newRoute = routeAlternatives[alternativeIndex];
    
    // Créer un nouveau tableau d'alternatives qui inclut l'ancien itinéraire principal
    const newAlternatives = [
      ...(route ? [route] : []),
      ...routeAlternatives.filter((_, index) => index !== alternativeIndex)
    ];
    
    setRoute(newRoute);
    setRouteAlternatives(newAlternatives);
    setCurrentStepIndex(0);
    
    // Mettre à jour la visualisation AR
    initARPathVisualization(newRoute);
    
    // Notifier l'utilisateur
    Alert.alert('Itinéraire modifié', 'Vous suivez maintenant un itinéraire alternatif');
  };

  // Arrêter la navigation
  const stopNavigation = () => {
    setIsNavigating(false);
    setRoute(null);
    setCurrentStepIndex(0);
    setRouteAlternatives([]);
    
    // Nettoyer les ressources AR
    cleanupARResources();
    
    // Retour haptique pour confirmer l'arrêt
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  // Initialiser la scène Three.js pour la visualisation AR
  const initGL = async (gl: WebGLRenderingContext) => {
    try {
      // Créer un renderer
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0x000000, 0);
      rendererRef.current = renderer;
      
      // Créer une scène
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      
      // Créer une caméra
      const camera = new THREE.PerspectiveCamera(
        75,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        1000
      );
      camera.position.set(0, 1.6, 0);  // Position approximative de la caméra (hauteur des yeux)
      cameraRef3D.current = camera;
      
      // Ajouter un éclairage ambiant
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);
      
      // Ajouter un éclairage directionnel
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(1, 1, 1).normalize();
      scene.add(directionalLight);
      
      // Optimisation pour les appareils à faible puissance
      if (Platform.OS === 'android') {
        renderer.setPixelRatio(1); // Force à 1 sur Android pour les performances
      } else {
        // Sur iOS, utiliser un ratio de pixels adapté
        const pixelRatio = Math.min(2, gl.drawingBufferWidth / SCREEN_WIDTH);
        renderer.setPixelRatio(pixelRatio);
      }
      
      setSceneReady(true);
      
      // Boucle de rendu optimisée
      const render = () => {
        if (rendererRef.current && sceneRef.current && cameraRef3D.current) {
          rendererRef.current.render(sceneRef.current, cameraRef3D.current);
        }
        requestAnimationFrame(render);
      };
      
      render();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de WebGL:', error);
      setShowPathVisualization(false); // Désactiver la visualisation 3D en cas d'erreur
    }
  };

  // Initialiser la visualisation AR du chemin - version optimisée
  const initARPathVisualization = (routeDetails: RouteDetails) => {
    if (!sceneReady || !sceneRef.current || !currentPosition) return;
    
    // Nettoyer les ressources précédentes
    cleanupARResources();
    
    const scene = sceneRef.current;
    const steps = routeDetails.steps;
    
    // Convertir les coordonnées GPS en coordonnées 3D relatives
    // Utiliser la position actuelle comme origine (0,0,0)
    const originLat = currentPosition.latitude;
    const originLng = currentPosition.longitude;
    
    // Optimisation: créer des géométries et matériaux partagés pour réduire l'utilisation mémoire
    const arrowGeometry = new THREE.ConeGeometry(0.5, 1.5, 8);
    
    // Matériaux pour différents types de directions
    const arrowMaterials = {
      normal: new THREE.MeshStandardMaterial({ color: 0x2196F3, transparent: true, opacity: 0.8 }),
      left: new THREE.MeshStandardMaterial({ color: 0xFFDD00, transparent: true, opacity: 0.8 }),
      right: new THREE.MeshStandardMaterial({ color: 0xFFDD00, transparent: true, opacity: 0.8 }),
      straight: new THREE.MeshStandardMaterial({ color: 0x4CAF50, transparent: true, opacity: 0.8 }),
      arrive: new THREE.MeshStandardMaterial({ color: 0xF44336, transparent: true, opacity: 0.8 }),
    };
    
    const pathMaterial = new THREE.LineBasicMaterial({ color: 0x4CAF50, linewidth: 5 });
    
    // Créer des points pour le chemin
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Convertir les coordonnées GPS en mètres relatifs à la position actuelle
      const x = (step.coordinate.longitude - originLng) * 111320 * Math.cos(originLat * Math.PI / 180);
      const z = -(step.coordinate.latitude - originLat) * 111320;
      
      // Choisir le matériau en fonction du type de manœuvre
      let arrowMaterial;
      switch (step.maneuver) {
        case 'turn-left':
          arrowMaterial = arrowMaterials.left;
          break;
        case 'turn-right':
          arrowMaterial = arrowMaterials.right;
          break;
        case 'straight':
          arrowMaterial = arrowMaterials.straight;
          break;
        case 'arrive':
          arrowMaterial = arrowMaterials.arrive;
          break;
        default:
          arrowMaterial = arrowMaterials.normal;
      }
      
      // Créer une flèche directionnelle pour chaque étape
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      
      // Positionner la flèche
      arrow.position.set(x, 1.6, z);  // Y = hauteur des yeux
      
      // Ajouter métadonnées pour faciliter la mise à jour
      (arrow as any).stepIndex = i;
      (arrow as any).maneuver = step.maneuver;
      
      // Orienter la flèche
      if (i < steps.length - 1) {
        const nextStep = steps[i + 1];
        const nextX = (nextStep.coordinate.longitude - originLng) * 111320 * Math.cos(originLat * Math.PI / 180);
        const nextZ = -(nextStep.coordinate.latitude - originLat) * 111320;
        
        // Calculer la direction vers le prochain point
        const direction = new THREE.Vector3(nextX - x, 0, nextZ - z).normalize();
        arrow.lookAt(new THREE.Vector3(
          arrow.position.x + direction.x,
          arrow.position.y,
          arrow.position.z + direction.z
        ));
      }
      
      // Ajouter à la scène
      scene.add(arrow);
      pathMeshesRef.current.push(arrow);
      
      // Ajouter un segment de chemin entre les étapes
      if (i < steps.length - 1) {
        const nextStep = steps[i + 1];
        const nextX = (nextStep.coordinate.longitude - originLng) * 111320 * Math.cos(originLat * Math.PI / 180);
        const nextZ = -(nextStep.coordinate.latitude - originLat) * 111320;
        
        const points = [
          new THREE.Vector3(x, 0.1, z),  // Légèrement au-dessus du sol
          new THREE.Vector3(nextX, 0.1, nextZ)
        ];
        
        const segmentGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const path = new THREE.Line(segmentGeometry, pathMaterial);
        
        // Métadonnées utiles pour la mise à jour
        (path as any).fromStep = i;
        (path as any).toStep = i + 1;
        
        scene.add(path);
        pathMeshesRef.current.push(path);
      }
    }
  };

  // Mettre à jour la visualisation AR en fonction de la position actuelle
  const updateARVisualization = (newPosition: Coordinate) => {
    if (!sceneReady || !sceneRef.current || !route || pathMeshesRef.current.length === 0 || !currentPosition) return;
    
    // Calculer le déplacement depuis la dernière mise à jour
    const deltaLat = newPosition.latitude - currentPosition.latitude;
    const deltaLng = newPosition.longitude - currentPosition.longitude;
    
    // Convertir le déplacement en mètres
    const x = deltaLng * 111320 * Math.cos(newPosition.latitude * Math.PI / 180);
    const z = -deltaLat * 111320;
    
    // Déplacer tous les objets du chemin dans la direction opposée au mouvement de l'utilisateur
    pathMeshesRef.current.forEach(object => {
      object.position.x -= x;
      object.position.z -= z;
      
      // Mise à l'échelle adaptative - rendre les objets plus visibles à distance
      const distance = Math.sqrt(object.position.x * object.position.x + object.position.z * object.position.z);
      
      // Pour les flèches (Mesh), ajuster la taille en fonction de la distance
      if (object instanceof THREE.Mesh) {
        // Ajuster l'opacity des flèches en fonction de la distance
        if ((object.material as THREE.Material).transparent) {
          const opacity = Math.min(1, 0.8 * (1 - Math.min(1, distance / 100)));
          ((object.material as THREE.Material) as THREE.MeshStandardMaterial).opacity = opacity;
        }
        
        // Mettre en évidence la prochaine étape
        const stepIndex = (object as any).stepIndex;
        if (stepIndex === currentStepIndex) {
          object.scale.set(1.5, 1.5, 1.5);
          ((object.material as THREE.Material) as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x333333);
        } else {
          object.scale.set(1, 1, 1);
          ((object.material as THREE.Material) as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x000000);
        }
      }
    });
  };

  // Mettre à jour l'orientation AR en fonction du cap
  const updateAROrientation = (heading: number) => {
    if (!cameraRef3D.current) return;
    
    // Convertir le cap en radians
    const headingRadians = (heading * Math.PI) / 180;
    
    // Tourner la caméra pour s'aligner avec le cap
    cameraRef3D.current.rotation.y = -headingRadians;
  };

  // Nettoyer les ressources AR
  const cleanupARResources = () => {
    if (sceneRef.current) {
      // Supprimer tous les objets du chemin
      pathMeshesRef.current.forEach(object => {
        sceneRef.current?.remove(object);
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        } else if (object instanceof THREE.Line) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
      
      pathMeshesRef.current = [];
    }
  };

  // Obtenir une couleur en fonction du type de manœuvre
  const getColorForManeuver = (maneuver: string): number => {
    switch (maneuver) {
      case 'turn-left':
      case 'turn-right':
        return 0xFFDD00;  // Jaune
      case 'straight':
        return 0x4CAF50;  // Vert
      case 'arrive':
        return 0xF44336;  // Rouge
      default:
        return 0x2196F3;  // Bleu
    }
  };

  // Rendu de la visualisation du chemin (pour la version 2D de secours)
  const renderPathVisualization = () => {
    if (!isNavigating || !route || !heading || !showPathVisualization) return null;
    
    const currentStep = route.steps[currentStepIndex];
    if (!currentStep) return null;
    
    // Calculer le cap (direction) vers le prochain point
    const bearingToTarget = currentPosition ? 
      NavigationService.calculateBearing(currentPosition, currentStep.coordinate) : 0;
    
    // Calculer l'angle relatif (où l'utilisateur doit tourner)
    const relativeAngle = bearingToTarget - (heading || 0);
    const normalizedAngle = ((relativeAngle + 360) % 360) - 180; // Convertir en plage -180 à 180
    
    // Déterminer la direction de la flèche en fonction de l'angle
    let arrowDirection: 'forward' | 'left' | 'right' | 'back' = 'forward';
    if (normalizedAngle > 30 && normalizedAngle < 150) {
      arrowDirection = 'right';
    } else if (normalizedAngle < -30 && normalizedAngle > -150) {
      arrowDirection = 'left';
    } else if (Math.abs(normalizedAngle) > 150) {
      arrowDirection = 'back';
    }
    
    // Obtenir l'icône de flèche en fonction de la direction
    const getArrowIcon = () => {
      switch (arrowDirection) {
        case 'forward':
          return 'arrow-up';
        case 'left':
          return 'arrow-back';
        case 'right':
          return 'arrow-forward';
        case 'back':
          return 'arrow-down';
      }
    };
    
    const distanceToStep = currentPosition ? 
      NavigationService.calculateDistance(currentPosition, currentStep.coordinate) : 0;
    
    return (
      <View style={styles.pathVisualizationContainer}>
        {/* Flèche directionnelle */}
        <Animated.View 
          style={[
            styles.directionArrow,
            { opacity: arrowOpacity }
          ]}
        >
          <Ionicons name={getArrowIcon()} size={60} color="#FFDD00" />
        </Animated.View>
        
        {/* Distance et instruction */}
        <View style={styles.directionInfoContainer}>
          <ThemedText style={styles.distanceText}>
            {Math.round(distanceToStep)}m
          </ThemedText>
          <ThemedText style={styles.instructionText}>
            {currentStep.instruction}
          </ThemedText>
        </View>
        
        {/* Dessiner des points montrant le chemin à venir (visualisation simplifiée) */}
        <View style={styles.pathDotsContainer}>
          {route.steps.slice(currentStepIndex, currentStepIndex + 3).map((step, index) => (
            <View 
              key={index} 
              style={[
                styles.pathDot,
                index === 0 && styles.currentPathDot
              ]} 
            />
          ))}
        </View>
      </View>
    );
  };
  
  // Rendu du panneau des itinéraires alternatifs
  const renderAlternativeRoutes = () => {
    if (!showAlternatives || routeAlternatives.length === 0) return null;
    
    return (
      <View style={styles.alternativesPanel}>
        <View style={styles.alternativesHeader}>
          <ThemedText style={styles.alternativesTitle}>Itinéraires alternatifs</ThemedText>
          <TouchableOpacity onPress={() => setShowAlternatives(false)}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        {routeAlternatives.map((altRoute, index) => {
          const duration = Math.ceil(altRoute.duration / 60);
          const distance = (altRoute.distance / 1000).toFixed(1);
          
          return (
            <TouchableOpacity 
              key={index}
              style={[
                styles.alternativeItem,
                altRoute.wheelchair_accessible && styles.accessibleRoute
              ]}
              onPress={() => switchToAlternativeRoute(index)}
            >
              <View style={styles.alternativeInfo}>
                <ThemedText style={styles.alternativeDuration}>
                  {duration} min ({distance} km)
                </ThemedText>
                {altRoute.wheelchair_accessible && (
                  <View style={styles.accessibleBadge}>
                    <FontAwesome5 name="wheelchair" size={14} color="white" />
                    <ThemedText style={styles.accessibleText}>Accessible</ThemedText>
                  </View>
                )}
              </View>
              <Ionicons name="arrow-forward" size={24} color="white" />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={'back' as CameraType}
        onCameraReady={() => setIsCameraReady(true)}
      >
        {/* Visualisation AR avec OpenGL */}
        {showPathVisualization && (
          <GLView
            style={styles.arOverlay}
            onContextCreate={initGL}
          />
        )}
        
        {/* Visualisation 2D de secours */}
        {renderPathVisualization()}
        
        {/* Liste des itinéraires alternatifs */}
        {renderAlternativeRoutes()}
        
        {/* Contrôles de navigation et informations */}
        <View style={styles.controlsContainer}>
          {/* Afficher la destination et l'ETA si en navigation */}
          {isNavigating && route && (
            <View style={styles.navigationInfoCard}>
              <ThemedText style={styles.destinationText}>
                {destinationName || 'Destination'}
              </ThemedText>
              <ThemedText style={styles.etaText}>
                ETA: {Math.ceil(route.duration / 60)} min ({(route.distance / 1000).toFixed(1)} km)
              </ThemedText>
              
              {routeAlternatives.length > 0 && (
                <TouchableOpacity 
                  style={styles.alternativesButton}
                  onPress={() => setShowAlternatives(!showAlternatives)}
                >
                  <ThemedText style={styles.alternativesButtonText}>
                    {routeAlternatives.length} itinéraire(s) alternatif(s)
                  </ThemedText>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.stopButton}
                onPress={stopNavigation}
              >
                <ThemedText style={styles.stopButtonText}>Arrêter la navigation</ThemedText>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Bouton de toggle pour la visualisation du chemin */}
          <TouchableOpacity
            style={styles.togglePathButton}
            onPress={() => setShowPathVisualization(!showPathVisualization)}
          >
            <Ionicons 
              name={showPathVisualization ? "eye" : "eye-off"} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
          
          {/* Bouton de fermeture */}
          {onClose && (
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Indicateur du mode fauteuil roulant */}
        {wheelchairMode && (
          <View style={styles.wheelchairModeIndicator}>
            <FontAwesome5 name="wheelchair" size={20} color="#4CAF50" />
            <ThemedText style={styles.wheelchairModeText}>
              Mode fauteuil activé
            </ThemedText>
          </View>
        )}
        
        {/* Indicateur de chargement */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>
                Calcul de l'itinéraire...
              </ThemedText>
            </View>
          </View>
        )}
      </CameraView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  arOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10
  },
  pathVisualizationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20
  },
  directionArrow: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionInfoContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
    maxWidth: '80%',
  },
  distanceText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
  },
  pathDotsContainer: {
    flexDirection: 'row',
    marginTop: 20,
  },
  pathDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 5,
  },
  currentPathDot: {
    backgroundColor: '#FFDD00',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  controlsContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    zIndex: 30
  },
  navigationInfoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  destinationText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  etaText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
  },
  alternativesButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    borderRadius: 5,
    padding: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  alternativesButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stopButton: {
    backgroundColor: '#F44336',
    borderRadius: 5,
    padding: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  stopButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  togglePathButton: {
    position: 'absolute',
    top: 0,
    right: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 31
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 31
  },
  wheelchairModeIndicator: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    zIndex: 30
  },
  wheelchairModeText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
  },
  alternativesPanel: {
    position: 'absolute',
    top: 40,
    left: 20, 
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    zIndex: 35,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  alternativesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    padding: 15,
  },
  alternativesTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  alternativeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  alternativeInfo: {
    flex: 1,
  },
  alternativeDuration: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  accessibleRoute: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  accessibleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  accessibleText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 5,
  },
});

export default ARNavigation;