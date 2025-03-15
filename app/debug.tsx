// app/debug.tsx
import { View, Text, StyleSheet } from 'react-native';

export default function DebugScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Screen</Text>
      <Text>If you can see this, routing is working correctly!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});