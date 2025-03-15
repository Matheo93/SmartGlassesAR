import React, { useState } from 'react';
import { View, StyleSheet, Switch, ScrollView } from 'react-native';
import { ThemedText } from '../../components/ui/ThemedText';
import { ThemedView } from '../../components/ui/ThemedView';

export default function SettingsScreen() {
  const [settings, setSettings] = useState({
    translation: true,
    navigation: true,
    voiceCommands: true,
    signLanguage: false,
    highContrast: false,
    largeText: false,
    notifications: true,
  });

  const toggleSetting = (setting: keyof typeof settings) => {
    setSettings({
      ...settings,
      [setting]: !settings[setting]
    });
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Settings</ThemedText>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Features
          </ThemedText>
          
          <SettingItem
            title="Real-time Translation"
            value={settings.translation}
            onValueChange={() => toggleSetting('translation')}
          />
          
          <SettingItem
            title="Navigation Assistance"
            value={settings.navigation}
            onValueChange={() => toggleSetting('navigation')}
          />
          
          <SettingItem
            title="Voice Commands"
            value={settings.voiceCommands}
            onValueChange={() => toggleSetting('voiceCommands')}
          />
          
          <SettingItem
            title="Sign Language Recognition"
            value={settings.signLanguage}
            onValueChange={() => toggleSetting('signLanguage')}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Accessibility
          </ThemedText>
          
          <SettingItem
            title="High Contrast Mode"
            value={settings.highContrast}
            onValueChange={() => toggleSetting('highContrast')}
          />
          
          <SettingItem
            title="Large Text"
            value={settings.largeText}
            onValueChange={() => toggleSetting('largeText')}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Notifications
          </ThemedText>
          
          <SettingItem
            title="Enable Notifications"
            value={settings.notifications}
            onValueChange={() => toggleSetting('notifications')}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            About
          </ThemedText>
          
          <ThemedText style={styles.aboutText}>
            Smart Glasses App v1.0
          </ThemedText>
          
          <ThemedText style={styles.aboutDescription}>
            This application provides accessibility features for people with various 
            disabilities through smart glasses technology.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

interface SettingItemProps {
  title: string;
  value: boolean;
  onValueChange: () => void;
}

function SettingItem({ title, value, onValueChange }: SettingItemProps) {
  return (
    <View style={styles.settingItem}>
      <ThemedText>{title}</ThemedText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#767577", true: "#81b0ff" }}
        thumbColor={value ? "#2196F3" : "#f4f3f4"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  sectionTitle: {
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  aboutText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  aboutDescription: {
    lineHeight: 22,
  }
});