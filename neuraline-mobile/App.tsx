import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

const App: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Neuraline Mobile - Test Build</Text>
      <Text style={styles.subtext}>If you see this, the app is working!</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 24, fontWeight: 'bold', color: '#0D7C8A' },
  subtext: { fontSize: 16, color: '#666', marginTop: 8 },
});

export default App;
