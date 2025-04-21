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
  
  // Références pour les services et renderers
  const bluetoothService = useRef(BluetoothService.getInstance());
  const navigationService = useRef(NavigationService.getInstance());
  const cameraRef = useRef<CameraView | null>(null);
  const glViewRef = useRef<GLView | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef3D = useRef<THREE.PerspectiveCamera | null>(null);
  const pathMeshesRef = useRef<THREE.Object3D[]>([]);
  
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
              updateARVisualization(newPosition);
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

// Géocoder une destination textuelle en coordonnées
const geocodeAndNavigate = async (destinationString: string) => {
try {
setIsLoading(true);

// Utilise le service de navigation pour géocoder l'adresse
const coordinates = await NavigationService.geocodeAddress(destinationString);

if (!coordinates) {
  Alert.alert('Erreur', 'Destination introuvable');
  setIsLoading(false);
  return;
}

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

setRoute(newRoute);
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

// Arrêter la navigation
const stopNavigation = () => {
setIsNavigating(false);
setRoute(null);
setCurrentStepIndex(0);

// Nettoyer les ressources AR
cleanupARResources();

// Retour haptique pour confirmer l'arrêt
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};

// Initialiser la scène Three.js pour la visualisation AR
const initGL = async (gl: WebGLRenderingContext) => {
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

setSceneReady(true);

// Boucle de rendu
const render = () => {
requestAnimationFrame(render);
if (rendererRef.current && sceneRef.current && cameraRef3D.current) {
  rendererRef.current.render(sceneRef.current, cameraRef3D.current);
}
};

render();
};

// Initialiser la visualisation AR du chemin
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

// Créer des points pour le chemin
for (let i = 0; i < steps.length; i++) {
const step = steps[i];

// Convertir les coordonnées GPS en mètres relatifs à la position actuelle
const x = (step.coordinate.longitude - originLng) * 111320 * Math.cos(originLat * Math.PI / 180);
const z = -(step.coordinate.latitude - originLat) * 111320;

// Créer une flèche directionnelle pour chaque étape
const arrowGeometry = new THREE.ConeGeometry(0.5, 1.5, 8);
const arrowMaterial = new THREE.MeshStandardMaterial({ 
  color: getColorForManeuver(step.maneuver),
  transparent: true,
  opacity: 0.8
});
const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);

// Positionner la flèche
arrow.position.set(x, 1.6, z);  // Y = hauteur des yeux

// Orienter la flèche
if (i < steps.length - 1) {
  const nextStep = steps[i + 1];
  const nextX = (nextStep.coordinate.longitude - originLng) * 111320 * Math.cos(originLat * Math.PI / 180);
  const nextZ = -(nextStep.coordinate.latitude - originLat) * 111320;
  
  // Calculer la direction vers le prochain point
  const direction = new THREE.Vector3(nextX - x, 0, nextZ - z).normalize();
  arrow.lookAt(direction.add(arrow.position));
}

// Ajouter à la scène
scene.add(arrow);
pathMeshesRef.current.push(arrow);

// Ajouter un segment de chemin entre les étapes
if (i < steps.length - 1) {
  const nextStep = steps[i + 1];
  const nextX = (nextStep.coordinate.longitude - originLng) * 111320 * Math.cos(originLat * Math.PI / 180);
  const nextZ = -(nextStep.coordinate.latitude - originLat) * 111320;
  
  const pathGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, 0.1, z),  // Légèrement au-dessus du sol
    new THREE.Vector3(nextX, 0.1, nextZ)
  ]);
  
  const pathMaterial = new THREE.LineBasicMaterial({ 
    color: 0x4CAF50,
    linewidth: 5
  });
  
  const path = new THREE.Line(pathGeometry, pathMaterial);
  scene.add(path);
  pathMeshesRef.current.push(path);
}
}
};

// Mettre à jour la visualisation AR en fonction de la position actuelle
const updateARVisualization = (newPosition: Coordinate) => {
if (!sceneReady || !sceneRef.current || !route || pathMeshesRef.current.length === 0) return;

// Calculer le déplacement depuis la dernière mise à jour
const deltaLat = newPosition.latitude - (currentPosition?.latitude || newPosition.latitude);
const deltaLng = newPosition.longitude - (currentPosition?.longitude || newPosition.longitude);

// Convertir le déplacement en mètres
const x = deltaLng * 111320 * Math.cos(newPosition.latitude * Math.PI / 180);
const z = -deltaLat * 111320;

// Déplacer tous les objets du chemin dans la direction opposée au mouvement de l'utilisateur
pathMeshesRef.current.forEach(object => {
object.position.x -= x;
object.position.z -= z;
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

return (
<ThemedView style={styles.container}>
<CameraView
  ref={cameraRef}
  style={styles.camera}
  facing={'back' as CameraType}
  onCameraReady={() => setIsCameraReady(true)}
>
  {/* Visualisation AR avec OpenGL */}
  <GLView
    style={styles.arOverlay}
    onContextCreate={initGL}
  />
  
  {/* Visualisation 2D de secours */}
  {renderPathVisualization()}
  
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
});

export default ARNavigation;