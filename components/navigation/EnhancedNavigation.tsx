// components/navigation/EnhancedNavigation.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ScrollView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

// Définir l'interface pour les obstacles
interface Obstacle {
  type: string;
  distance: number;
  direction: string;
}

// Interface pour les étapes de navigation
interface NavigationStep {
  instruction: string;
  distance: number;
  maneuver: 'turn-right' | 'turn-left' | 'straight' | 'arrive';
  coordinate: { latitude: number; longitude: number };
}

// Mock pour les étapes de navigation (à remplacer par une véritable API)
const mockNavigationSteps: NavigationStep[] = [
  {
    instruction: "Tournez à droite sur Rue de Paris",
    distance: 50,
    maneuver: "turn-right",
    coordinate: { latitude: 48.8566, longitude: 2.3522 }
  },
  {
    instruction: "Continuez tout droit pendant 100 mètres",
    distance: 100,
    maneuver: "straight",
    coordinate: { latitude: 48.8566, longitude: 2.3522 }
  },
  {
    instruction: "Tournez à gauche sur Avenue des Champs-Élysées",
    distance: 150,
    maneuver: "turn-left",
    coordinate: { latitude: 48.8566, longitude: 2.3522 }
  },
  {
    instruction: "Vous êtes arrivé à destination",
    distance: 0,
    maneuver: "arrive",
    coordinate: { latitude: 48.8566, longitude: 2.3522 }
  }
];

// Mock des obstacles (à remplacer par une véritable détection d'obstacles)
const mockObstacles: Obstacle[] = [
  { type: 'stairs', distance: 10, direction: 'ahead' },
  { type: 'curb', distance: 5, direction: 'right' }
];

// Props du composant
interface EnhancedNavigationProps {
  onClose?: () => void;
  initialWheelchairMode?: boolean;
}

