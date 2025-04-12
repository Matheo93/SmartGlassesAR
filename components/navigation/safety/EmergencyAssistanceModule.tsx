// components/safety/EmergencyAssistanceModule.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  Platform,
  Switch,
  Modal,
  ScrollView,
  Linking,
  TextInput,
  Vibration
} from 'react-native';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '../../ui/ThemedText';
import { ThemedView } from '../../ui/ThemedView';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

// Emergency contact interface
interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  relationship?: string;
  isImportant: boolean;
}

// Medical information interface
interface MedicalInfo {
  conditions: string[];
  allergies: string[];
  medications: string[];
  bloodType?: string;
  notes?: string;
}

// Emergency service type
enum EmergencyServiceType {
    POLICE = 'police',
    FIRE = 'fire',
    AMBULANCE = 'ambulance',
    POISON = 'poison', // Ajouter cette entrée manquante
    GENERAL = 'general'
}

// Emergency service interface
interface EmergencyService {
  type: EmergencyServiceType;
  name: string;
  number: string;
  description: string;
}

// Default emergency services by country
const EMERGENCY_SERVICES: Record<string, EmergencyService[]> = {
  'US': [
    {
      type: EmergencyServiceType.GENERAL,
      name: 'Emergency Services',
      number: '911',
      description: 'General emergency number for police, fire, and medical emergencies'
    },
    {
      type: EmergencyServiceType.POISON,
      name: 'Poison Control',
      number: '1-800-222-1222',
      description: 'National poison control center'
    }
  ],
  'FR': [
    {
      type: EmergencyServiceType.GENERAL,
      name: 'Emergency Services',
      number: '112',
      description: 'European emergency number'
    },
    {
      type: EmergencyServiceType.AMBULANCE,
      name: 'SAMU (Medical)',
      number: '15',
      description: 'Medical emergency services'
    },
    {
      type: EmergencyServiceType.POLICE,
      name: 'Police',
      number: '17',
      description: 'Police emergency'
    },
    {
      type: EmergencyServiceType.FIRE,
      name: 'Pompiers (Fire)',
      number: '18',
      description: 'Fire department and rescue'
    }
  ]
};

// Component props
interface EmergencyAssistanceModuleProps {
  onClose?: () => void;
}

