// components/accessibility/VoiceAssistant.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
  Platform
} from 'react-native';
import { ThemedText } from '../ui/ThemedText';
import { ThemedView } from '../ui/ThemedView';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

type VoiceAssistantProps = {
  onClose?: () => void;
  onNavigate?: (destination: string) => void;
  onTranslate?: () => void;
  onTakePicture?: () => void;
};

type ConversationMessage = {
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
};

type CommandType = 'navigation' | 'translation' | 'camera' | 'information' | 'help' | 'unknown';

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  onClose,
  onNavigate,
  onTranslate,
  onTakePicture,
}) => {
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [suggestedCommands, setSuggestedCommands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Animations
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Initialize
  useEffect(() => {
    // Simulate initialization
    setTimeout(() => {
      setIsInitialized(true);
      setIsLoading(false);
      
      // Add welcome message
      addToConversation('assistant', 'Hello! How can I help you today? You can ask me to navigate, translate, or take a picture.');
      
      // Set suggested commands
      setSuggestedCommands([
        'Navigate to the nearest pharmacy',
        'Translate this text',
        'Take a picture',
        'What can you do?'
      ]);
    }, 1500);
  }, []);
  
  // Start pulse animation
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [isListening, pulseAnimation]);
  
  // Auto scroll to bottom of conversation
  useEffect(() => {
    if (scrollViewRef.current && conversation.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation]);
  
  // Add message to conversation
  const addToConversation = (type: 'user' | 'assistant', text: string) => {
    setConversation(prev => [
      ...prev,
      { type, text, timestamp: new Date() }
    ]);
  };
  
  // Start listening
  const startListening = () => {
    if (isSpeaking) return;
    
    setIsListening(true);
    
    // Simulate listening for 5 seconds
    setTimeout(() => {
      const mockUserInput = getRandomMockInput();
      setTranscript(mockUserInput);
      addToConversation('user', mockUserInput);
      processCommand(mockUserInput);
      setIsListening(false);
    }, 5000);
  };
  
  // Stop listening
  const stopListening = () => {
    setIsListening(false);
  };
  
  // Process voice command
  const processCommand = (text: string) => {
    const commandType = identifyCommandType(text.toLowerCase());
    
    setIsSpeaking(true);
    
    // Process according to command type
    switch (commandType) {
      case 'navigation':
        const destination = extractDestination(text);
        if (destination && onNavigate) {
          const response = `I'll navigate you to ${destination}.`;
          addToConversation('assistant', response);
          simulateSpeak(response, () => {
            onNavigate(destination);
          });
        } else {
          const response = "I couldn't understand the destination. Where would you like to go?";
          addToConversation('assistant', response);
          simulateSpeak(response);
        }
        break;
        
      case 'translation':
        if (onTranslate) {
          const response = "I'll start real-time translation mode now.";
          addToConversation('assistant', response);
          simulateSpeak(response, onTranslate);
        }
        break;
        
      case 'camera':
        if (onTakePicture) {
          const response = "Taking a picture now.";
          addToConversation('assistant', response);
          simulateSpeak(response, onTakePicture);
        }
        break;
        
      case 'information':
        const response = "I can help you navigate, translate text, or take pictures. Just ask me!";
        addToConversation('assistant', response);
        simulateSpeak(response);
        break;
        
      case 'help':
        const helpResponse = "Here are some commands you can use: Navigate to [place], Translate this text, Take a picture, or What can you do?";
        addToConversation('assistant', helpResponse);
        simulateSpeak(helpResponse);
        break;
        
      default:
        const unknownResponse = "I'm not sure what you mean. You can ask me to navigate, translate, or take a picture.";
        addToConversation('assistant', unknownResponse);
        simulateSpeak(unknownResponse);
    }
  };
  
  // Identify command type from text
  const identifyCommandType = (text: string): CommandType => {
    if (text.includes('navigate') || text.includes('go to') || text.includes('take me to') || text.includes('find')) {
      return 'navigation';
    } else if (text.includes('translate') || text.includes('what does this say')) {
      return 'translation';
    } else if (text.includes('picture') || text.includes('photo') || text.includes('take a')) {
      return 'camera';
    } else if (text.includes('what can you do') || text.includes('what do you do')) {
      return 'information';
    } else if (text.includes('help') || text.includes('commands')) {
      return 'help';
    } else {
      return 'unknown';
    }
  };
  
  // Extract destination from navigation command
  const extractDestination = (text: string): string | null => {
    const navigationPhrases = ['navigate to', 'go to', 'take me to', 'find'];
    
    for (const phrase of navigationPhrases) {
      if (text.toLowerCase().includes(phrase)) {
        const parts = text.toLowerCase().split(phrase);
        if (parts.length > 1 && parts[1].trim()) {
          return parts[1].trim();
        }
      }
    }
    
    return null;
  };
  
  // Simulate speaking with delay
  const simulateSpeak = (text: string, callback?: () => void) => {
    // Calculate speaking time based on text length
    const speakingTime = Math.min(text.length * 50, 3000);
    
    setTimeout(() => {
      setIsSpeaking(false);
      if (callback) callback();
    }, speakingTime);
  };
  
  // Use suggested command
  const useSuggestedCommand = (command: string) => {
    setTranscript(command);
    addToConversation('user', command);
    processCommand(command);
  };
  
  // Get random mock user input for demo
  const getRandomMockInput = (): string => {
    const mockInputs = [
      "Navigate to the nearest hospital",
      "Take a picture please",
      "Translate this text for me",
      "What can you do?",
      "Help me find my way home",
      "I need to find a pharmacy",
    ];
    
    return mockInputs[Math.floor(Math.random() * mockInputs.length)];
  };
  
  // If still loading
  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <ThemedText style={styles.loadingText}>
          Initializing Voice Assistant...
        </ThemedText>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Voice Assistant</ThemedText>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#777" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Conversation */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.conversationContainer}
        contentContainerStyle={styles.conversationContent}
      >
        {conversation.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageContainer,
              message.type === 'user' ? styles.userMessage : styles.assistantMessage
            ]}
          >
            {message.type === 'assistant' && (
              <Ionicons name="glasses-outline" size={20} color="#2196F3" style={styles.messageIcon} />
            )}
            <View style={styles.messageContent}>
              <ThemedText style={styles.messageText}>{message.text}</ThemedText>
              <ThemedText style={styles.messageTime}>
                {message.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </ThemedText>
            </View>
            {message.type === 'user' && (
              <Ionicons name="person-circle-outline" size={20} color="#4CAF50" style={styles.messageIcon} />
            )}
          </View>
        ))}
      </ScrollView>
      
      {/* Suggested commands */}
      <ScrollView 
        horizontal
        style={styles.suggestedCommandsContainer}
        showsHorizontalScrollIndicator={false}
      >
        {suggestedCommands.map((command, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestedCommand}
            onPress={() => useSuggestedCommand(command)}
          >
            <ThemedText style={styles.suggestedCommandText}>{command}</ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Voice input */}
      <View style={styles.voiceInputContainer}>
        {isListening ? (
          <View style={styles.listeningContainer}>
            <ThemedText style={styles.listeningText}>Listening...</ThemedText>
            <TouchableOpacity style={styles.stopButton} onPress={stopListening}>
              <MaterialIcons name="stop" size={24} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.micButton}
            onPress={startListening}
            disabled={isSpeaking}
          >
            <View style={styles.micButtonInner}>
              <Animated.View 
                style={[
                  styles.micIcon,
                  { transform: [{ scale: pulseAnimation }] }
                ]}
              >
                <Ionicons 
                  name={isSpeaking ? "volume-high" : "mic"} 
                  size={28} 
                  color="white" 
                />
              </Animated.View>
            </View>
            <ThemedText style={styles.micButtonText}>
              {isSpeaking ? 'Speaking...' : 'Tap to speak'}
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Features bar */}
      <View style={styles.featuresBar}>
        <TouchableOpacity 
          style={styles.featureButton}
          onPress={() => onNavigate && onNavigate('destination')}
        >
          <Ionicons name="navigate-outline" size={24} color="#2196F3" />
          <ThemedText style={styles.featureButtonText}>Navigate</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.featureButton}
          onPress={onTranslate}
        >
          <Ionicons name="language-outline" size={24} color="#2196F3" />
          <ThemedText style={styles.featureButtonText}>Translate</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.featureButton}
          onPress={onTakePicture}
        >
          <Ionicons name="camera-outline" size={24} color="#2196F3" />
          <ThemedText style={styles.featureButtonText}>Camera</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.featureButton}
          onPress={() => Alert.alert('Help', 'You can ask me to navigate, translate text, or take pictures.')}
        >
          <Ionicons name="help-circle-outline" size={24} color="#2196F3" />
          <ThemedText style={styles.featureButtonText}>Help</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  conversationContainer: {
    flex: 1,
  },
  conversationContent: {
    padding: 15,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  messageIcon: {
    marginTop: 5,
  },
  messageContent: {
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    padding: 12,
    marginHorizontal: 10,
  },
  messageText: {
    fontSize: 16,
  },
  messageTime: {
    fontSize: 10,
    color: '#888',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  suggestedCommandsContainer: {
    maxHeight: 60,
    paddingHorizontal: 10,
  },
  suggestedCommand: {
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    marginHorizontal: 5,
    marginVertical: 10,
  },
  suggestedCommandText: {
    color: '#2196F3',
    fontSize: 14,
  },
  voiceInputContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
  },
  micButton: {
    alignItems: 'center',
  },
  micButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  micIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonText: {
    fontSize: 14,
    color: '#888',
  },
  listeningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningText: {
    fontSize: 16,
    marginRight: 15,
  },
  stopButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuresBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  featureButton: {
    alignItems: 'center',
    padding: 5,
  },
  featureButtonText: {
    fontSize: 12,
    marginTop: 5,
    color: '#2196F3',
  },
});

export default VoiceAssistant;