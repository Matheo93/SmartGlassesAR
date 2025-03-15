// app/(tabs)/index.tsx
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '../../components/ui/ThemedText';
import { ThemedView } from '../../components/ui/ThemedView';
import Colors from '../../constants/Colors';

interface FeatureProps {
  icon: string;
  title: string;
  description: string;
}

function Feature({ icon, title, description }: FeatureProps) {
  return (
    <View style={styles.featureItem}>
      <Ionicons name={icon as any} size={24} color="#2196F3" />
      <View style={styles.featureText}>
        <ThemedText style={styles.featureTitle}>{title}</ThemedText>
        <ThemedText style={styles.featureDescription}>{description}</ThemedText>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [isConnected, setIsConnected] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Smart Glasses</ThemedText>
      </View>

      <View style={styles.content}>
        <View style={styles.glassesIconContainer}>
          <Ionicons
            name={isConnected ? "glasses" : "glasses-outline"}
            size={100}
            color="#2196F3"
          />
          <ThemedText style={styles.statusText}>
            {isConnected ? "Connected" : "Not Connected"}
          </ThemedText>
        </View>

        <TouchableOpacity
          style={[styles.connectButton, isConnected && styles.connectedButton]}
          onPress={() => setIsConnected(!isConnected)}
        >
          <ThemedText style={styles.buttonText}>
            {isConnected ? "Disconnect" : "Connect Smart Glasses"}
          </ThemedText>
        </TouchableOpacity>

        {isConnected && (
          <View style={styles.featuresContainer}>
            <Feature 
              icon="language-outline"
              title="Translation" 
              description="Real-time translation ready"
            />
            <Feature 
              icon="navigate-circle-outline"
              title="Navigation" 
              description="GPS navigation enabled"
            />
            <Feature 
              icon="mic-outline"
              title="Voice Control" 
              description="Voice commands active"
            />
          </View>
        )}
      </View>
    </ThemedView>
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
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  glassesIconContainer: {
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 30,
  },
  statusText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '500',
  },
  connectButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    width: '80%',
    alignItems: 'center',
    marginBottom: 30,
  },
  connectedButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  featuresContainer: {
    width: '100%',
    gap: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 12,
  },
  featureText: {
    marginLeft: 15,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
});