export const EnhancedNavigation: React.FC<EnhancedNavigationProps> = ({ 
  onClose,
  initialWheelchairMode = false 
}) => {
  // État
  const [destination, setDestination] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [wheelchairMode, setWheelchairMode] = useState(initialWheelchairMode);
  const [useHapticFeedback, setUseHapticFeedback] = useState(true);
  const [useVoiceGuidance, setUseVoiceGuidance] = useState(true);
  const [nearbyObstacles, setNearbyObstacles] = useState<Obstacle[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  // Obtenir l'étape de navigation actuelle
  const currentStep = isNavigating ? mockNavigationSteps[currentStepIndex] : null;
  
  // Fonction pour commencer la navigation
  const startNavigation = async () => {
    if (!destination) {
      Alert.alert('Destination requise', 'Veuillez entrer une destination');
      return;
    }
    
    try {
      // Dans une implémentation réelle, utiliser l'API de géocodage
      // pour convertir l'adresse en coordonnées GPS
      setIsNavigating(true);
      setCurrentStepIndex(0);
      
      // Simuler le chargement des obstacles
      if (wheelchairMode) {
        setNearbyObstacles(mockObstacles);
      } else {
        setNearbyObstacles([]);
      }
      
      // Retour haptique pour confirmer le démarrage
      if (useHapticFeedback) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Alerter l'utilisateur que la navigation a commencé
      Alert.alert(
        'Navigation démarrée',
        `Direction: ${destination}${wheelchairMode ? ' (Mode fauteuil roulant activé)' : ''}`
      );
    } catch (error) {
      console.error('Error starting navigation:', error);
      Alert.alert('Erreur', 'Impossible de démarrer la navigation');
    }
  };
  
  // Fonction pour arrêter la navigation
  const stopNavigation = () => {
    setIsNavigating(false);
    setCurrentStepIndex(0);
    setNearbyObstacles([]);
    
    // Retour haptique pour confirmer l'arrêt
    if (useHapticFeedback) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };
  
  // Passer à l'étape suivante
  const goToNextStep = () => {
    if (currentStepIndex < mockNavigationSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      
      // Retour haptique selon la direction
      const nextStep = mockNavigationSteps[currentStepIndex + 1];
      triggerDirectionalHaptic(nextStep.maneuver);
    } else {
      // Fin de la navigation
      Alert.alert('Arrivée', 'Vous êtes arrivé à destination');
      stopNavigation();
    }
  };
  
  // Déclencher le retour haptique directionnel
  const triggerDirectionalHaptic = (maneuver: string) => {
    if (!useHapticFeedback) return;
    
    switch(maneuver) {
      case 'turn-right':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'turn-left':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'arrive':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  return (
    <ThemedView style={styles.container}>
      {/* Entête avec titre et bouton de fermeture */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Navigation assistée</ThemedText>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowSettings(!showSettings)}
        >
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Panneau de paramètres */}
      {showSettings && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="wheelchair" size={18} color="#007AFF" />
              <ThemedText style={styles.settingLabel}>
                Mode fauteuil roulant
              </ThemedText>
            </View>
            <Switch
              value={wheelchairMode}
              onValueChange={setWheelchairMode}
              trackColor={{ false: '#767577', true: '#81D4FA' }}
              thumbColor={wheelchairMode ? '#2196F3' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="pulse" size={18} color="#007AFF" />
              <ThemedText style={styles.settingLabel}>
                Retour haptique (vibrations)
              </ThemedText>
            </View>
            <Switch
              value={useHapticFeedback}
              onValueChange={setUseHapticFeedback}
              trackColor={{ false: '#767577', true: '#81D4FA' }}
              thumbColor={useHapticFeedback ? '#2196F3' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="volume-high" size={18} color="#007AFF" />
              <ThemedText style={styles.settingLabel}>
                Guidage vocal
              </ThemedText>
            </View>
            <Switch
              value={useVoiceGuidance}
              onValueChange={setUseVoiceGuidance}
              trackColor={{ false: '#767577', true: '#81D4FA' }}
              thumbColor={useVoiceGuidance ? '#2196F3' : '#f4f3f4'}
            />
          </View>
        </View>
      )}
      
      <ScrollView style={{ flex: 1 }}>
        {/* Champ de destination */}
        {!isNavigating ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.destinationInput}
              placeholder="Entrez votre destination..."
              value={destination}
              onChangeText={setDestination}
              placeholderTextColor="#999"
            />
            <TouchableOpacity 
              style={styles.goButton}
              onPress={startNavigation}
              disabled={!destination}
            >
              <ThemedText style={styles.goButtonText}>GO</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.navigationInfo}>
            {/* Destination actuelle */}
            <View style={styles.destinationContainer}>
              <ThemedText style={styles.destinationTitle}>Destination:</ThemedText>
              <ThemedText style={styles.destinationText}>{destination}</ThemedText>
            </View>
            
            {/* Affichage de l'étape en cours */}
            {currentStep && (
              <View style={styles.stepContainer}>
                <View style={styles.directionIconContainer}>
                  <Ionicons 
                    name={
                      currentStep.maneuver === 'turn-right' ? 'arrow-forward' :
                      currentStep.maneuver === 'turn-left' ? 'arrow-back' :
                      currentStep.maneuver === 'arrive' ? 'checkmark-circle' :
                      'arrow-up'
                    } 
                    size={40} 
                    color="#007AFF" 
                  />
                </View>
                <View style={styles.stepDetails}>
                  <ThemedText style={styles.stepDistance}>
                    {currentStep.distance}m
                  </ThemedText>
                  <ThemedText style={styles.stepInstruction}>
                    {currentStep.instruction}
                  </ThemedText>
                </View>
              </View>
            )}
            
            {/* Liste des obstacles à proximité */}
            {nearbyObstacles.length > 0 && (
              <View style={styles.obstaclesContainer}>
                <ThemedText style={styles.obstaclesTitle}>
                  Obstacles détectés:
                </ThemedText>
                {nearbyObstacles.map((obstacle, index) => (
                  <View key={index} style={styles.obstacleItem}>
                    <Ionicons name="warning" size={16} color="#FF9800" />
                    <ThemedText style={styles.obstacleText}>
                      {obstacle.type} à {obstacle.distance}m ({obstacle.direction})
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
            
            {/* Bouton pour passer à l'étape suivante (pour la démo) */}
            <TouchableOpacity 
              style={styles.nextStepButton}
              onPress={goToNextStep}
            >
              <ThemedText style={styles.nextStepButtonText}>
                Étape suivante
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      
      {/* Mode fauteuil roulant visible en permanence */}
      {wheelchairMode && (
        <View style={styles.wheelchairModeIndicator}>
          <FontAwesome5 name="wheelchair" size={18} color="white" />
          <ThemedText style={styles.wheelchairModeText}>
            Mode fauteuil roulant activé
          </ThemedText>
        </View>
      )}
      
      {/* Bouton d'arrêt de la navigation */}
      {isNavigating && (
        <TouchableOpacity 
          style={styles.stopButton}
          onPress={stopNavigation}
        >
          <ThemedText style={styles.stopButtonText}>
            Arrêter la navigation
          </ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  settingsButton: {
    padding: 5,
    marginRight: 10,
  },
  settingsPanel: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  destinationInput: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  goButton: {
    backgroundColor: '#007AFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  goButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  navigationInfo: {
    flex: 1,
  },
  destinationContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  destinationTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  destinationText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  directionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  stepDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  stepDistance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  stepInstruction: {
    fontSize: 16,
    color: '#333',
    marginTop: 5,
  },
  obstaclesContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  obstaclesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  obstacleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  obstacleText: {
    fontSize: 14,
    marginLeft: 8,
  },
  nextStepButton: {
    backgroundColor: '#2196F3',
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  nextStepButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stopButton: {
    backgroundColor: '#F44336',
    borderRadius: 25,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  stopButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  wheelchairModeIndicator: {
    position: 'absolute',
    top: 70,
    right: 16,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  wheelchairModeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
});

export default EnhancedNavigation;