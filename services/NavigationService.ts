// services/NavigationService.ts
import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import ApiConfig from './ApiConfig';
import * as Location from 'expo-location';

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
}

export interface NavigationStep {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
  maneuver: 'straight' | 'turn-left' | 'turn-right' | 'uturn' | 'arrive' | 'depart';
  coordinate: Coordinate;
}

export interface RouteDetails {
  origin: Coordinate;
  destination: Coordinate;
  distance: number; // total distance in meters
  duration: number; // total duration in seconds
  steps: NavigationStep[];
  polyline?: string; // encoded polyline for the route
}

// Valid transportation modes
export type TransportMode = 'walking' | 'driving' | 'bicycling' | 'transit';

/**
 * Navigation service using Google Maps APIs
 */
export class NavigationService {
  private static instance: NavigationService | null = null;
  private currentRoute: RouteDetails | null = null;
  
  // Create singleton instance
  public static getInstance(): NavigationService {
    if (!this.instance) {
      this.instance = new NavigationService();
    }
    return this.instance;
  }
  
  /**
   * Request location permissions
   */
  public static async requestLocationPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  /**
   * Get the current location
   */
  public static async getCurrentLocation(): Promise<Coordinate | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please grant location permissions to use navigation features'
        );
        return null;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Search for places near a location
   */
  public static async searchPlaces(
    query: string,
    location: Coordinate,
    radius: number = 1500, // Default 1.5km radius
    type?: string // Optional place type (restaurant, hospital, etc.)
  ): Promise<Place[]> {
    try {
      // Build URL parameters
      const params = new URLSearchParams({
        key: ApiConfig.getApiKey(),
        location: `${location.latitude},${location.longitude}`,
        radius: radius.toString(),
        keyword: query,
      });
      
      if (type) {
        params.append('type', type);
      }
      
      // Call Places API
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.PLACES_NEARBY}?${params.toString()}`
      );
      
      const data = await response.json();
      
      if (data.status !== 'OK' || !data.results) {
        console.warn('Places API returned status:', data.status);
        return [];
      }
      
      // Transform results to our format
      return data.results.map((place: any): Place => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        coordinate: {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        },
        types: place.types,
      }));
    } catch (error) {
      console.error('Error searching places:', error);
      return [];
    }
  }

  /**
   * Geocode an address to coordinates
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
        console.warn('Geocoding API returned status:', data.status);
        return null;
      }
      
      const location = data.results[0].geometry.location;
      
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    } catch (error) {
      console.error('Error geocoding address:', error);
      return null;
    }
  }

  /**
   * Get route between two points
   */
  public static async getRoute(
    origin: Coordinate,
    destination: Coordinate,
    mode: TransportMode = 'walking',
    wheelchair: boolean = false
  ): Promise<RouteDetails | null> {
    try {
      // Build URL parameters
      const params = new URLSearchParams({
        key: ApiConfig.getApiKey(),
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        mode: mode,
      });
      
      // Add wheelchair accessibility parameter if needed
      if (wheelchair) {
        params.append('alternatives', 'true'); // Request alternative routes for wheelchair access
      }
      
      // Call Directions API
      const response = await fetch(
        `${ApiConfig.API_ENDPOINTS.MAPS_DIRECTIONS}?${params.toString()}`
      );
      
      const data = await response.json();
      
      if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
        console.warn('Directions API returned status:', data.status);
        return null;
      }
      
      const route = data.routes[0];
      const leg = route.legs[0];
      
      // Transform steps into our format
      const steps: NavigationStep[] = leg.steps.map((step: any) => {
        // Determine maneuver type
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
        
        return {
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
          distance: step.distance.value,
          duration: step.duration.value,
          maneuver,
          coordinate: {
            latitude: step.end_location.lat,
            longitude: step.end_location.lng,
          },
        };
      });
      
      // Add departure and arrival steps
      if (steps.length > 0) {
        steps[0].maneuver = 'depart';
        steps[steps.length - 1].maneuver = 'arrive';
      }
      
      const routeDetails: RouteDetails = {
        origin,
        destination: {
          latitude: leg.end_location.lat,
          longitude: leg.end_location.lng,
        },
        distance: leg.distance.value,
        duration: leg.duration.value,
        steps,
        polyline: route.overview_polyline.points,
      };
      
      return routeDetails;
    } catch (error) {
      console.error('Error getting route:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  public static calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
    
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in meters
  }
  
  /**
   * Calculate bearing (direction) between two coordinates
   * @returns Bearing in degrees (0-360, 0 = North)
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
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    
    return bearing;
  }
  
  // Instance methods for route management
  public getCurrentRoute(): RouteDetails | null {
    return this.currentRoute;
  }
  
  public setCurrentRoute(route: RouteDetails | null): void {
    this.currentRoute = route;
  }
  
  /**
   * Start navigation to a location
   */
  public async startNavigation(
    destination: Coordinate,
    mode: TransportMode = 'walking',
    wheelchair: boolean = false
  ): Promise<RouteDetails | null> {
    try {
      // Get current position
      const currentPosition = await NavigationService.getCurrentLocation();
      if (!currentPosition) {
        throw new Error('Unable to get current location');
      }
      
      // Get route
      const route = await NavigationService.getRoute(
        currentPosition,
        destination,
        mode,
        wheelchair
      );
      
      if (!route) {
        throw new Error('Failed to calculate route');
      }
      
      // Save current route
      this.setCurrentRoute(route);
      
      return route;
    } catch (error) {
      console.error('Error starting navigation:', error);
      throw error;
    }
  }
  
  /**
   * Stop current navigation
   */
  public stopNavigation(): void {
    this.setCurrentRoute(null);
  }
}

/**
 * React hook for using the navigation service
 */
export function useNavigation() {
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [currentRoute, setCurrentRoute] = useState<RouteDetails | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create navigation service instance
  const navigationService = NavigationService.getInstance();
  
  // Get current position
  const getCurrentPosition = useCallback(async (): Promise<Coordinate | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const position = await NavigationService.getCurrentLocation();
      
      if (position) {
        setCurrentPosition(position);
      } else {
        setError('Unable to get current location');
      }
      
      return position;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Initialize location tracking when component mounts
  useEffect(() => {
    let locationSubscription: any = null;
    
    const setupLocationTracking = async () => {
      try {
        // Request permissions
        const hasPermission = await NavigationService.requestLocationPermissions();
        
        if (!hasPermission) {
          setError('Location permission denied');
          return;
        }
        
        // Get initial position
        await getCurrentPosition();
        
        // Start watching position
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            distanceInterval: 5, // Update every 5 meters
          },
          (location) => {
            const newPosition = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            
            setCurrentPosition(newPosition);
            
            // If navigating, check if we've reached the current step
            if (isNavigating && currentRoute && currentStepIndex < currentRoute.steps.length) {
              const currentStep = currentRoute.steps[currentStepIndex];
              const distanceToStep = NavigationService.calculateDistance(
                newPosition,
                currentStep.coordinate
              );
              
              // If within 15 meters of current step, proceed to next step
              if (distanceToStep < 15 && currentStepIndex < currentRoute.steps.length - 1) {
                setCurrentStepIndex(currentStepIndex + 1);
              }
              
              // If we've reached the final destination (within 20 meters)
              if (
                currentStepIndex === currentRoute.steps.length - 1 &&
                distanceToStep < 20
              ) {
                // Navigation completed
                setIsNavigating(false);
                Alert.alert('Arrivé', 'Vous êtes arrivé à destination');
              }
            }
          }
        );
      } catch (err) {
        console.error('Error setting up location tracking:', err);
        setError('Failed to set up location tracking');
      }
    };
    
    setupLocationTracking();
    
    // Cleanup
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [currentStepIndex, currentRoute, isNavigating, getCurrentPosition]);
  
  // Start navigation to a destination
  const startNavigation = useCallback(
    async (
      destinationCoord: Coordinate,
      mode: TransportMode = 'walking',
      wheelchair: boolean = false
    ) => {
      try {
        if (!currentPosition) {
          const position = await getCurrentPosition();
          if (!position) return null;
        }
        
        setIsLoading(true);
        setError(null);
        
        // Use navigation service to start navigation
        const route = await navigationService.startNavigation(
          destinationCoord,
          mode,
          wheelchair
        );
        
        if (!route) {
          setError('Failed to calculate route');
          return null;
        }
        
        setDestination(destinationCoord);
        setCurrentRoute(route);
        setCurrentStepIndex(0);
        setIsNavigating(true);
        
        return route;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [currentPosition, getCurrentPosition, navigationService]
  );
  
  // Stop navigation
  const stopNavigation = useCallback(() => {
    navigationService.stopNavigation();
    setIsNavigating(false);
    setCurrentRoute(null);
    setCurrentStepIndex(0);
  }, [navigationService]);
  
  // Search for places
  const searchPlaces = useCallback(
    async (query: string, location?: Coordinate, radius?: number) => {
      try {
        setIsLoading(true);
        
        const searchLocation = location || currentPosition;
        if (!searchLocation) {
          const position = await getCurrentPosition();
          if (!position) {
            setError('No location available for search');
            return [];
          }
        }
        
        const places = await NavigationService.searchPlaces(
          query,
          searchLocation || currentPosition!,
          radius
        );
        
        return places;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [currentPosition, getCurrentPosition]
  );
  
  // Get the current navigation step
  const getCurrentStep = useCallback(() => {
    if (!currentRoute || !isNavigating) return null;
    return currentRoute.steps[currentStepIndex];
  }, [currentRoute, isNavigating, currentStepIndex]);
  
  // Calculate distance to current step
  const getDistanceToCurrentStep = useCallback(() => {
    if (!currentPosition || !currentRoute || !isNavigating) return Infinity;
    
    const currentStep = currentRoute.steps[currentStepIndex];
    return NavigationService.calculateDistance(currentPosition, currentStep.coordinate);
  }, [currentPosition, currentRoute, isNavigating, currentStepIndex]);
  
  return {
    currentPosition,
    destination,
    currentRoute,
    currentStepIndex,
    isNavigating,
    isLoading,
    error,
    getCurrentPosition,
    startNavigation,
    stopNavigation,
    searchPlaces,
    getCurrentStep,
    getDistanceToCurrentStep,
  };
}

export default NavigationService;