// NavigationService.ts - Service de navigation accessible
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import ApiConfig from './ApiConfig';
import { BluetoothService, HapticFeedbackType } from './BluetoothService';

// Interfaces
export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  coordinate: Coordinate;
  distance?: number;
  types?: string[];
  wheelchair_accessible?: boolean;
}

export interface NavigationStep {
  instruction: string;
  distance: number; // en mètres
  duration: number; // en secondes
  maneuver: 'straight' | 'turn-left' | 'turn-right' | 'uturn' | 'arrive' | 'depart' | 'ramp' | 'elevator';
  coordinate: Coordinate;
  has_stairs?: boolean;
  has_curb?: boolean;
  wheelchair_accessible?: boolean;
  elevation_change?: number;
  has_steep_slope?: boolean;
}

export interface RouteDetails {
  origin: Coordinate;
  destination: Coordinate;
  distance: number; // distance totale en mètres
  duration: number; // durée totale en secondes
  steps: NavigationStep[];
  wheelchair_accessible: boolean;
  polyline?: string; // polyline encodée pour la route
  alternatives?: RouteDetails[]; // routes alternatives
}

// Modes de transport valides
export type TransportMode = 'walking' | 'driving' | 'bicycling' | 'transit';

/**
 * Service de navigation amélioré avec fonctionnalités d'accessibilité
 */
export class NavigationService {
  private static instance: NavigationService | null = null;
  private currentRoute: RouteDetails | null = null;
  private locationWatcher: Location.LocationSubscription | null = null;
  private headingWatcher: Location.LocationSubscription | null = null;
  private currentHeading: number | null = null;
  private isNavigating: boolean = false;
  private bluetoothService: BluetoothService;
  private nextHapticFeedbackTime: number = 0;
  
  // Configuration
  private config = {
    wheelchairMode: false,
    useVoiceGuidance: true,
    useHapticFeedback: true,
    hapticFeedbackInterval: 1000, // millisecondes
    announceTurnsDistance: 50, // mètres
    announceObstaclesDistance: 30, // mètres
    distanceUnit: 'metric', // 'metric' ou 'imperial'
    voiceLanguage: 'fr-FR',
    voiceRate: 0.9,
    detourAlertThreshold: 20, // mètres
    safetyAlerts: true
  };
  
  constructor() {
    this.bluetoothService = BluetoothService.getInstance();
  }
  
  // Créer une instance singleton
  public static getInstance(): NavigationService {
    if (!this.instance) {
      this.instance = new NavigationService();
    }
    return this.instance;
  }
  
