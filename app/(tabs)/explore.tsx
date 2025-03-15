// app/(tabs)/explore.tsx
import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Switch,
  Alert,
  Platform
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { ThemedText } from '../../components/ui/ThemedText';
import { ThemedView } from '../../components/ui/ThemedView';

type SettingCategory = 'accessibility' | 'connectivity' | 'display' | 'notifications' | 'advanced';

interface SettingItem {
  id: string;
  title: string;
  description: string;
  type: 'toggle' | 'select' | 'action';
  category: SettingCategory;
  value?: boolean;
  options?: string[];
  iconName: string;
  onPress?: () => void;
}

export default function SettingsScreen() {
  // State for all settings
  const [settings, setSettings] = useState<{ [key: string]: any }>({
    realTimeTranslation: true,
    signLanguageRecognition: false,
    voiceCommands: true,
    hapticFeedback: true,
    highContrast: false,
    largeText: false,
    wheelchairMode: false,
    autoConnect: true,
    lowBatteryAlerts: true,
    navigationVoice: true,
    displayBrightness: 70,
    showNotifications: true,
    privacyMode: false,
  });
  
  // Toggle a boolean setting
  const toggleSetting = (id: string) => {
    setSettings(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Settings definitions organized by category
  const settingsData: SettingItem[] = [
    // Accessibility Settings
    {
      id: 'realTimeTranslation',
      title: 'Real-Time Translation',
      description: 'Enable text translation in the camera view',
      type: 'toggle',
      category: 'accessibility',
      value: settings.realTimeTranslation,
      iconName: 'language-outline',
    },
    {
      id: 'signLanguageRecognition',
      title: 'Sign Language Recognition',
      description: 'Enable sign language detection and translation',
      type: 'toggle',
      category: 'accessibility',
      value: settings.signLanguageRecognition,
      iconName: 'hand-left-outline',
    },
    {
      id: 'voiceCommands',
      title: 'Voice Commands',
      description: 'Enable voice control for hands-free operation',
      type: 'toggle',
      category: 'accessibility',
      value: settings.voiceCommands,
      iconName: 'mic-outline',
    },
    {
      id: 'hapticFeedback',
      title: 'Haptic Feedback',
      description: 'Enable vibration feedback in the glasses',
      type: 'toggle',
      category: 'accessibility',
      value: settings.hapticFeedback,
      iconName: 'pulse-outline',
    },
    {
      id: 'highContrast',
      title: 'High Contrast Mode',
      description: 'Increase contrast for better visibility',
      type: 'toggle',
      category: 'accessibility',
      value: settings.highContrast,
      iconName: 'contrast-outline',
    },
    {
      id: 'largeText',
      title: 'Large Text',
      description: 'Increase text size in the glasses display',
      type: 'toggle',
      category: 'accessibility',
      value: settings.largeText,
      iconName: 'text-outline',
    },
    {
      id: 'wheelchairMode',
      title: 'Wheelchair Mode',
      description: 'Optimize navigation for wheelchair users',
      type: 'toggle',
      category: 'accessibility',
      value: settings.wheelchairMode,
      iconName: 'wheelchair-outline',
    },
    
    // Connectivity Settings
    {
      id: 'autoConnect',
      title: 'Auto-Connect',
      description: 'Automatically connect to paired glasses',
      type: 'toggle',
      category: 'connectivity',
      value: settings.autoConnect,
      iconName: 'bluetooth-outline',
    },
    {
      id: 'pairNewDevice',
      title: 'Pair New Device',
      description: 'Connect to a new pair of smart glasses',
      type: 'action',
      category: 'connectivity',
      iconName: 'add-circle-outline',
      onPress: () => Alert.alert('Pairing', 'Searching for devices...'),
    },
    
    // Display Settings
    {
      id: 'adjustBrightness',
      title: 'Adjust Brightness',
      description: 'Change the display brightness',
      type: 'action',
      category: 'display',
      iconName: 'sunny-outline',
      onPress: () => Alert.alert('Brightness', 'Brightness adjustment would appear here'),
    },
    
    // Notification Settings
    {
      id: 'lowBatteryAlerts',
      title: 'Low Battery Alerts',
      description: 'Get notifications when battery is low',
      type: 'toggle',
      category: 'notifications',
      value: settings.lowBatteryAlerts,
      iconName: 'battery-low-outline',
    },
    {
      id: 'navigationVoice',
      title: 'Navigation Voice',
      description: 'Enable voice guidance during navigation',
      type: 'toggle',
      category: 'notifications',
      value: settings.navigationVoice,
      iconName: 'navigate-outline',
    },
    {
      id: 'showNotifications',
      title: 'Show Notifications',
      description: 'Display phone notifications on glasses',
      type: 'toggle',
      category: 'notifications',
      value: settings.showNotifications,
      iconName: 'notifications-outline',
    },
    
    // Advanced Settings
    {
      id: 'privacyMode',
      title: 'Privacy Mode',
      description: 'Disable storing of captured images and data',
      type: 'toggle',
      category: 'advanced',
      value: settings.privacyMode,
      iconName: 'shield-outline',
    },
    {
      id: 'resetSettings',
      title: 'Reset All Settings',
      description: 'Restore default settings',
      type: 'action',
      category: 'advanced',
      iconName: 'refresh-outline',
      onPress: () => {
        Alert.alert(
          'Reset Settings',
          'Are you sure you want to reset all settings to default?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Reset', 
              style: 'destructive',
              onPress: () => {
                // Reset logic would go here
                Alert.alert('Reset Complete', 'All settings have been reset to default');
              }
            },
          ]
        );
      },
    },
    {
      id: 'aboutApp',
      title: 'About Smart Glasses',
      description: 'Version info and legal details',
      type: 'action',
      category: 'advanced',
      iconName: 'information-circle-outline',
      onPress: () => {
        Alert.alert('About', 'Smart Glasses App\nVersion 1.0.0\n© 2025 Smart Glasses Team');
      },
    },
  ];
  
  // Filter settings by category
  const getSettingsByCategory = (category: SettingCategory) => {
    return settingsData.filter(setting => setting.category === category);
  };
  
  // Render a setting item
  const renderSettingItem = (setting: SettingItem) => {
    return (
      <TouchableOpacity
        key={setting.id}
        style={styles.settingItem}
        onPress={
          setting.type === 'action' 
            ? setting.onPress 
            : () => toggleSetting(setting.id)
        }
      >
        <View style={styles.settingIconContainer}>
          <Ionicons name={setting.iconName as any} size={24} color="#2196F3" />
        </View>
        
        <View style={styles.settingContent}>
          <ThemedText style={styles.settingTitle}>{setting.title}</ThemedText>
          <ThemedText style={styles.settingDescription}>
            {setting.description}
          </ThemedText>
        </View>
        
        {setting.type === 'toggle' && (
          <Switch
            value={setting.value}
            onValueChange={() => toggleSetting(setting.id)}
            trackColor={{ false: '#767577', true: '#81D4FA' }}
            thumbColor={setting.value ? '#2196F3' : '#f4f3f4'}
          />
        )}
        
        {setting.type === 'action' && (
          <Ionicons name="chevron-forward" size={20} color="#777" />
        )}
      </TouchableOpacity>
    );
  };
  
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Settings</ThemedText>
      </View>
      
      <ScrollView style={styles.settingsContainer}>
        {/* Accessibility Settings */}
        <View style={styles.settingSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="accessibility-outline" size={24} color="#2196F3" />
            <ThemedText style={styles.sectionTitle}>Accessibility</ThemedText>
          </View>
          
          {getSettingsByCategory('accessibility').map(renderSettingItem)}
        </View>
        
        {/* Connectivity Settings */}
        <View style={styles.settingSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bluetooth-outline" size={24} color="#2196F3" />
            <ThemedText style={styles.sectionTitle}>Connectivity</ThemedText>
          </View>
          
          {getSettingsByCategory('connectivity').map(renderSettingItem)}
        </View>
        
        {/* Display Settings */}
        <View style={styles.settingSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye-outline" size={24} color="#2196F3" />
            <ThemedText style={styles.sectionTitle}>Display</ThemedText>
          </View>
          
          {getSettingsByCategory('display').map(renderSettingItem)}
        </View>
        
        {/* Notification Settings */}
        <View style={styles.settingSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={24} color="#2196F3" />
            <ThemedText style={styles.sectionTitle}>Notifications</ThemedText>
          </View>
          
          {getSettingsByCategory('notifications').map(renderSettingItem)}
        </View>
        
        {/* Advanced Settings */}
        <View style={styles.settingSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cog-outline" size={24} color="#2196F3" />
            <ThemedText style={styles.sectionTitle}>Advanced</ThemedText>
          </View>
          
          {getSettingsByCategory('advanced').map(renderSettingItem)}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingsContainer: {
    flex: 1,
  },
  settingSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 10,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
});