// app/(tabs)/index.tsx
import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  Modal,
  ActivityIndicator,
  Switch,
  ScrollView,
  Platform,
  useColorScheme
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '../../components/ui/ThemedText';
import { ThemedView } from '../../components/ui/ThemedView';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { router } from 'expo-router';

// Composants de fonctionnalités
import { VoiceTranslator } from '../../components/accessibility/VoiceTranslator';
import { EnhancedNavigation } from '../../components/navigation/EnhancedNavigation';
import { EnhancedSignLanguageRecognition } from '../../components/accessibility/EnhancedSignLanguageRecognition';
import { BluetoothConnection } from '../../components/BluetoothConnection';
import { VoiceAssistant } from '../../components/accessibility/VoiceAssistant';

// Type pour les notifications
type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
  action?: () => void;
  actionLabel?: string;
};

// Type pour les fonctionnalités
type FeatureModal = 
  | 'translation' 
  | 'navigation' 
  | 'signLanguage' 
  | 'voiceAssistant' 
  | 'connection'
  | 'settings'
  | null;

export default function MainHub() {
  // État des services
  const [servicesInitialized, setServicesInitialized] = useState(true); // Pour démo
  const [isConnected, setIsConnected] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [activeFeature, setActiveFeature] = useState<FeatureModal>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [wheelchairMode, setWheelchairMode] = useState(false);
  
  // Détection du thème système
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  // Constantes
  const APP_NAME = "Smart Glasses";
  
  // Fonction sécurisée pour le retour haptique qui vérifie la plateforme
  const triggerHapticFeedback = (type: Haptics.NotificationFeedbackType | Haptics.ImpactFeedbackStyle) => {
    // Vérifier si on est sur une plateforme native qui supporte les haptics
    if (Platform.OS !== 'web') {
      try {
        if (typeof type === 'string') {
          // C'est un NotificationFeedbackType
          Haptics.notificationAsync(type as Haptics.NotificationFeedbackType);
        } else {
          // C'est un ImpactFeedbackStyle
          Haptics.impactAsync(type as Haptics.ImpactFeedbackStyle);
        }
      } catch (error) {
        console.log('Haptics not available:', error);
      }
    }
  };
  
  // Initialisation simulée
  useEffect(() => {
    // Notification de démarrage
    addNotification({
      id: 'startup',
      title: 'Système prêt',
      message: 'Tous les services sont initialisés',
      type: 'success',
      read: false
    });
    
    // Simuler une connexion pour la démo
    setTimeout(() => {
      connectDevice();
    }, 2000);
  }, []);
  
  // Fonction pour connecter l'appareil
  const connectDevice = async () => {
    try {
      // Simuler une connexion Bluetooth pour la démo
      setIsConnected(true);
      setBatteryLevel(85);
      
      // Notification de connexion
      addNotification({
        id: 'connect',
        title: 'Lunettes connectées',
        message: 'Connexion établie avec Smart Glasses X1',
        type: 'success',
        read: false
      });
      
      // Retour haptique pour confirmer la connexion
      triggerHapticFeedback(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Connection error:', error);
      
      addNotification({
        id: 'connect_error',
        title: 'Erreur de connexion',
        message: 'Impossible de se connecter aux lunettes',
        type: 'error',
        read: false,
        action: connectDevice,
        actionLabel: 'Réessayer'
      });
    }
  };
  
  // Fonction pour déconnecter l'appareil
  const disconnectDevice = () => {
    setIsConnected(false);
    setBatteryLevel(0);
    
    // Notification de déconnexion
    addNotification({
      id: 'disconnect',
      title: 'Lunettes déconnectées',
      message: 'Connexion interrompue avec les lunettes',
      type: 'info',
      read: false
    });
    
    // Retour haptique pour confirmer la déconnexion
    triggerHapticFeedback(Haptics.NotificationFeedbackType.Warning);
  };
  
  // Fonction pour ajouter une notification
  const addNotification = (notification: Omit<Notification, 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      timestamp: new Date(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Retour haptique selon le type de notification
    switch (notification.type) {
      case 'success':
        triggerHapticFeedback(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        triggerHapticFeedback(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warning':
        triggerHapticFeedback(Haptics.NotificationFeedbackType.Warning);
        break;
      default:
        triggerHapticFeedback(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  
  // Marquer une notification comme lue
  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };
  
  // Effacer toutes les notifications
  const clearAllNotifications = () => {
    setNotifications([]);
  };
  
  // Ouvrir une fonctionnalité
  const openFeature = (feature: FeatureModal) => {
    setActiveFeature(feature);
  };
  
  // Fermer la fonctionnalité active
  const closeFeature = () => {
    setActiveFeature(null);
  };
  
  // Toggler le mode fauteuil roulant
  const toggleWheelchairMode = () => {
    setWheelchairMode(prev => !prev);
    
    // Notification
    addNotification({
      id: 'wheelchair_mode',
      title: 'Mode fauteuil roulant',
      message: !wheelchairMode ? 'Mode fauteuil roulant activé' : 'Mode fauteuil roulant désactivé',
      type: 'info',
      read: false
    });
  };
  
  // Ouvrir les paramètres
  const openSettings = () => {
    router.navigate('/(tabs)/explore');
  };
  
  // Rendu pendant l'initialisation
  if (!servicesInitialized) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <StatusBar style={isDarkMode ? "light" : "dark"} />
        <ActivityIndicator size="large" color="#2196F3" />
        <ThemedText style={styles.loadingText}>
          Initialisation des services...
        </ThemedText>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={[
      styles.container,
      isDarkMode && styles.containerDark
    ]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      
      {/* Entête */}
      <View style={[
        styles.header,
        isDarkMode && styles.headerDark
      ]}>
        <View style={styles.appTitleContainer}>
          <Ionicons name="glasses" size={24} color={isDarkMode ? "#4FC3F7" : "#2196F3"} />
          <ThemedText style={styles.appTitle}>{APP_NAME}</ThemedText>
        </View>
        
        <View style={styles.headerRight}>
          {/* Indicateur de batterie */}
          {isConnected && (
            <View style={[
              styles.batteryIndicator,
              isDarkMode && styles.batteryIndicatorDark
            ]}>
              <Ionicons 
                name={
                  batteryLevel > 80 ? "battery-full" :
                  batteryLevel > 50 ? "battery-half" :
                  batteryLevel > 20 ? "battery-half" :
                  "battery-dead"
                } 
                size={18} 
                color={
                  batteryLevel > 20 ? "#4CAF50" : "#F44336"
                } 
              />
              <ThemedText style={styles.batteryText}>
                {batteryLevel}%
              </ThemedText>
            </View>
          )}
          
          {/* Bouton de notifications */}
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <Ionicons 
              name="notifications" 
              size={24} 
              color={isDarkMode ? "#BBBBBB" : "#757575"} 
            />
            {notifications.filter(n => !n.read).length > 0 && (
              <View style={styles.notificationBadge}>
                <ThemedText style={styles.notificationBadgeText}>
                  {notifications.filter(n => !n.read).length}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {/* État de connexion */}
      <View style={[
        styles.connectionStatus,
        isConnected ? styles.connectedStatus : styles.disconnectedStatus
      ]}>
        <Ionicons 
          name={isConnected ? "bluetooth" : "bluetooth-outline"} 
          size={18} 
          color="white" 
        />
        <ThemedText style={styles.connectionStatusText}>
          {isConnected ? "Lunettes connectées" : "Lunettes déconnectées"}
        </ThemedText>
        <TouchableOpacity
          onPress={isConnected ? disconnectDevice : () => openFeature('connection')}
        >
          <ThemedText style={styles.connectionActionText}>
            {isConnected ? "Déconnecter" : "Connecter"}
          </ThemedText>
        </TouchableOpacity>
      </View>
      
      {/* Mode fauteuil roulant (si activé) */}
      {wheelchairMode && (
        <View style={[
          styles.wheelchairModeContainer,
          isDarkMode && styles.wheelchairModeContainerDark
        ]}>
          <FontAwesome5 name="wheelchair" size={18} color="#4CAF50" />
          <ThemedText style={styles.wheelchairModeText}>
            Mode fauteuil roulant activé
          </ThemedText>
        </View>
      )}
      
      {/* Grid des fonctionnalités principales */}
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.featuresGrid}>
          {/* Traduction vocale */}
          <TouchableOpacity 
            style={[
              styles.featureCard,
              isDarkMode && styles.featureCardDark
            ]}
            onPress={() => openFeature('translation')}
          >
            <View style={[
              styles.featureIconContainer, 
              { backgroundColor: isDarkMode ? '#1A2A3A' : '#E3F2FD' }
            ]}>
              <Ionicons 
                name="language" 
                size={32} 
                color={isDarkMode ? "#4FC3F7" : "#2196F3"} 
              />
            </View>
            <ThemedText style={styles.featureName}>Traduction vocale</ThemedText>
            <ThemedText style={[
              styles.featureDescription,
              isDarkMode && styles.featureDescriptionDark
            ]}>
              Traduction en temps réel de la parole
            </ThemedText>
          </TouchableOpacity>
          
          {/* Navigation assistée */}
          <TouchableOpacity 
            style={[
              styles.featureCard,
              isDarkMode && styles.featureCardDark
            ]}
            onPress={() => openFeature('navigation')}
          >
            <View style={[
              styles.featureIconContainer, 
              { backgroundColor: isDarkMode ? '#1A2F1A' : '#E8F5E9' }
            ]}>
              <Ionicons 
                name="navigate" 
                size={32} 
                color={isDarkMode ? "#66BB6A" : "#4CAF50"} 
              />
            </View>
            <ThemedText style={styles.featureName}>Navigation</ThemedText>
            <ThemedText style={[
              styles.featureDescription,
              isDarkMode && styles.featureDescriptionDark
            ]}>
              Navigation avec retour haptique
            </ThemedText>
          </TouchableOpacity>
          
          {/* Langage des signes */}
          <TouchableOpacity 
            style={[
              styles.featureCard,
              isDarkMode && styles.featureCardDark
            ]}
            onPress={() => openFeature('signLanguage')}
          >
            <View style={[
              styles.featureIconContainer, 
              { backgroundColor: isDarkMode ? '#332B1A' : '#FFF3E0' }
            ]}>
              <FontAwesome5 
                name="sign-language" 
                size={28} 
                color={isDarkMode ? "#FFB74D" : "#FF9800"} 
              />
            </View>
            <ThemedText style={styles.featureName}>Langage des signes</ThemedText>
            <ThemedText style={[
              styles.featureDescription,
              isDarkMode && styles.featureDescriptionDark
            ]}>
              Reconnaissance des signes
            </ThemedText>
          </TouchableOpacity>
          
          {/* Assistant vocal */}
          <TouchableOpacity 
            style={[
              styles.featureCard,
              isDarkMode && styles.featureCardDark
            ]}
            onPress={() => openFeature('voiceAssistant')}
          >
            <View style={[
              styles.featureIconContainer, 
              { backgroundColor: isDarkMode ? '#1A1A2F' : '#E8EAF6' }
            ]}>
              <Ionicons 
                name="mic" 
                size={32} 
                color={isDarkMode ? "#7986CB" : "#3F51B5"} 
              />
            </View>
            <ThemedText style={styles.featureName}>Assistant vocal</ThemedText>
            <ThemedText style={[
              styles.featureDescription,
              isDarkMode && styles.featureDescriptionDark
            ]}>
              Commandes vocales et assistance
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Bouton de mode fauteuil seulement (sans le bouton paramètres) */}
      <View style={[
        styles.quickSettings,
        isDarkMode && styles.quickSettingsDark
      ]}>
        <TouchableOpacity
          style={[
            styles.quickSettingButton,
            wheelchairMode && styles.quickSettingActive
          ]}
          onPress={toggleWheelchairMode}
        >
          <FontAwesome5 
            name="wheelchair" 
            size={20} 
            color={wheelchairMode ? "white" : (isDarkMode ? "#BBBBBB" : "#757575")} 
          />
          <ThemedText style={[
            styles.quickSettingText,
            wheelchairMode && styles.quickSettingActiveText
          ]}>
            Mode fauteuil
          </ThemedText>
        </TouchableOpacity>
      </View>
      
      {/* Modals pour les fonctionnalités */}
      <Modal
        visible={activeFeature === 'translation'}
        animationType="slide"
        onRequestClose={closeFeature}
      >
        <VoiceTranslator onClose={closeFeature} />
      </Modal>
      
      <Modal
        visible={activeFeature === 'navigation'}
        animationType="slide"
        onRequestClose={closeFeature}
      >
        <EnhancedNavigation 
          onClose={closeFeature}
          initialWheelchairMode={wheelchairMode}
        />
      </Modal>
      
      <Modal
        visible={activeFeature === 'signLanguage'}
        animationType="slide"
        onRequestClose={closeFeature}
      >
        <EnhancedSignLanguageRecognition onClose={closeFeature} />
      </Modal>
      
      <Modal
        visible={activeFeature === 'voiceAssistant'}
        animationType="slide"
        onRequestClose={closeFeature}
      >
        <VoiceAssistant 
          onClose={closeFeature}
          onNavigate={(destination) => {
            closeFeature();
            setTimeout(() => {
              openFeature('navigation');
            }, 500);
          }}
          onTranslate={() => {
            closeFeature();
            setTimeout(() => {
              openFeature('translation');
            }, 500);
          }}
        />
      </Modal>
      
      <Modal
        visible={activeFeature === 'connection'}
        animationType="slide"
        onRequestClose={closeFeature}
      >
        <BluetoothConnection onClose={closeFeature} />
      </Modal>
      
      {/* Modal de notifications */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.notificationModalContainer}>
          <View style={[
            styles.notificationModal,
            isDarkMode && styles.notificationModalDark
          ]}>
            <View style={[
              styles.notificationModalHeader,
              isDarkMode && styles.notificationModalHeaderDark
            ]}>
              <ThemedText style={styles.notificationModalTitle}>
                Notifications
              </ThemedText>
              <TouchableOpacity onPress={clearAllNotifications}>
                <ThemedText style={styles.clearAllText}>
                  Tout effacer
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.closeModalButton}
                onPress={() => setShowNotifications(false)}
              >
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={isDarkMode ? "#BBBBBB" : "#757575"} 
                />
              </TouchableOpacity>
            </View>
            
            {notifications.length === 0 ? (
              <View style={styles.emptyNotifications}>
                <Ionicons 
                  name="notifications-off" 
                  size={48} 
                  color={isDarkMode ? "#555555" : "#BDBDBD"} 
                />
                <ThemedText style={[
                  styles.emptyNotificationsText,
                  isDarkMode && { color: '#AAAAAA' }
                ]}>
                  Aucune notification
                </ThemedText>
              </View>
            ) : (
              notifications.map((notification, index) => (
                <TouchableOpacity 
                  key={notification.id + index}
                  style={[
                    styles.notificationItem,
                    isDarkMode && styles.notificationItemDark,
                    !notification.read && (isDarkMode ? styles.unreadNotificationDark : styles.unreadNotification)
                  ]}
                  onPress={() => markNotificationAsRead(notification.id)}
                >
                  <View style={styles.notificationIcon}>
                    <Ionicons 
                      name={
                        notification.type === 'success' ? "checkmark-circle" :
                        notification.type === 'error' ? "alert-circle" :
                        notification.type === 'warning' ? "warning" :
                        "information-circle"
                      } 
                      size={24} 
                      color={
                        notification.type === 'success' ? "#4CAF50" :
                        notification.type === 'error' ? "#F44336" :
                        notification.type === 'warning' ? "#FF9800" :
                        "#2196F3"
                      } 
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <ThemedText style={styles.notificationTitle}>
                      {notification.title}
                    </ThemedText>
                    <ThemedText style={[
                      styles.notificationMessage,
                      isDarkMode && styles.notificationMessageDark
                    ]}>
                      {notification.message}
                    </ThemedText>
                    <ThemedText style={[
                      styles.notificationTime,
                      isDarkMode && { color: '#AAAAAA' }
                    ]}>
                      {notification.timestamp.toLocaleTimeString()}
                    </ThemedText>
                    
                    {notification.action && (
                      <TouchableOpacity
                        style={styles.notificationAction}
                        onPress={notification.action}
                      >
                        <ThemedText style={styles.notificationActionText}>
                          {notification.actionLabel || 'Action'}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
  },
  headerDark: {
    backgroundColor: '#1E1E1E',
  },
  appTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  batteryIndicatorDark: {
    backgroundColor: '#333333',
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 5,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#F44336',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2196F3',
  },
  connectedStatus: {
    backgroundColor: '#4CAF50',
  },
  disconnectedStatus: {
    backgroundColor: '#F44336',
  },
  connectionStatusText: {
    color: 'white',
    marginLeft: 8,
    flex: 1,
  },
  connectionActionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  wheelchairModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  wheelchairModeContainerDark: {
    backgroundColor: '#1A2E1A',
    borderBottomColor: '#1A371A',
  },
  wheelchairModeText: {
    marginLeft: 8,
    color: '#4CAF50',
    fontWeight: '500',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  featureCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featureCardDark: {
    backgroundColor: '#2A2A2A',
    shadowColor: '#000000',
  },
  featureIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#757575',
  },
  featureDescriptionDark: {
    color: '#AAAAAA',
  },
  quickSettings: {
    flexDirection: 'row',
    justifyContent: 'center', // Centré puisqu'il n'y a plus qu'un bouton
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: 'white',
  },
  quickSettingsDark: {
    backgroundColor: '#1E1E1E',
    borderTopColor: '#333333',
  },
  quickSettingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  quickSettingActive: {
    backgroundColor: '#4CAF50',
  },
  quickSettingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  quickSettingActiveText: {
    color: 'white',
  },
  notificationModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  notificationModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  notificationModalDark: {
    backgroundColor: '#1E1E1E',
  },
  notificationModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  notificationModalHeaderDark: {
    borderBottomColor: '#333333',
  },
  notificationModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  clearAllText: {
    color: '#2196F3',
    marginRight: 16,
  },
  closeModalButton: {
    padding: 5,
  },
  emptyNotifications: {
    padding: 32,
    alignItems: 'center',
  },
  emptyNotificationsText: {
    marginTop: 16,
    color: '#757575',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  notificationItemDark: {
    borderBottomColor: '#333333',
  },
  unreadNotification: {
    backgroundColor: '#f0f0f0',
  },
  unreadNotificationDark: {
    backgroundColor: '#2A2A2A',
  },
  notificationIcon: {
    marginRight: 16,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#333',
  },
  notificationMessageDark: {
    color: '#DDDDDD',
  },
  notificationTime: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  notificationAction: {
    alignSelf: 'flex-start',
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginTop: 8,
  },
  notificationActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
});