  // Mettre à jour la configuration
  public updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    console.log('Config de navigation mise à jour:', this.config);
  }
  
  /**
   * Demander les permissions de localisation
   */
  public static async requestLocationPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        // Demander également les permissions en arrière-plan si disponibles
        if (Platform.OS === 'ios' || parseInt(Platform.Version.toString(), 10) >= 29) {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          return bgStatus === 'granted';
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erreur lors de la demande des permissions de localisation:', error);
      return false;
    }
  }

  /**
   * Obtenir la position actuelle avec une haute précision
   */
  public static async getCurrentLocation(): Promise<Coordinate | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'La permission de localisation est nécessaire pour la navigation'
        );
        return null;
      }
      
      // Obtenir la position actuelle avec une haute précision
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Erreur lors de l\'obtention de la position actuelle:', error);
      return null;
    }
  }

  /**
   * Commencer à surveiller la position avec une haute précision
   */
  public async startLocationTracking(
    onLocationUpdate: (location: Coordinate) => void,
    onHeadingUpdate?: (heading: number) => void
  ): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'La permission de localisation est nécessaire pour la navigation'
        );
        return false;
      }
      
      // Commencer à surveiller la position avec une haute précision
      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 2, // Mettre à jour tous les 2 mètres
          timeInterval: 1000 // Ou mettre à jour toutes les secondes
        },
        (location) => {
          const newPosition = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          };
          
          onLocationUpdate(newPosition);
        }
      );
      
      // Commencer à surveiller le cap (si demandé)
      if (onHeadingUpdate) {
        this.headingWatcher = await Location.watchHeadingAsync((headingData) => {
          this.currentHeading = headingData.trueHeading;
          onHeadingUpdate(headingData.trueHeading);
        });
      }
      
      return true;
    } catch (error) {
      console.error('Erreur lors du démarrage du suivi de localisation:', error);
      return false;
    }
  }
  
  /**
   * Arrêter de surveiller la position
   */
  public stopLocationTracking(): void {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
    }
    
    if (this.headingWatcher) {
      this.headingWatcher.remove();
      this.headingWatcher = null;
    }
  }

  /**
   * Rechercher des lieux accessibles près d'une position
   */
  public static async searchPlaces(
    query: string,
    location: Coordinate,
    radius: number = 1500, // Rayon de 1,5 km par défaut
    wheelchair_accessible: boolean = false,
    type?: string // Type de lieu optionnel (restaurant, hospital, etc.)
  ): Promise<Place[]> {
    try {
      // Construire les paramètres d'URL
      const params = new URLSearchParams({
        key: ApiConfig.getApiKey(),
        location: `${location.latitude},${location.longitude}`,
        radius: radius.toString(),
        keyword: query,
      });
      
      if (type) {
        params.append('type', type);
      }
      
      if (wheelchair_accessible) {
        // L'API Places ne prend pas directement en charge le filtre d'accessibilité pour fauteuil roulant
        // Mais nous pouvons essayer de filtrer pour les lieux qui mentionnent l'accessibilité
        params.append('keyword', `${query} accessible`);
      }
      
      // Appeler l'API Places
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.PLACES_NEARBY}?${params.toString()}`
      );
      
      const data = await response.json();
      
      if (data.status !== 'OK' || !data.results) {
        console.warn('L\'API Places a renvoyé le statut:', data.status);
        return [];
      }
      
      // Transformer les résultats à notre format et filtrer pour l'accessibilité si nécessaire
      return data.results.map((place: any): Place => {
        // Traiter l'accessibilité en fauteuil roulant en fonction des données disponibles
        // Note: L'API Places de Google ne fournit pas directement d'informations sur l'accessibilité en fauteuil roulant
        // C'est une approximation basée sur les données disponibles
        let is_accessible = false;
        
        if (place.plus_code && place.plus_code.compound_code) {
          // Rechercher des indices d'accessibilité dans la description
          is_accessible = place.plus_code.compound_code.toLowerCase().includes('accessible') ||
                         place.name.toLowerCase().includes('accessible');
        }
        
        // Calculer la distance si nous avons la position actuelle
        let distance: number | undefined = undefined;
        
        if (location) {
          distance = this.calculateDistance(
            location,
            {
              latitude: place.geometry.location.lat,
              longitude: place.geometry.location.lng
            }
          );
        }
        
        return {
          id: place.place_id,
          name: place.name,
          address: place.vicinity,
          coordinate: {
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
          },
          types: place.types,
          wheelchair_accessible: is_accessible,
          distance
        };
      });
    } catch (error) {
      console.error('Erreur lors de la recherche de lieux:', error);
      return [];
    }
  }

  /**
   * Géocoder une adresse en coordonnées
   */
  public static async geocodeAddress(address: string): Promise<Coordinate | null> {
    try {
      const params = new URLSearchParams({
        key: ApiConfig.getApiKey(),
        address,
      });
      
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.GEOCODING}?${params.toString()}`
      );
      
      const data = await response.json();
      
      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.warn('L\'API de géocodage a renvoyé le statut:', data.status);
        return null;
      }
      
      const location = data.results[0].geometry.location;
      
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    } catch (error) {
      console.error('Erreur lors du géocodage de l\'adresse:', error);
      return null;
    }
  }

  /**
   * Obtenir un itinéraire accessible entre deux points avec intégration API réelle
   */
  public static async getRoute(
    origin: Coordinate,
    destination: Coordinate,
    mode: TransportMode = 'walking',
    wheelchair: boolean = false
  ): Promise<RouteDetails | null> {
    try {
      // Clé API pour l'API Google Directions
      const apiKey = ApiConfig.getApiKey();
      
      // Paramètres URL améliorés pour l'accessibilité
      const params = new URLSearchParams({
        key: apiKey,
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        mode: mode,
        alternatives: 'true', // Demander des itinéraires alternatifs
        units: 'metric',
        language: 'fr', // Peut être modifié en fonction des préférences de l'utilisateur
        departure_time: 'now',
      });
      
      // Ajouter des paramètres d'accessibilité
      if (wheelchair) {
        // Google Directions ne prend pas directement en charge le routage en fauteuil roulant
        // Nous pouvons utiliser ces paramètres pour l'approximer
        params.append('avoid', 'indoor'); // Souvent contient des escaliers
        
        if (mode === 'walking') {
          // Obtenir un chemin détaillé pour une meilleure analyse d'accessibilité
          params.append('waypoints', 'optimize:false'); // Ne pas optimiser les points intermédiaires pour obtenir un chemin exact
        }
        
        if (mode === 'transit') {
          // Demander le champ wheelchair_boarding pour les stations de transit
          params.append('transit_routing_preference', 'less_walking');
          params.append('transit_mode', 'bus|subway|train|tram|rail');
        }
      }
      
      // Faire la requête API
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.MAPS_DIRECTIONS}?${params.toString()}`
      );
      
      if (!response.ok) {
        throw new Error(`Erreur API Directions: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
        console.warn('L\'API Directions a renvoyé le statut:', data.status);
        return null;
      }
      
      // Traiter les itinéraires avec informations d'accessibilité
      const processedRoutes = data.routes.map((route: any) => 
        this.processRouteForAccessibility(route, origin, destination, wheelchair)
      );
      
      // Trier les itinéraires pour l'accessibilité si nécessaire
      if (wheelchair) {
        processedRoutes.sort((a: RouteDetails, b: RouteDetails) => {
          // Prioriser les itinéraires accessibles en fauteuil roulant
          if (a.wheelchair_accessible && !b.wheelchair_accessible) return -1;
          if (!a.wheelchair_accessible && b.wheelchair_accessible) return 1;
          // Puis trier par durée
          return a.duration - b.duration;
        });
      } else {
        // Trier par durée uniquement
        processedRoutes.sort((a: RouteDetails, b: RouteDetails) => 
          a.duration - b.duration
        );
      }
      
      // Retourner le meilleur itinéraire avec alternatives
      const bestRoute = processedRoutes[0];
      bestRoute.alternatives = processedRoutes.slice(1);
      
      return bestRoute;
    } catch (error) {
      console.error('Erreur lors de l\'obtention de l\'itinéraire:', error);
      return null;
    }
  }
  
  /**
   * Traiter l'itinéraire avec des informations d'accessibilité améliorées
   */
  private static processRouteForAccessibility(
    route: any, 
    origin: Coordinate,
    destination: Coordinate, 
    wheelchair: boolean
  ): RouteDetails {
    const leg = route.legs[0];
    
    // Traiter les étapes avec des informations d'accessibilité
    const steps: NavigationStep[] = leg.steps.map((step: any) => {
      // Extraire les instructions (supprimer les balises HTML)
      const instruction = step.html_instructions.replace(/<[^>]*>/g, ' ').trim();
      
      // Déterminer le type de manœuvre
      let maneuver: NavigationStep['maneuver'] = 'straight';
      
      if (step.maneuver) {
        if (step.maneuver.includes('left')) {
          maneuver = 'turn-left';
        } else if (step.maneuver.includes('right')) {
          maneuver = 'turn-right';
        } else if (step.maneuver.includes('uturn')) {
          maneuver = 'uturn';
        }
      }
      
      // Analyse d'accessibilité améliorée
      // Vérifier le texte pour les problèmes d'accessibilité
      const instructionLower = instruction.toLowerCase();
      
      const has_stairs = instructionLower.includes('stair') || 
                        instructionLower.includes('escalier') ||
                        instructionLower.includes('marche');
                      
      const has_curb = instructionLower.includes('curb') ||
                      instructionLower.includes('bordure') ||
                      instructionLower.includes('trottoir');
                    
      const has_elevator = instructionLower.includes('elevator') || 
                          instructionLower.includes('ascenseur') ||
                          instructionLower.includes('lift');
                        
      const has_ramp = instructionLower.includes('ramp') ||
                      instructionLower.includes('rampe');
      
      // Vérifier si l'étape implique un changement d'élévation
      let elevation_change = 0;
      if (step.elevation_data) {
        const elevations = step.elevation_data;
        if (elevations.length > 1) {
          const firstElevation = elevations[0].elevation;
          const lastElevation = elevations[elevations.length - 1].elevation;
          elevation_change = lastElevation - firstElevation;
        }
      }
      
      // Détecter les pentes raides (problématiques pour les fauteuils roulants)
      const has_steep_slope = Math.abs(elevation_change) > 2; // Plus de 2m de changement
      
      // Traitement spécial pour les étapes de transit
      let transit_wheelchair_accessible = false;
      if (step.travel_mode === 'TRANSIT' && step.transit_details) {
        transit_wheelchair_accessible = 
          step.transit_details.line.wheelchair_accessible === true ||
          (step.transit_details.stop && 
           step.transit_details.stop.wheelchair_boarding === true);
           
        // Définir la manœuvre appropriée pour le transit
        maneuver = 'straight'; // Par défaut pour le transit
      }
      
      // Pour les étapes avec des données d'élévation indiquant une rampe ou un ascenseur
      if (step.elevation_data && elevation_change !== 0) {
        if (has_elevator) {
          maneuver = 'elevator';
        } else if (has_ramp || Math.abs(elevation_change) < 5) {
          maneuver = 'ramp';
        }
      }
      
      // Déterminer l'accessibilité en fauteuil roulant
      const wheelchair_accessible = 
        !has_stairs && 
        !has_steep_slope && 
        (has_ramp || has_elevator || !has_curb) &&
        (step.travel_mode !== 'TRANSIT' || transit_wheelchair_accessible);
      
      return {
        instruction,
        distance: step.distance.value,
        duration: step.duration.value,
        maneuver,
        coordinate: {
          latitude: step.end_location.lat,
          longitude: step.end_location.lng,
        },
        has_stairs,
        has_curb,
        wheelchair_accessible,
        elevation_change,
        has_steep_slope
      };
    });
    
    // Ajouter les étapes de départ et d'arrivée
    if (steps.length > 0) {
      steps[0].maneuver = 'depart';
      steps[steps.length - 1].maneuver = 'arrive';
    }
    
    // Accessibilité globale de l'itinéraire en fauteuil roulant
    const wheelchair_accessible = steps.every(step => step.wheelchair_accessible !== false);
    
    return {
      origin,
      destination: {
        latitude: leg.end_location.lat,
        longitude: leg.end_location.lng,
      },
      distance: leg.distance.value,
      duration: leg.duration.value,
      steps,
      wheelchair_accessible,
      polyline: route.overview_polyline.points,
    };
  }

  /**
   * Calculer la distance entre deux coordonnées en utilisant la formule de Haversine
   */
  public static calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance en mètres
  }
  
  /**
   * Calculer la direction (cap) entre deux coordonnées
   * @returns Cap en degrés (0-360, 0 = Nord)
   */
  public static calculateBearing(from: Coordinate, to: Coordinate): number {
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) -
      Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    let bearing = Math.atan2(y, x) * (180 / Math.PI);
    bearing = (bearing + 360) % 360; // Normaliser à 0-360
    
    return bearing;
  }
  
  /**
   * Formater la distance en fonction des préférences de l'utilisateur
   */
  public formatDistance(meters: number): string {
    if (this.config.distanceUnit === 'imperial') {
      // Convertir en pieds pour les courtes distances, en miles pour les plus longues
      if (meters < 800) {
        const feet = Math.round(meters * 3.28084);
        return `${feet} pieds`;
      } else {
        const miles = (meters / 1609.34).toFixed(1);
        return `${miles} miles`;
      }
    } else {
      // Métrique: utiliser les mètres pour les courtes distances, les kilomètres pour les plus longues
      if (meters < 1000) {
        return `${Math.round(meters)} mètres`;
      } else {
        const km = (meters / 1000).toFixed(1);
        return `${km} kilomètres`;
      }
    }
  }
  
  // Méthodes d'instance pour la navigation
  public getCurrentRoute(): RouteDetails | null {
    return this.currentRoute;
  }
  
  public setCurrentRoute(route: RouteDetails | null): void {
    this.currentRoute = route;
  }
  
  /**
   * Démarrer la navigation vers une destination
   */
  public async startNavigation(
    destination: Coordinate,
    mode: TransportMode = 'walking',
    wheelchair: boolean = false,
    onLocationUpdate?: (location: Coordinate) => void,
    onStepChange?: (step: NavigationStep) => void,
    onArrival?: () => void
  ): Promise<RouteDetails | null> {
    try {
      // Obtenir la position actuelle
      const currentPosition = await NavigationService.getCurrentLocation();
      if (!currentPosition) {
        throw new Error('Impossible d\'obtenir la position actuelle');
      }
      
      // Obtenir l'itinéraire
      const route = await NavigationService.getRoute(
        currentPosition,
        destination,
        mode,
        wheelchair || this.config.wheelchairMode
      );
      
      if (!route) {
        throw new Error('Échec du calcul de l\'itinéraire');
      }
      
      // Vérifier si l'itinéraire est accessible en mode fauteuil roulant
      if ((wheelchair || this.config.wheelchairMode) && !route.wheelchair_accessible) {
        // Rechercher des alternatives accessibles
        if (route.alternatives && route.alternatives.some(r => r.wheelchair_accessible)) {
          // Utiliser la première alternative accessible
          const accessibleRoute = route.alternatives.find(r => r.wheelchair_accessible);
          if (accessibleRoute) {
            this.setCurrentRoute(accessibleRoute);
            
            // Informer l'utilisateur de l'itinéraire alternatif
            if (this.config.useVoiceGuidance) {
              Speech.speak(
                'Utilisation d\'un itinéraire alternatif accessible. L\'itinéraire principal peut comporter des escaliers ou d\'autres obstacles.',
                { rate: this.config.voiceRate, language: this.config.voiceLanguage }
              );
            }
          }
        } else {
          // Avertir de l'itinéraire inaccessible
          if (this.config.useVoiceGuidance) {
            Speech.speak(
              'Attention : Cet itinéraire peut ne pas être entièrement accessible en fauteuil roulant. Procédez avec prudence.',
              { rate: this.config.voiceRate, language: this.config.voiceLanguage }
            );
          }
          this.setCurrentRoute(route);
        }
      } else {
        // Utiliser l'itinéraire principal
        this.setCurrentRoute(route);
      }
      
      // Commencer à suivre la position
      this.isNavigating = true;
      let currentStepIndex = 0;
      
      await this.startLocationTracking(
        (location) => {
          // Passer la mise à jour de position au callback s'il est fourni
          if (onLocationUpdate) {
            onLocationUpdate(location);
          }
          
          // Vérifier si l'itinéraire et les étapes sont disponibles
          if (!this.currentRoute || !this.currentRoute.steps || this.currentRoute.steps.length === 0) {
            return;
          }
          
          // Vérifier si nous avons atteint l'étape actuelle
          const currentStep = this.currentRoute.steps[currentStepIndex];
          const distanceToStep = NavigationService.calculateDistance(location, currentStep.coordinate);
          
          // Fournir un retour haptique basé sur la distance au tournant
          this.provideNavigationFeedback(distanceToStep, currentStep);
          
          // Vérifier s'il est temps d'annoncer le prochain tournant ou obstacle
          if (currentStep.maneuver !== 'straight' && 
              currentStep.maneuver !== 'depart' && 
              distanceToStep <= this.config.announceTurnsDistance) {
            
            // Annoncer seulement si nous ne l'avons pas fait récemment
            const now = Date.now();
            if (now > this.nextHapticFeedbackTime) {
              this.announceUpcomingTurn(currentStep);
              this.nextHapticFeedbackTime = now + this.config.hapticFeedbackInterval;
            }
          }
          
          // Vérifier les obstacles en mode fauteuil roulant
          if ((wheelchair || this.config.wheelchairMode) && 
              this.config.safetyAlerts && 
              (currentStep.has_stairs || currentStep.has_steep_slope)) {
            
            const now = Date.now();
            if (distanceToStep <= this.config.announceObstaclesDistance && 
                now > this.nextHapticFeedbackTime) {
              this.announceObstacle(currentStep);
              this.nextHapticFeedbackTime = now + this.config.hapticFeedbackInterval;
            }
          }
          
          // Si assez proche de l'étape actuelle, passer à l'étape suivante
          if (distanceToStep < 10 && currentStepIndex < this.currentRoute.steps.length - 1) {
            currentStepIndex++;
            
            // Notifier le callback du changement d'étape
            if (onStepChange) {
              onStepChange(this.currentRoute.steps[currentStepIndex]);
            }
            
            // Annoncer la nouvelle étape
            this.announceNavigationStep(this.currentRoute.steps[currentStepIndex]);
          }
          
          // Vérifier si nous avons atteint la destination finale
          if (currentStepIndex === this.currentRoute.steps.length - 1 && distanceToStep < 20) {
            this.announceArrival();
            this.isNavigating = false;
            this.stopLocationTracking();
            
            // Notifier le callback de l'arrivée
            if (onArrival) {
              onArrival();
            }
          }
          
          // Vérifier si nous sommes hors itinéraire
          this.checkIfOffRoute(location, currentStepIndex);
        },
        (heading) => {
          // Nous pourrions utiliser le cap pour des indications plus précises
          // Par exemple, pour dire à l'utilisateur dans quelle direction se tourner
        }
      );
      
      // Annoncer la première étape
      if (this.currentRoute && this.currentRoute.steps.length > 0) {
        this.announceNavigationStart(this.currentRoute);
      }
      
      return this.currentRoute;
    } catch (error) {
      console.error('Erreur lors du démarrage de la navigation:', error);
      throw error;
    }
  }
  
  /**
   * Annoncer le début de la navigation
   */
  private announceNavigationStart(route: RouteDetails): void {
    if (!this.config.useVoiceGuidance) return;
    
    // Formater la distance totale
    const formattedDistance = this.formatDistance(route.distance);
    
    // Formater le temps total
    const minutes = Math.round(route.duration / 60);
    
    // Construire le message
    let message = `Démarrage de la navigation. Distance totale: ${formattedDistance}. Temps estimé: ${minutes} minutes.`;
    
    // Ajouter des informations d'accessibilité si pertinent
    if (this.config.wheelchairMode) {
      if (route.wheelchair_accessible) {
        message += ' Cet itinéraire est accessible en fauteuil roulant.';
      } else {
        message += ' Attention: Cet itinéraire peut ne pas être entièrement accessible en fauteuil roulant.';
      }
    }
    
    // Prononcer le message
    Speech.speak(message, {
      rate: this.config.voiceRate,
      language: this.config.voiceLanguage
    });
    
    // Annoncer également la première étape
    if (route.steps.length > 0) {
      setTimeout(() => {
        this.announceNavigationStep(route.steps[0]);
      }, 5000); // Attendre 5 secondes avant d'annoncer la première étape
    }
  }
  
  /**
   * Annoncer une étape de navigation
   */
  private announceNavigationStep(step: NavigationStep): void {
    if (!this.config.useVoiceGuidance) return;
    
    // Formater la distance
    const formattedDistance = this.formatDistance(step.distance);
    
    // Construire l'instruction
    let instruction = step.instruction;
    
    // Ajouter la distance si elle n'est pas déjà dans l'instruction
    if (!instruction.toLowerCase().includes('mètre') && 
        !instruction.toLowerCase().includes('km') &&
        !instruction.toLowerCase().includes('mile') &&
        !instruction.toLowerCase().includes('pied')) {
      instruction = `${instruction} sur ${formattedDistance}`;
    }
    
    // Prononcer l'instruction
    Speech.speak(instruction, {
      rate: this.config.voiceRate,
      language: this.config.voiceLanguage
    });
    
    // Retour haptique
    if (this.config.useHapticFeedback) {
      this.provideDirectionalHapticFeedback(step.maneuver);
    }
  }
  
  /**
   * Annoncer un virage à venir
   */
  private announceUpcomingTurn(step: NavigationStep): void {
    if (!this.config.useVoiceGuidance) return;
    
    // Formater la distance
    const formattedDistance = this.formatDistance(step.distance);
    
    // Construire l'annonce
    let announcement = '';
    
    switch (step.maneuver) {
      case 'turn-left':
        announcement = `Dans ${formattedDistance}, tournez à gauche`;
        break;
      case 'turn-right':
        announcement = `Dans ${formattedDistance}, tournez à droite`;
        break;
      case 'uturn':
        announcement = `Dans ${formattedDistance}, faites demi-tour`;
        break;
      case 'ramp':
        announcement = `Dans ${formattedDistance}, prenez la rampe`;
        break;
      case 'elevator':
        announcement = `Dans ${formattedDistance}, prenez l'ascenseur`;
        break;
      case 'arrive':
        announcement = `Votre destination est à ${formattedDistance}`;
        break;
      default:
        // Pas d'annonce pour les manœuvres tout droit ou autres
        return;
    }
    
    // Prononcer l'annonce
    Speech.speak(announcement, {
      rate: this.config.voiceRate,
      language: this.config.voiceLanguage
    });
    
    // Retour haptique
    if (this.config.useHapticFeedback) {
      this.provideDirectionalHapticFeedback(step.maneuver);
    }
  }
  
  /**
   * Annoncer un obstacle
   */
  private announceObstacle(step: NavigationStep): void {
    if (!this.config.useVoiceGuidance || !this.config.safetyAlerts) return;
    
    // Construire l'annonce
    let announcement = '';
    
    if (step.has_stairs) {
      announcement = 'Attention: Escaliers devant. ';
      
      if (step.wheelchair_accessible) {
        announcement += 'Il devrait y avoir une rampe ou un ascenseur à proximité.';
      } else {
        announcement += 'Cette zone peut ne pas être accessible en fauteuil roulant.';
      }
    } else if (step.has_curb) {
      announcement = 'Attention: Bordure de trottoir devant. ';
      
      if (step.wheelchair_accessible) {
        announcement += 'Il devrait y avoir un abaissement de trottoir à proximité.';
      } else {
        announcement += 'Cette zone peut ne pas être accessible en fauteuil roulant.';
      }
    } else if (step.has_steep_slope) {
      announcement = 'Attention: Pente raide devant. ';
      
      if (step.wheelchair_accessible) {
        announcement += 'Procédez avec prudence.';
      } else {
        announcement += 'Cette pente peut être difficile en fauteuil roulant.';
      }
    }
    
    if (announcement) {
      // Prononcer l'annonce
      Speech.speak(announcement, {
        rate: this.config.voiceRate,
        language: this.config.voiceLanguage
      });
      
      // Retour haptique
      if (this.config.useHapticFeedback) {
        this.bluetoothService.sendHapticFeedback(HapticFeedbackType.WARNING, 100);
      }
    }
  }
  
  /**
   * Annoncer l'arrivée à destination
   */
  private announceArrival(): void {
    if (!this.config.useVoiceGuidance) return;
    
    // Prononcer l'annonce
    Speech.speak('Vous êtes arrivé à votre destination.', {
      rate: this.config.voiceRate,
      language: this.config.voiceLanguage
    });
    
    // Retour haptique
    if (this.config.useHapticFeedback) {
      this.bluetoothService.sendHapticFeedback(HapticFeedbackType.SUCCESS, 100);
    }
  }
  
  /**
   * Fournir un retour haptique directionnel amélioré
   */
  private provideDirectionalHapticFeedback(
    maneuver: NavigationStep['maneuver']
  ): void {
    if (!this.config.useHapticFeedback) return;
    
    // Sélectionner le type de retour en fonction de la manœuvre
    let feedbackType: HapticFeedbackType;
    let intensity = 80; // Intensité par défaut
    
    switch (maneuver) {
      case 'turn-left':
        feedbackType = HapticFeedbackType.LEFT_DIRECTION;
        break;
      case 'turn-right':
        feedbackType = HapticFeedbackType.RIGHT_DIRECTION;
        break;
      case 'straight':
        feedbackType = HapticFeedbackType.STRAIGHT_DIRECTION;
        intensity = 60; // Moins intense pour les directions tout droit
        break;
      case 'arrive':
        feedbackType = HapticFeedbackType.SUCCESS;
        intensity = 100; // Intensité maximale pour l'arrivée
        break;
      case 'depart':
        feedbackType = HapticFeedbackType.SHORT;
        intensity = 70;
        break;
      case 'uturn':
        // Pour les demi-tours, envoyer un motif double à gauche
        this.bluetoothService.sendHapticFeedback(HapticFeedbackType.LEFT_DIRECTION, 80);
        setTimeout(() => {
          this.bluetoothService.sendHapticFeedback(HapticFeedbackType.LEFT_DIRECTION, 80);
        }, 500);
        return;
      case 'ramp':
        // Motif spécial pour les rampes
        this.sendSpecialHapticPattern([
          { type: HapticFeedbackType.SHORT, intensity: 60, duration: 200 },
          { type: HapticFeedbackType.MEDIUM, intensity: 70, duration: 300 },
          { type: HapticFeedbackType.LONG, intensity: 80, duration: 200 }
        ]);
        return;
      case 'elevator':
        // Motif spécial pour les ascenseurs
        this.sendSpecialHapticPattern([
          { type: HapticFeedbackType.SHORT, intensity: 60, duration: 200 },
          { type: HapticFeedbackType.SHORT, intensity: 60, duration: 200 },
          { type: HapticFeedbackType.LONG, intensity: 80, duration: 500 }
        ]);
        return;
      default:
        feedbackType = HapticFeedbackType.MEDIUM;
        intensity = 70;
    }
    
    // Envoyer le retour haptique
    this.bluetoothService.sendHapticFeedback(feedbackType, intensity);
  }
  
  /**
   * Envoyer un motif haptique spécial pour les manœuvres complexes
   */
  private async sendSpecialHapticPattern(
    pattern: Array<{ type: HapticFeedbackType, intensity: number, duration: number }>
  ): Promise<void> {
    for (const item of pattern) {
      await this.bluetoothService.sendHapticFeedback(item.type, item.intensity);
      await new Promise(resolve => setTimeout(resolve, item.duration));
    }
  }
  
  /**
   * Fournir un retour de navigation basé sur la distance au virage
   */
  private provideNavigationFeedback(distance: number, step: NavigationStep): void {
    if (!this.config.useHapticFeedback) return;
    
    // Fournir un retour uniquement pour les virages
    if (step.maneuver !== 'turn-left' && 
        step.maneuver !== 'turn-right' && 
        step.maneuver !== 'uturn') {
      return;
    }
    
    // Fournir un retour uniquement à certains seuils de distance
    if (distance <= 50 && distance > 30) {
      // Approche du virage - retour léger
      const now = Date.now();
      if (now > this.nextHapticFeedbackTime) {
        this.bluetoothService.sendHapticFeedback(HapticFeedbackType.SHORT, 40);
        this.nextHapticFeedbackTime = now + this.config.hapticFeedbackInterval;
      }
    } else if (distance <= 30 && distance > 10) {
      // Se rapproche - retour moyen
      const now = Date.now();
      if (now > this.nextHapticFeedbackTime) {
        this.bluetoothService.sendHapticFeedback(HapticFeedbackType.MEDIUM, 60);
        this.nextHapticFeedbackTime = now + this.config.hapticFeedbackInterval;
      }
    } else if (distance <= 10) {
      // Très proche - retour directionnel fort
      const now = Date.now();
      if (now > this.nextHapticFeedbackTime) {
        this.provideDirectionalHapticFeedback(step.maneuver);
        this.nextHapticFeedbackTime = now + this.config.hapticFeedbackInterval;
      }
    }
  }
  
  /**
   * Vérifier si l'utilisateur est hors de l'itinéraire prévu
   */
  private checkIfOffRoute(location: Coordinate, currentStepIndex: number): void {
    if (!this.currentRoute || !this.isNavigating) return;
    
    // Vérifier la distance à l'étape actuelle
    // C'est une version simplifiée - dans une application réelle, nous vérifierions la distance à la polyline
    
    const currentStep = this.currentRoute.steps[currentStepIndex];
    const nextStep = currentStepIndex < this.currentRoute.steps.length - 1 ? 
                    this.currentRoute.steps[currentStepIndex + 1] : null;
    
    // Calculer la distance à l'extrémité de l'étape actuelle
    const distanceToCurrentStep = NavigationService.calculateDistance(location, currentStep.coordinate);
    
    // Calculer la distance à l'extrémité de l'étape suivante (si disponible)
    const distanceToNextStep = nextStep ? 
                              NavigationService.calculateDistance(location, nextStep.coordinate) : 
                              Infinity;
    
    // Si nous sommes trop loin des deux points, nous sommes peut-être hors itinéraire
    if (distanceToCurrentStep > this.config.detourAlertThreshold && 
        distanceToNextStep > this.config.detourAlertThreshold) {
      
      // Éviter les alertes répétées
      const now = Date.now();
      if (now > this.nextHapticFeedbackTime) {
        // Alerter l'utilisateur
        if (this.config.useVoiceGuidance) {
          Speech.speak('Vous semblez être hors itinéraire. Recalcul en cours...', {
            rate: this.config.voiceRate,
            language: this.config.voiceLanguage
          });
        }
        
        if (this.config.useHapticFeedback) {
          this.bluetoothService.sendHapticFeedback(HapticFeedbackType.WARNING, 100);
        }
        
        this.nextHapticFeedbackTime = now + 10000; // Ne pas alerter à nouveau pendant 10 secondes
        
        // Recalculer l'itinéraire
        this.recalculateRoute(location);
      }
    }
  }
  
  /**
   * Recalculer l'itinéraire à partir de la position actuelle
   */
  private async recalculateRoute(currentLocation: Coordinate): Promise<void> {
    if (!this.currentRoute || !this.isNavigating) return;
    
    try {
      // Obtenir un nouvel itinéraire depuis la position actuelle jusqu'à la destination
      const newRoute = await NavigationService.getRoute(
        currentLocation,
        this.currentRoute.destination,
        'walking',
        this.config.wheelchairMode
      );
      
      if (newRoute) {
        // Mettre à jour l'itinéraire actuel
        this.setCurrentRoute(newRoute);
        
        // Annoncer le nouvel itinéraire
        if (this.config.useVoiceGuidance) {
          Speech.speak('Itinéraire recalculé. Continuez sur le nouvel itinéraire.', {
            rate: this.config.voiceRate,
            language: this.config.voiceLanguage
          });
        }
        
        // Retour haptique
        if (this.config.useHapticFeedback) {
          this.bluetoothService.sendHapticFeedback(HapticFeedbackType.SUCCESS, 80);
        }
      }
    } catch (error) {
      console.error('Erreur lors du recalcul de l\'itinéraire:', error);
      
      // Informer l'utilisateur de l'échec
      if (this.config.useVoiceGuidance) {
        Speech.speak('Impossible de recalculer l\'itinéraire. Essayez de revenir au chemin d\'origine.', {
          rate: this.config.voiceRate,
          language: this.config.voiceLanguage
        });
      }
    }
  }
  
  /**
   * Arrêter la navigation en cours
   */
  public stopNavigation(): void {
    this.isNavigating = false;
    this.setCurrentRoute(null);
    this.stopLocationTracking();
    
    // Informer l'utilisateur
    if (this.config.useVoiceGuidance) {
      Speech.speak('Navigation arrêtée.', {
        rate: this.config.voiceRate,
        language: this.config.voiceLanguage
      });
    }
    
    // Retour haptique
    if (this.config.useHapticFeedback) {
      this.bluetoothService.sendHapticFeedback(HapticFeedbackType.MEDIUM, 60);
    }
  }
}
export default NavigationService;