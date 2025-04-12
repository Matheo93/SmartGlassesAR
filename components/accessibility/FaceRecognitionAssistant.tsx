// components/accessibility/FaceRecognitionAssistant.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  Switch
} from 'react-native';
import { useCameraPermissions, CameraView, CameraType } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import ApiConfig from '../../services/ApiConfig';

// Known person interface
interface Person {
  id: string;
  name: string;
  relation: string;
  notes?: string;
  imageUri?: string;
  lastSeen?: Date;
  faceEncoding?: number[]; // Face recognition data
}

// Recognition result interface
interface RecognitionResult {
  person?: Person;
  confidence: number;
  timestamp: Date;
  location: { x: number; y: number; width: number; height: number };
  newFace: boolean;
}

// Component props
interface FaceRecognitionAssistantProps {
  onClose?: () => void;
}

export const FaceRecognitionAssistant: React.FC<FaceRecognitionAssistantProps> = ({
  onClose
}) => {
  // Camera state
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  // Recognition state
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionResults, setRecognitionResults] = useState<RecognitionResult[]>([]);
  const [recognitionHistory, setRecognitionHistory] = useState<RecognitionResult[]>([]);
  
  // Known people state
  const [knownPeople, setKnownPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  
  // UI state
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showPersonDetailsModal, setShowPersonDetailsModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [announceRecognitions, setAnnounceRecognitions] = useState(true);
  const [recognitionThreshold, setRecognitionThreshold] = useState(0.7); // 0-1
  
  // New person form state
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRelation, setNewPersonRelation] = useState('');
  const [newPersonNotes, setNewPersonNotes] = useState('');
  
  // Refs
  const cameraRef = useRef<any>(null);
  const recognitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const announcedPeopleRef = useRef<Set<string>>(new Set());
  const [permission, requestPermission] = useCameraPermissions();
  
  // Request camera permission
  useEffect(() => {
    const requestPermission = async () => {
        const [permission, requestPermission] = useCameraPermissions();
      setCameraPermission(status === 'granted');
    };
    
    requestPermission();
    loadKnownPeople();
    
    return () => {
      if (recognitionTimerRef.current) {
        clearInterval(recognitionTimerRef.current);
      }
    };
  }, []);
  
  // Handle continuous mode
  useEffect(() => {
    if (continuousMode) {
      startContinuousRecognition();
    } else {
      stopContinuousRecognition();
    }
    
    return () => {
      stopContinuousRecognition();
    };
  }, [continuousMode]);
  
  // Reset announced people when recognition results change
  useEffect(() => {
    if (recognitionResults.length === 0) {
      announcedPeopleRef.current.clear();
    }
  }, [recognitionResults]);
  
  // Load known people from storage
  const loadKnownPeople = async () => {
    try {
      const peopleJson = await AsyncStorage.getItem('known_people');
      if (peopleJson) {
        const people: Person[] = JSON.parse(peopleJson);
        // Convert saved date strings back to Date objects
        people.forEach(person => {
          if (person.lastSeen) {
            person.lastSeen = new Date(person.lastSeen);
          }
        });
        setKnownPeople(people);
      }
    } catch (error) {
      console.error('Error loading known people:', error);
    }
  };
  
  // Save known people to storage
  const saveKnownPeople = async (people: Person[]) => {
    try {
      await AsyncStorage.setItem('known_people', JSON.stringify(people));
    } catch (error) {
      console.error('Error saving known people:', error);
    }
  };
  
  // Start continuous recognition
  const startContinuousRecognition = () => {
    if (recognitionTimerRef.current) {
      clearInterval(recognitionTimerRef.current);
    }
    
    recognitionTimerRef.current = setInterval(() => {
      if (cameraReady && !isRecognizing) {
        recognizeFaces();
      }
    }, 3000); // Recognize every 3 seconds
  };
  
  // Stop continuous recognition
  const stopContinuousRecognition = () => {
    if (recognitionTimerRef.current) {
      clearInterval(recognitionTimerRef.current);
      recognitionTimerRef.current = null;
    }
  };
  
  // Toggle continuous mode
  const toggleContinuousMode = () => {
    setContinuousMode(!continuousMode);
  };
  
  // Recognize faces in the current camera view
  const recognizeFaces = async () => {
    if (!cameraRef.current || !cameraReady || isRecognizing) return;
    
    try {
      setIsRecognizing(true);
      
      // Take a photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true
      });
      
      // In a real implementation, we would:
      // 1. Detect faces in the photo
      // 2. Extract face encodings
      // 3. Compare with known faces
      // 4. Return recognition results
      
      // For demo purposes, generate mock results
      const mockResults = await generateMockRecognitionResults();
      
      // Update state with detected faces
      setRecognitionResults(mockResults);
      
      // Add to history if faces were detected
      if (mockResults.length > 0) {
        setRecognitionHistory(prev => [...mockResults, ...prev].slice(0, 20));
      }
      
      // Announce recognized people
      if (announceRecognitions) {
        announceResults(mockResults);
      }
      
      setIsRecognizing(false);
    } catch (error) {
      console.error('Error recognizing faces:', error);
      setIsRecognizing(false);
    }
  };
  
  // Generate mock recognition results for demo
  const generateMockRecognitionResults = async (): Promise<RecognitionResult[]> => {
    const results: RecognitionResult[] = [];
    
    // For demo purposes, randomly select 0-2 people from the known list
    const numberOfFaces = Math.floor(Math.random() * 3);
    
    if (numberOfFaces === 0 || knownPeople.length === 0) {
      // Sometimes return an empty result
      return results;
    }
    
    // Generate positions for faces (avoid overlapping)
    const positions = [
      { x: 0.2, y: 0.3 },
      { x: 0.6, y: 0.3 },
      { x: 0.4, y: 0.6 }
    ];
    
    // Randomly generate recognition results
    for (let i = 0; i < Math.min(numberOfFaces, positions.length); i++) {
      // 80% chance to recognize a known person, 20% chance for unknown face
      const isKnown = Math.random() < 0.8 && knownPeople.length > 0;
      
      if (isKnown) {
        // Select a random known person
        const randomPersonIndex = Math.floor(Math.random() * knownPeople.length);
        const person = { ...knownPeople[randomPersonIndex] };
        
        // Generate a high confidence score
        const confidence = 0.75 + Math.random() * 0.25; // 0.75-1.0
        
        // Update last seen date
        person.lastSeen = new Date();
        
        // Create the result
        results.push({
          person,
          confidence,
          timestamp: new Date(),
          location: {
            x: positions[i].x * 100,
            y: positions[i].y * 100,
            width: 20 + Math.random() * 10,
            height: 20 + Math.random() * 10
          },
          newFace: false
        });
        
        // Update the known person in our state
        const updatedPeople = [...knownPeople];
        updatedPeople[randomPersonIndex] = person;
        setKnownPeople(updatedPeople);
        saveKnownPeople(updatedPeople);
      } else {
        // Unknown face
        results.push({
          confidence: 0.3 + Math.random() * 0.3, // Lower confidence for unknown faces
          timestamp: new Date(),
          location: {
            x: positions[i].x * 100,
            y: positions[i].y * 100,
            width: 20 + Math.random() * 10,
            height: 20 + Math.random() * 10
          },
          newFace: true
        });
      }
    }
    
    return results;
  };
  
  // Announce recognition results via speech
  const announceResults = (results: RecognitionResult[]) => {
    if (results.length === 0) return;
    
    // Only announce people we haven't already announced in this session
    const newRecognitions = results.filter(result => 
      result.person && 
      result.confidence >= recognitionThreshold && 
      !announcedPeopleRef.current.has(result.person.id)
    );
    
    if (newRecognitions.length === 0) return;
    
    // Build announcement message
    const knownPeopleNames = newRecognitions
      .filter(result => result.person)
      .map(result => result.person?.name)
      .join(' and ');
    
    const unknownCount = results.filter(result => result.newFace).length;
    
    let message = '';
    
    if (knownPeopleNames && unknownCount > 0) {
      message = `I can see ${knownPeopleNames} and ${unknownCount} unknown ${unknownCount === 1 ? 'person' : 'people'}.`;
    } else if (knownPeopleNames) {
      message = `I can see ${knownPeopleNames}.`;
    } else if (unknownCount > 0) {
      message = `I can see ${unknownCount} unknown ${unknownCount === 1 ? 'person' : 'people'}.`;
    }
    
    if (message) {
      Speech.speak(message);
      
      // Mark these people as announced
      newRecognitions.forEach(result => {
        if (result.person) {
          announcedPeopleRef.current.add(result.person.id);
        }
      });
    }
  };
  
  // Add a new person
  const addNewPerson = async () => {
    if (!newPersonName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    
    try {
      // Take a photo for the new person
      if (!cameraRef.current) {
        Alert.alert('Error', 'Camera not ready');
        return;
      }
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8
      });
      
      // In a real app, we would extract the face and calculate its encoding
      
      // Create new person
      const newPerson: Person = {
        id: Date.now().toString(),
        name: newPersonName.trim(),
        relation: newPersonRelation.trim(),
        notes: newPersonNotes.trim(),
        imageUri: photo.uri,
        lastSeen: new Date()
      };
      
      // Add to known people
      const updatedPeople = [...knownPeople, newPerson];
      setKnownPeople(updatedPeople);
      saveKnownPeople(updatedPeople);
      
      // Reset form
      setNewPersonName('');
      setNewPersonRelation('');
      setNewPersonNotes('');
      setShowAddPersonModal(false);
      
      // Success haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      // Announce
      Speech.speak(`${newPerson.name} has been added to your contacts.`);
    } catch (error) {
      console.error('Error adding new person:', error);
      Alert.alert('Error', 'Failed to add new person');
    }
  };
  
  // Delete a person
  const deletePerson = (person: Person) => {
    Alert.alert(
      'Delete Person',
      `Are you sure you want to remove ${person.name} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            const updatedPeople = knownPeople.filter(p => p.id !== person.id);
            setKnownPeople(updatedPeople);
            saveKnownPeople(updatedPeople);
            setSelectedPerson(null);
            setShowPersonDetailsModal(false);
            
            // Haptic feedback
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
          }
        }
      ]
    );
  };
  
  // Show person details
  const showPersonDetails = (person: Person) => {
    setSelectedPerson(person);
    setShowPersonDetailsModal(true);
  };
  
  // Render face markers on screen
  const renderFaceMarkers = () => {
    return recognitionResults.map((result, index) => {
      const { x, y, width, height } = result.location;
      
      // Determine border color based on recognition status
      let borderColor = '#FFFFFF';
      if (result.person && result.confidence >= recognitionThreshold) {
        borderColor = '#4CAF50'; // Known person with high confidence
      } else if (result.person) {
        borderColor = '#FFC107'; // Known person with low confidence
      } else {
        borderColor = '#F44336'; // Unknown person
      }
      
      return (
        <View
          key={index}
          style={[
            styles.faceMarker,
            {
              left: `${x}%`,
              top: `${y}%`,
              width: `${width}%`,
              height: `${height}%`,
              borderColor
            }
          ]}
        >
          {result.person && (
            <View style={styles.nameTag}>
              <ThemedText style={styles.nameTagText}>
                {result.person.name}
              </ThemedText>
              <ThemedText style={styles.confidenceText}>
                {Math.round(result.confidence * 100)}%
              </ThemedText>
            </View>
          )}
        </View>
      );
    });
  };
  
  // If camera permission is not granted
  if (!cameraPermission) {
    return (
      <ThemedView style={styles.permissionContainer}>
        <Ionicons name="alert-circle" size={64} color="#F44336" />
        <ThemedText style={styles.permissionText}>
          Camera permission is required for face recognition
        </ThemedText>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <ThemedText style={styles.permissionButtonText}>
            Grant Permission
          </ThemedText>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity
            style={[styles.permissionButton, styles.closeButton]}
            onPress={onClose}
          >
            <ThemedText style={styles.permissionButtonText}>
              Close
            </ThemedText>
          </TouchableOpacity>
        )}
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      {/* Camera view */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={'front' as CameraType}
        onCameraReady={() => setCameraReady(true)}
      >
        {/* Face markers */}
        {renderFaceMarkers()}
        
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>
            Face Recognition
          </ThemedText>
          
          <View style={styles.headerControls}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowSettings(!showSettings)}
            >
              <Ionicons name="settings-outline" size={24} color="white" />
            </TouchableOpacity>
            
            {onClose && (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={onClose}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Settings panel */}
        {showSettings && (
          <View style={styles.settingsPanel}>
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>
                Announce Recognitions
              </ThemedText>
              <Switch
                value={announceRecognitions}
                onValueChange={setAnnounceRecognitions}
                trackColor={{ false: '#767577', true: '#81D4FA' }}
                thumbColor={announceRecognitions ? '#2196F3' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.settingRow}>
              <ThemedText style={styles.settingLabel}>
                Recognition Threshold
              </ThemedText>
              <View style={styles.sliderContainer}>
                <TouchableOpacity
                  style={styles.sliderButton}
                  onPress={() => setRecognitionThreshold(Math.max(0.5, recognitionThreshold - 0.05))}
                >
                  <Ionicons name="remove" size={16} color="#2196F3" />
                </TouchableOpacity>
                <ThemedText style={styles.sliderValue}>
                  {Math.round(recognitionThreshold * 100)}%
                </ThemedText>
                <TouchableOpacity
                  style={styles.sliderButton}
                  onPress={() => setRecognitionThreshold(Math.min(0.95, recognitionThreshold + 0.05))}
                >
                  <Ionicons name="add" size={16} color="#2196F3" />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.manageContactsButton}
              onPress={() => Alert.alert('Contacts', `You have ${knownPeople.length} saved contacts`)}
            >
              <Ionicons name="people" size={18} color="#2196F3" />
              <ThemedText style={styles.manageContactsText}>
                Manage Contacts ({knownPeople.length})
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Recognition info panel */}
        <View style={styles.recognitionInfoContainer}>
          {recognitionResults.length > 0 ? (
            <View style={styles.recognitionInfo}>
              <ThemedText style={styles.recognitionInfoTitle}>
                {recognitionResults.filter(r => r.person && r.confidence >= recognitionThreshold).length > 0 
                  ? 'People Recognized:' 
                  : 'Unknown People:'}
              </ThemedText>
              
              {recognitionResults
                .filter(r => r.person && r.confidence >= recognitionThreshold)
                .map((result, index) => (
                  <View key={index} style={styles.personInfo}>
                    <ThemedText style={styles.personName}>
                      {result.person?.name}
                    </ThemedText>
                    {result.person?.relation && (
                      <ThemedText style={styles.personRelation}>
                        {result.person.relation}
                      </ThemedText>
                    )}
                  </View>
                ))}
              
              {recognitionResults.filter(r => r.newFace || (r.person && r.confidence < recognitionThreshold)).length > 0 && (
                <ThemedText style={styles.unknownPeople}>
                  {recognitionResults.filter(r => r.newFace || (r.person && r.confidence < recognitionThreshold)).length} unknown {recognitionResults.filter(r => r.newFace || (r.person && r.confidence < recognitionThreshold)).length === 1 ? 'person' : 'people'}
                </ThemedText>
              )}
            </View>
          ) : (
            <ThemedText style={styles.noRecognitionText}>
              {isRecognizing ? 'Processing...' : 'No faces detected'}
            </ThemedText>
          )}
        </View>
        
        {/* Control buttons */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.recognizeButton,
              isRecognizing && styles.recognizingButton
            ]}
            onPress={recognizeFaces}
            disabled={!cameraReady || isRecognizing || continuousMode}
          >
            <Ionicons
              name="scan"
              size={24}
              color="white"
            />
            <ThemedText style={styles.recognizeButtonText}>
              {isRecognizing ? 'Recognizing...' : 'Recognize Faces'}
            </ThemedText>
          </TouchableOpacity>
          
          <View style={styles.secondaryControls}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                continuousMode && styles.activeControlButton
              ]}
              onPress={toggleContinuousMode}
            >
              <Ionicons
                name="infinite"
                size={24}
                color="white"
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setShowAddPersonModal(true)}
            >
              <Ionicons
                name="person-add"
                size={24}
                color="white"
              />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
      
      {/* Add Person Modal */}
      <Modal
        visible={showAddPersonModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddPersonModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ThemedText style={styles.modalTitle}>Add New Person</ThemedText>
            
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Name</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="Enter name"
                value={newPersonName}
                onChangeText={setNewPersonName}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Relation</ThemedText>
              <TextInput
                style={styles.textInput}
                placeholder="E.g., Friend, Family, Colleague"
                value={newPersonRelation}
                onChangeText={setNewPersonRelation}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Notes (Optional)</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                placeholder="Additional information"
                value={newPersonNotes}
                onChangeText={setNewPersonNotes}
                multiline={true}
                numberOfLines={3}
              />
            </View>
            
            <ThemedText style={styles.captureInstructions}>
              Position the face in the camera view before adding
            </ThemedText>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddPersonModal(false)}
              >
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={addNewPerson}
              >
                <ThemedText style={styles.modalButtonText}>Add Person</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Person Details Modal */}
      <Modal
        visible={showPersonDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPersonDetailsModal(false)}
      >
        {selectedPerson && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ThemedText style={styles.modalTitle}>{selectedPerson.name}</ThemedText>
              
              <View style={styles.personDetailItem}>
                <ThemedText style={styles.personDetailLabel}>Relation:</ThemedText>
                <ThemedText style={styles.personDetailValue}>
                  {selectedPerson.relation || 'Not specified'}
                </ThemedText>
              </View>
              
              {selectedPerson.notes && (
                <View style={styles.personDetailItem}>
                  <ThemedText style={styles.personDetailLabel}>Notes:</ThemedText>
                  <ThemedText style={styles.personDetailValue}>
                    {selectedPerson.notes}
                  </ThemedText>
                </View>
              )}
              
              <View style={styles.personDetailItem}>
                <ThemedText style={styles.personDetailLabel}>Last Seen:</ThemedText>
                <ThemedText style={styles.personDetailValue}>
                  {selectedPerson.lastSeen
                    ? selectedPerson.lastSeen.toLocaleString()
                    : 'Never'}
                </ThemedText>
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowPersonDetailsModal(false)}
                >
                  <ThemedText style={styles.modalButtonText}>Close</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={() => deletePerson(selectedPerson)}
                >
                  <ThemedText style={styles.modalButtonText}>Delete</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>
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
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#9E9E9E',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  headerControls: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  faceMarker: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  nameTag: {
    position: 'absolute',
    bottom: -30,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 5,
    alignItems: 'center',
  },
  nameTagText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  confidenceText: {
    color: '#4CAF50',
    fontSize: 10,
  },
  recognitionInfoContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 15,
  },
  recognitionInfo: {},
  recognitionInfoTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  personInfo: {
    marginBottom: 10,
  },
  personName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  personRelation: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  unknownPeople: {
    color: '#FF9800',
    marginTop: 5,
  },
  noRecognitionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  recognizeButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 30,
    marginBottom: 15,
  },
  recognizingButton: {
    backgroundColor: '#9E9E9E',
  },
  recognizeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeControlButton: {
    backgroundColor: '#4CAF50',
  },
  settingsPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 70,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingLabel: {
    fontSize: 16,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sliderButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderValue: {
    marginHorizontal: 10,
    fontWeight: 'bold',
  },
  manageContactsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginTop: 15,
  },
  manageContactsText: {
    marginLeft: 8,
    color: '#2196F3',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 5,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  textAreaInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  captureInstructions: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 5,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
  },
  addButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  personDetailItem: {
    marginBottom: 15,
  },
  personDetailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  personDetailValue: {
    fontSize: 16,
    marginTop: 3,
  },
});

export default FaceRecognitionAssistant;