export const EmergencyAssistanceModule: React.FC<EmergencyAssistanceModuleProps> = ({
  onClose
}) => {
  // State
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [medicalInfo, setMedicalInfo] = useState<MedicalInfo>({
    conditions: [],
    allergies: [],
    medications: []
  });
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [countryCode, setCountryCode] = useState<string>('US');
  const [emergencyServices, setEmergencyServices] = useState<EmergencyService[]>([]);
  
  // Modal states
  const [addContactModalVisible, setAddContactModalVisible] = useState(false);
  const [editMedicalInfoModalVisible, setEditMedicalInfoModalVisible] = useState(false);
  const [emergencyHelpModalVisible, setEmergencyHelpModalVisible] = useState(false);
  const [confirmCallModalVisible, setConfirmCallModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<EmergencyService | null>(null);
  
  // SOS state
  const [isSosActive, setIsSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [sosMessage, setSosMessage] = useState('I need help. This is an emergency.');
  
  // Contact form state
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelationship, setNewContactRelationship] = useState('');
  const [newContactImportant, setNewContactImportant] = useState(false);
  
  // Medical info form state
  const [newCondition, setNewCondition] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  
  // Settings
  const [autoShareLocationWithContacts, setAutoShareLocationWithContacts] = useState(true);
  const [enableVoiceActivatedSos, setEnableVoiceActivatedSos] = useState(true);
  const [useLoudAlarm, setUseLoudAlarm] = useState(true);
  
  // Refs
  const sosTimerRef = useRef<NodeJS.Timeout | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const formatContact = (contact: Contacts.Contact) => {
    // ...
  }
  
  // Load data on mount
  useEffect(() => {
    loadEmergencyContacts();
    loadMedicalInfo();
    getCurrentLocationInfo();
    
    return () => {
      // Clean up
      if (sosTimerRef.current) {
        clearInterval(sosTimerRef.current);
      }
      
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
      }
      
      // Stop any ongoing speech
      // Correction : vérifier l'état de la parole de manière asynchrone
      const stopSpeech = async () => {
        const isSpeaking = await Speech.isSpeakingAsync();
        if (isSpeaking) {
          Speech.stop();
        }
      };
      
      stopSpeech();
    };
  }, []);
  
  // Update emergency services when country code changes
  useEffect(() => {
    if (countryCode && EMERGENCY_SERVICES[countryCode]) {
      setEmergencyServices(EMERGENCY_SERVICES[countryCode]);
    } else {
      // Default to US if country not found
      setEmergencyServices(EMERGENCY_SERVICES['US']);
    }
  }, [countryCode]);
  
  // Handle SOS countdown
  useEffect(() => {
    if (isSosActive && sosCountdown > 0) {
      // Vibrate with pattern
      if (Platform.OS !== 'web') {
        Vibration.vibrate(500);
      }
      
      // Sound warning
      Speech.speak(`Emergency in ${sosCountdown}`, { rate: 1.2 });
      
      sosTimerRef.current = setTimeout(() => {
        setSosCountdown(sosCountdown - 1);
      }, 1000);
    } else if (isSosActive && sosCountdown === 0) {
      // Trigger emergency actions
      triggerEmergencyActions();
    }
    
    return () => {
      if (sosTimerRef.current) {
        clearTimeout(sosTimerRef.current);
      }
    };
  }, [isSosActive, sosCountdown]);
  
  // Load emergency contacts from storage
  const loadEmergencyContacts = async () => {
    try {
      const contactsJson = await AsyncStorage.getItem('emergency_contacts');
      if (contactsJson) {
        setEmergencyContacts(JSON.parse(contactsJson));
      } else {
        // If no contacts are saved, check if we can access contact permissions
        requestContactsPermission();
      }
    } catch (error) {
      console.error('Error loading emergency contacts:', error);
    }
  };
  
  // Request permission to access contacts
  const requestContactsPermission = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        // Permission granted, could suggest importing contacts
        Alert.alert(
          'Import Contacts',
          'Would you like to import contacts from your address book?',
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Import', onPress: importContactsFromAddressBook }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
    }
  };
  
  // Import contacts from address book
  const importContactsFromAddressBook = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers]
      });
      
      if (data.length > 0) {
        // Show contact picker or just take first few contacts for demo
        const importedContacts: EmergencyContact[] = data
          .slice(0, 3) // Just take first 3 contacts for demo
          .filter(contact => contact.name && contact.phoneNumbers && contact.phoneNumbers.length > 0)
          .map(contact => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: contact.name || 'Unknown',
            phoneNumber: contact.phoneNumbers![0].number || '',
            isImportant: false
          }));
        
        setEmergencyContacts(importedContacts);
        saveEmergencyContacts(importedContacts);
      }
    } catch (error) {
      console.error('Error importing contacts:', error);
      Alert.alert('Error', 'Failed to import contacts');
    }
  };
  
  // Save emergency contacts to storage
  const saveEmergencyContacts = async (contacts: EmergencyContact[]) => {
    try {
      await AsyncStorage.setItem('emergency_contacts', JSON.stringify(contacts));
    } catch (error) {
      console.error('Error saving emergency contacts:', error);
    }
  };
  
  // Load medical info from storage
  const loadMedicalInfo = async () => {
    try {
      const medicalInfoJson = await AsyncStorage.getItem('medical_info');
      if (medicalInfoJson) {
        setMedicalInfo(JSON.parse(medicalInfoJson));
        
        // Set form fields
        const info = JSON.parse(medicalInfoJson) as MedicalInfo;
        setBloodType(info.bloodType || '');
        setMedicalNotes(info.notes || '');
      }
    } catch (error) {
      console.error('Error loading medical info:', error);
    }
  };
  
  // Save medical info to storage
  const saveMedicalInfo = async (info: MedicalInfo) => {
    try {
      await AsyncStorage.setItem('medical_info', JSON.stringify(info));
    } catch (error) {
      console.error('Error saving medical info:', error);
    }
  };
  
  // Get current location and country
  const getCurrentLocationInfo = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is needed for emergency services'
        );
        return;
      }
      
      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest
      });
      
      setCurrentLocation(location);
      
      // Start watching position for real-time updates
      locationWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10, // Update every 10 meters
        },
        (newLocation) => {
          setCurrentLocation(newLocation);
        }
      );
      
      // Reverse geocode to get country
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (geocode.length > 0 && geocode[0].isoCountryCode) {
        setCountryCode(geocode[0].isoCountryCode);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };
  
  // Add a new emergency contact
  const addEmergencyContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      Alert.alert('Error', 'Name and phone number are required');
      return;
    }
    
    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: newContactName.trim(),
      phoneNumber: newContactPhone.trim(),
      relationship: newContactRelationship.trim() || undefined,
      isImportant: newContactImportant
    };
    
    const updatedContacts = [...emergencyContacts, newContact];
    setEmergencyContacts(updatedContacts);
    saveEmergencyContacts(updatedContacts);
    
    // Reset form
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRelationship('');
    setNewContactImportant(false);
    setAddContactModalVisible(false);
  };
  
  // Remove an emergency contact
  const removeEmergencyContact = (id: string) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedContacts = emergencyContacts.filter(contact => contact.id !== id);
            setEmergencyContacts(updatedContacts);
            saveEmergencyContacts(updatedContacts);
          }
        }
      ]
    );
  };
  
  // Update medical information
  const updateMedicalInfo = () => {
    const updatedInfo: MedicalInfo = {
      ...medicalInfo,
      bloodType: bloodType || undefined,
      notes: medicalNotes || undefined
    };
    
    setMedicalInfo(updatedInfo);
    saveMedicalInfo(updatedInfo);
    setEditMedicalInfoModalVisible(false);
  };
  
  // Add medical condition
  const addMedicalCondition = () => {
    if (!newCondition.trim()) return;
    
    const updatedConditions = [...medicalInfo.conditions, newCondition.trim()];
    const updatedInfo = { ...medicalInfo, conditions: updatedConditions };
    
    setMedicalInfo(updatedInfo);
    saveMedicalInfo(updatedInfo);
    setNewCondition('');
  };
  
  // Add allergy
  const addAllergy = () => {
    if (!newAllergy.trim()) return;
    
    const updatedAllergies = [...medicalInfo.allergies, newAllergy.trim()];
    const updatedInfo = { ...medicalInfo, allergies: updatedAllergies };
    
    setMedicalInfo(updatedInfo);
    saveMedicalInfo(updatedInfo);
    setNewAllergy('');
  };
  
  // Add medication
  const addMedication = () => {
    if (!newMedication.trim()) return;
    
    const updatedMedications = [...medicalInfo.medications, newMedication.trim()];
    const updatedInfo = { ...medicalInfo, medications: updatedMedications };
    
    setMedicalInfo(updatedInfo);
    saveMedicalInfo(updatedInfo);
    setNewMedication('');
  };
  
  // Remove medical item (condition, allergy, or medication)
  const removeMedicalItem = (category: 'conditions' | 'allergies' | 'medications', index: number) => {
    const updatedItems = [...medicalInfo[category]];
    updatedItems.splice(index, 1);
    
    const updatedInfo = { ...medicalInfo, [category]: updatedItems };
    setMedicalInfo(updatedInfo);
    saveMedicalInfo(updatedInfo);
  };
  
  // Trigger SOS mode
  const triggerSos = () => {
    if (isSosActive) {
      // Cancel SOS
      setIsSosActive(false);
      setSosCountdown(5);
      
      // Stop vibration
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }
      
      // Haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Announce cancellation
      Speech.speak('Emergency canceled');
    } else {
      // Start SOS countdown
      setIsSosActive(true);
      setSosCountdown(5);
      
      // Haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }
  };
  
  // Trigger emergency actions when SOS countdown completes
  const triggerEmergencyActions = () => {
    // Play loud alarm if enabled
    if (useLoudAlarm) {
      // In a real implementation, we would play a loud sound here
      // For demo, we'll use speech synthesis
      Speech.speak('EMERGENCY! EMERGENCY! EMERGENCY!', {
        rate: 1.2,
        pitch: 1.5,
        volume: 1.0
      });
    }
    
    // Notify emergency contacts
    if (emergencyContacts.length > 0) {
      notifyEmergencyContacts();
    }
    
    // Show emergency help options
    setEmergencyHelpModalVisible(true);
  };
  
  // Notify emergency contacts via SMS/call
  const notifyEmergencyContacts = () => {
    // For demo purposes, we'll just log the contacts we would notify
    console.log('Notifying emergency contacts:', emergencyContacts);
    
    // In a real app, we would send SMS or make calls here
    // For now, we'll show a mock message
    Alert.alert(
      'Emergency Contacts Notified',
      `${emergencyContacts.length} contacts have been notified of your emergency.`,
      [{ text: 'OK' }]
    );
  };
  
  // Call emergency service
  const callEmergencyService = (service: EmergencyService) => {
    setSelectedService(service);
    setConfirmCallModalVisible(true);
  };
  
  // Confirm and make emergency call
  const confirmEmergencyCall = () => {
    if (!selectedService) return;
    
    const phoneNumber = selectedService.number;
    const url = `tel:${phoneNumber}`;
    
    // Reset SOS state
    setIsSosActive(false);
    setSosCountdown(5);
    setConfirmCallModalVisible(false);
    setEmergencyHelpModalVisible(false);
    
    // Make the call
    Linking.canOpenURL(url)
      .then(supported => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('Error', `Cannot call ${phoneNumber}`);
        }
      })
      .catch(error => {
        console.error('Error making call:', error);
        Alert.alert('Error', 'Failed to make emergency call');
      });
  };
  
  // Get formatted location string
  const getFormattedLocation = () => {
    if (!currentLocation) return 'Unknown location';
    
    const { latitude, longitude } = currentLocation.coords;
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  };
  
  // Generate shareable medical information
  const generateMedicalInfoText = () => {
    let info = '--- MEDICAL INFORMATION ---\n\n';
    
    if (medicalInfo.conditions.length > 0) {
      info += 'Medical Conditions:\n';
      medicalInfo.conditions.forEach(condition => {
        info += `- ${condition}\n`;
      });
      info += '\n';
    }
    
    if (medicalInfo.allergies.length > 0) {
      info += 'Allergies:\n';
      medicalInfo.allergies.forEach(allergy => {
        info += `- ${allergy}\n`;
      });
      info += '\n';
    }
    
    if (medicalInfo.medications.length > 0) {
      info += 'Medications:\n';
      medicalInfo.medications.forEach(medication => {
        info += `- ${medication}\n`;
      });
      info += '\n';
    }
    
    if (medicalInfo.bloodType) {
      info += `Blood Type: ${medicalInfo.bloodType}\n\n`;
    }
    
    if (medicalInfo.notes) {
      info += `Additional Notes:\n${medicalInfo.notes}\n\n`;
    }
    
    return info;
  };
  
  // Share medical information
  const shareMedicalInfo = () => {
    const medicalInfoText = generateMedicalInfoText();
    
    // In a real app, we would use Share API here
    // For demo, we'll just show the info
    Alert.alert('Medical Information', medicalInfoText, [
      { text: 'Copy to Clipboard', onPress: () => {/* Would copy to clipboard */} },
      { text: 'Close' }
    ]);
  };
  
  // Render emergency contact item
  const renderEmergencyContactItem = (contact: EmergencyContact) => {
    return (
      <View key={contact.id} style={styles.contactItem}>
        <View style={styles.contactIconContainer}>
          <Ionicons
            name={contact.isImportant ? "star" : "person"}
            size={24}
            color={contact.isImportant ? "#FFD700" : "#2196F3"}
          />
        </View>
        
        <View style={styles.contactInfo}>
          <ThemedText style={styles.contactName}>{contact.name}</ThemedText>
          <ThemedText style={styles.contactPhone}>{contact.phoneNumber}</ThemedText>
          {contact.relationship && (
            <ThemedText style={styles.contactRelationship}>{contact.relationship}</ThemedText>
          )}
        </View>
        
        <View style={styles.contactActions}>
          <TouchableOpacity
            style={styles.contactActionButton}
            onPress={() => {
              Linking.openURL(`tel:${contact.phoneNumber}`);
            }}
          >
            <Ionicons name="call-outline" size={20} color="#4CAF50" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.contactActionButton}
            onPress={() => removeEmergencyContact(contact.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // Render emergency service item
  const renderEmergencyServiceItem = (service: EmergencyService) => {
    return (
      <TouchableOpacity
        key={service.name}
        style={styles.serviceItem}
        onPress={() => callEmergencyService(service)}
      >
        <View style={[
          styles.serviceIconContainer,
          {
            backgroundColor:
              service.type === EmergencyServiceType.AMBULANCE ? '#E57373' :
              service.type === EmergencyServiceType.POLICE ? '#64B5F6' :
              service.type === EmergencyServiceType.FIRE ? '#FFB74D' : '#9575CD'
          }
        ]}>
          <Ionicons
            name={
              service.type === EmergencyServiceType.AMBULANCE ? "medkit" :
              service.type === EmergencyServiceType.POLICE ? "shield" :
              service.type === EmergencyServiceType.FIRE ? "flame" : "call"
            }
            size={24}
            color="white"
          />
        </View>
        
        <View style={styles.serviceInfo}>
          <ThemedText style={styles.serviceName}>{service.name}</ThemedText>
          <ThemedText style={styles.serviceNumber}>{service.number}</ThemedText>
          <ThemedText style={styles.serviceDescription}>{service.description}</ThemedText>
        </View>
      </TouchableOpacity>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Emergency Assistance</ThemedText>
        
        {/* Current location indicator */}
        {currentLocation && (
          <TouchableOpacity style={styles.locationButton}>
            <Ionicons name="location" size={16} color="#4CAF50" />
            <ThemedText style={styles.locationButtonText}>
              Location Available
            </ThemedText>
          </TouchableOpacity>
        )}
        
        {/* Close button */}
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollView style={styles.content}>
        {/* SOS button */}
        <View style={styles.sosSection}>
          <TouchableOpacity
            style={[
              styles.sosButton,
              isSosActive && styles.sosActiveButton
            ]}
            onPress={triggerSos}
          >
            <ThemedText style={styles.sosButtonText}>
              {isSosActive ? `CANCEL (${sosCountdown})` : 'SOS'}
            </ThemedText>
          </TouchableOpacity>
          
          <ThemedText style={styles.sosInstructions}>
            {isSosActive 
              ? 'Tap to cancel emergency alert' 
              : 'Tap and hold for emergency assistance'}
          </ThemedText>
        </View>
        
        {/* Emergency services */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Emergency Services</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              {countryCode} - {getFormattedLocation()}
            </ThemedText>
          </View>
          
          <View style={styles.sectionContent}>
            {emergencyServices.map(service => renderEmergencyServiceItem(service))}
          </View>
        </View>
        
        {/* Emergency contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Emergency Contacts</ThemedText>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setAddContactModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="#2196F3" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.sectionContent}>
            {emergencyContacts.length === 0 ? (
              <ThemedText style={styles.emptyStateText}>
                No emergency contacts added yet
              </ThemedText>
            ) : (
              emergencyContacts.map(contact => renderEmergencyContactItem(contact))
            )}
          </View>
        </View>
        
        {/* Medical information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Medical Information</ThemedText>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setEditMedicalInfoModalVisible(true)}
            >
              <Ionicons name="pencil" size={20} color="#2196F3" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.sectionContent}>
            {/* Medical conditions */}
            <View style={styles.medicalCategory}>
              <ThemedText style={styles.medicalCategoryTitle}>Medical Conditions</ThemedText>
              {medicalInfo.conditions.length === 0 ? (
                <ThemedText style={styles.emptyStateText}>
                  No medical conditions added
                </ThemedText>
              ) : (
                <View style={styles.medicalItemsList}>
                  {medicalInfo.conditions.map((condition, index) => (
                    <View key={index} style={styles.medicalItem}>
                      <ThemedText style={styles.medicalItemText}>{condition}</ThemedText>
                      <TouchableOpacity
                        style={styles.removeMedicalItemButton}
                        onPress={() => removeMedicalItem('conditions', index)}
                      >
                        <Ionicons name="close" size={16} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
            
            {/* Allergies */}
            <View style={styles.medicalCategory}>
              <ThemedText style={styles.medicalCategoryTitle}>Allergies</ThemedText>
              {medicalInfo.allergies.length === 0 ? (
                <ThemedText style={styles.emptyStateText}>
                  No allergies added
                </ThemedText>
              ) : (
                <View style={styles.medicalItemsList}>
                  {medicalInfo.allergies.map((allergy, index) => (
                    <View key={index} style={styles.medicalItem}>
                      <ThemedText style={styles.medicalItemText}>{allergy}</ThemedText>
                      <TouchableOpacity
                        style={styles.removeMedicalItemButton}
                        onPress={() => removeMedicalItem('allergies', index)}
                      >
                        <Ionicons name="close" size={16} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
            
            {/* Medications */}
            <View style={styles.medicalCategory}>
              <ThemedText style={styles.medicalCategoryTitle}>Medications</ThemedText>
              {medicalInfo.medications.length === 0 ? (
                <ThemedText style={styles.emptyStateText}>
                  No medications added
                </ThemedText>
              ) : (
                <View style={styles.medicalItemsList}>
                  {medicalInfo.medications.map((medication, index) => (
                    <View key={index} style={styles.medicalItem}>
                      <ThemedText style={styles.medicalItemText}>{medication}</ThemedText>
                      <TouchableOpacity
                        style={styles.removeMedicalItemButton}
                        onPress={() => removeMedicalItem('medications', index)}
                      >
                        <Ionicons name="close" size={16} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
            
            {/* Blood type and notes */}
            <View style={styles.medicalCategory}>
              <View style={styles.medicalGeneralInfo}>
                <ThemedText style={styles.medicalCategoryTitle}>General Info</ThemedText>
                <View style={styles.medicalGeneralInfoItem}>
                  <ThemedText style={styles.medicalGeneralInfoLabel}>Blood Type:</ThemedText>
                  <ThemedText style={styles.medicalGeneralInfoValue}>
                    {medicalInfo.bloodType || 'Not specified'}
                  </ThemedText>
                </View>
                
                {medicalInfo.notes && (
                  <View style={styles.medicalGeneralInfoItem}>
                    <ThemedText style={styles.medicalGeneralInfoLabel}>Notes:</ThemedText>
                    <ThemedText style={styles.medicalGeneralInfoValue}>
                      {medicalInfo.notes}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
            
            {/* Share medical info button */}
            <TouchableOpacity
              style={styles.shareMedicalInfoButton}
              onPress={shareMedicalInfo}
            >
              <Ionicons name="share-outline" size={20} color="white" />
              <ThemedText style={styles.shareMedicalInfoButtonText}>
                Share Medical Information
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Settings</ThemedText>
          </View>
          
          <View style={styles.sectionContent}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="location" size={20} color="#2196F3" />
                <ThemedText style={styles.settingLabel}>
                  Auto-share location with contacts
                </ThemedText>
              </View>
              <Switch
                value={autoShareLocationWithContacts}
                onValueChange={setAutoShareLocationWithContacts}
                trackColor={{ false: '#767577', true: '#81D4FA' }}
                thumbColor={autoShareLocationWithContacts ? '#2196F3' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="mic" size={20} color="#2196F3" />
                <ThemedText style={styles.settingLabel}>
                  Enable voice-activated SOS
                </ThemedText>
              </View>
              <Switch
                value={enableVoiceActivatedSos}
                onValueChange={setEnableVoiceActivatedSos}
                trackColor={{ false: '#767577', true: '#81D4FA' }}
                thumbColor={enableVoiceActivatedSos ? '#2196F3' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="volume-high" size={20} color="#2196F3" />
                <ThemedText style={styles.settingLabel}>
                  Use loud alarm in emergency
                </ThemedText>
              </View>
              <Switch
                value={useLoudAlarm}
                onValueChange={setUseLoudAlarm}
                trackColor={{ false: '#767577', true: '#81D4FA' }}
                thumbColor={useLoudAlarm ? '#2196F3' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Ionicons name="text" size={20} color="#2196F3" />
                <ThemedText style={styles.settingLabel}>
                  SOS Message
                </ThemedText>
              </View>
            </View>
            
            <TextInput
              style={styles.sosMessageInput}
              value={sosMessage}
              onChangeText={setSosMessage}
              placeholder="Enter emergency message"
              multiline
              numberOfLines={2}
            />
          </View>
        </View>
      </ScrollView>
      
      {/* Add Contact Modal */}
      <Modal
        visible={addContactModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddContactModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Add Emergency Contact</ThemedText>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setAddContactModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#777" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Name</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={newContactName}
                  onChangeText={setNewContactName}
                  placeholder="Enter name"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Phone Number</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={newContactPhone}
                  onChangeText={setNewContactPhone}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Relationship (Optional)</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={newContactRelationship}
                  onChangeText={setNewContactRelationship}
                  placeholder="E.g., Parent, Spouse, Friend"
                />
              </View>
              
              <View style={styles.switchGroup}>
                <ThemedText style={styles.switchLabel}>Mark as important contact</ThemedText>
                <Switch
                  value={newContactImportant}
                  onValueChange={setNewContactImportant}
                  trackColor={{ false: '#767577', true: '#81D4FA' }}
                  thumbColor={newContactImportant ? '#2196F3' : '#f4f3f4'}
                />
              </View>
              
              <TouchableOpacity
                style={styles.addContactButton}
                onPress={addEmergencyContact}
              >
                <ThemedText style={styles.addContactButtonText}>Add Contact</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Edit Medical Info Modal */}
      <Modal
        visible={editMedicalInfoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditMedicalInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Edit Medical Information</ThemedText>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditMedicalInfoModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#777" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {/* Medical conditions */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Add Medical Condition</ThemedText>
                <View style={styles.inlineInputGroup}>
                  <TextInput
                    style={styles.inlineTextInput}
                    value={newCondition}
                    onChangeText={setNewCondition}
                    placeholder="E.g., Diabetes, Asthma"
                  />
                  <TouchableOpacity
                    style={styles.inlineButton}
                    onPress={addMedicalCondition}
                  >
                    <Ionicons name="add" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Allergies */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Add Allergy</ThemedText>
                <View style={styles.inlineInputGroup}>
                  <TextInput
                    style={styles.inlineTextInput}
                    value={newAllergy}
                    onChangeText={setNewAllergy}
                    placeholder="E.g., Peanuts, Penicillin"
                  />
                  <TouchableOpacity
                    style={styles.inlineButton}
                    onPress={addAllergy}
                  >
                    <Ionicons name="add" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Medications */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Add Medication</ThemedText>
                <View style={styles.inlineInputGroup}>
                  <TextInput
                    style={styles.inlineTextInput}
                    value={newMedication}
                    onChangeText={setNewMedication}
                    placeholder="E.g., Insulin, Ventolin"
                  />
                  <TouchableOpacity
                    style={styles.inlineButton}
                    onPress={addMedication}
                  >
                    <Ionicons name="add" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Blood type */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Blood Type</ThemedText>
                <TextInput
                  style={styles.textInput}
                  value={bloodType}
                  onChangeText={setBloodType}
                  placeholder="E.g., A+, O-, AB+"
                />
              </View>
              
              {/* Notes */}
              <View style={styles.inputGroup}>
                <ThemedText style={styles.inputLabel}>Additional Medical Notes</ThemedText>
                <TextInput
                  style={styles.textAreaInput}
                  value={medicalNotes}
                  onChangeText={setMedicalNotes}
                  placeholder="Enter any additional medical information here"
                  multiline
                  numberOfLines={4}
                />
              </View>
              
              <TouchableOpacity
                style={styles.updateMedicalInfoButton}
                onPress={updateMedicalInfo}
              >
                <ThemedText style={styles.updateMedicalInfoButtonText}>
                  Save Medical Information
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Emergency Help Modal */}
      <Modal
        visible={emergencyHelpModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmergencyHelpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, styles.emergencyModalContainer]}>
            <View style={styles.emergencyModalHeader}>
              <ThemedText style={styles.emergencyModalTitle}>
                Emergency Assistance
              </ThemedText>
            </View>
            
            <ScrollView style={styles.emergencyModalContent}>
              <ThemedText style={styles.emergencyInstructions}>
                Select an emergency service to call:
              </ThemedText>
              
              {emergencyServices.map(service => (
                <TouchableOpacity
                  key={service.name}
                  style={styles.emergencyServiceButton}
                  onPress={() => callEmergencyService(service)}
                >
                  <Ionicons
                    name={
                      service.type === EmergencyServiceType.AMBULANCE ? "medkit" :
                      service.type === EmergencyServiceType.POLICE ? "shield" :
                      service.type === EmergencyServiceType.FIRE ? "flame" : "call"
                    }
                    size={24}
                    color="white"
                  />
                  <ThemedText style={styles.emergencyServiceButtonText}>
                    {service.name} - {service.number}
                  </ThemedText>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={styles.cancelEmergencyButton}
                onPress={() => {
                  setEmergencyHelpModalVisible(false);
                  setIsSosActive(false);
                  setSosCountdown(5);
                }}
              >
                <ThemedText style={styles.cancelEmergencyButtonText}>
                  Cancel Emergency
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Confirm Call Modal */}
      <Modal
        visible={confirmCallModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmCallModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <ThemedText style={styles.confirmModalTitle}>
              Confirm Emergency Call
            </ThemedText>
            
            <ThemedText style={styles.confirmModalText}>
              Are you sure you want to call:
            </ThemedText>
            
            <ThemedText style={styles.confirmModalService}>
              {selectedService?.name} - {selectedService?.number}
            </ThemedText>
            
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={styles.confirmModalCancelButton}
                onPress={() => setConfirmCallModalVisible(false)}
              >
                <ThemedText style={styles.confirmModalCancelButtonText}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmModalCallButton}
                onPress={confirmEmergencyCall}
              >
                <ThemedText style={styles.confirmModalCallButtonText}>
                  Call Now
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 10,
  },
  locationButtonText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
  },
  closeButton: {
    padding: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sosSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sosButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sosActiveButton: {
    backgroundColor: '#FFA000',
  },
  sosButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 24,
  },
  sosInstructions: {
    marginTop: 10,
    color: '#757575',
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#757575',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContent: {
    padding: 15,
  },
  serviceItem: {
    flexDirection: 'row',
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
  },
  serviceIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  serviceNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2196F3',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#757575',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
  },
  contactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactPhone: {
    fontSize: 14,
    color: '#2196F3',
  },
  contactRelationship: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
  },
  contactActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emptyStateText: {
    color: '#9E9E9E',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 10,
  },
  medicalCategory: {
    marginBottom: 15,
  },
  medicalCategoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  medicalItemsList: {
    marginBottom: 10,
  },
  medicalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
    padding: 10,
    marginBottom: 5,
  },
  medicalItemText: {
    flex: 1,
  },
  removeMedicalItemButton: {
    padding: 5,
  },
  medicalGeneralInfo: {
    marginBottom: 10,
  },
  medicalGeneralInfoItem: {
    marginTop: 5,
    marginBottom: 5,
  },
  medicalGeneralInfoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#757575',
  },
  medicalGeneralInfoValue: {
    fontSize: 14,
    marginTop: 2,
  },
  shareMedicalInfoButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    borderRadius: 5,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  shareMedicalInfoButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    marginLeft: 10,
  },
  sosMessageInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
    padding: 10,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalContent: {
    padding: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
    padding: 10,
    fontSize: 14,
  },
  textAreaInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
    padding: 10,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inlineInputGroup: {
    flexDirection: 'row',
  },
  inlineTextInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
    padding: 10,
    fontSize: 14,
    marginRight: 10,
  },
  inlineButton: {
    width: 40,
    height: 40,
    borderRadius: 5,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 14,
  },
  addContactButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
  },
  addContactButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  updateMedicalInfoButton: {
    backgroundColor: '#2196F3',
    borderRadius: 5,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  updateMedicalInfoButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emergencyModalContainer: {
    backgroundColor: '#FFEBEE',
  },
  emergencyModalHeader: {
    backgroundColor: '#F44336',
    padding: 15,
  },
  emergencyModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  emergencyModalContent: {
    padding: 15,
  },
  emergencyInstructions: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  emergencyServiceButton: {
    flexDirection: 'row',
    backgroundColor: '#F44336',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  emergencyServiceButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  cancelEmergencyButton: {
    backgroundColor: '#9E9E9E',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  cancelEmergencyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  confirmModalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#F44336',
  },
  confirmModalText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmModalService: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmModalCancelButton: {
    flex: 1,
    backgroundColor: '#9E9E9E',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginRight: 10,
  },
  confirmModalCancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  confirmModalCallButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginLeft: 10,
  },
  confirmModalCallButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default EmergencyAssistanceModule;