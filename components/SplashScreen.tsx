// components/SplashScreen.tsx
import React from 'react';
import { View, Image, StyleSheet, StatusBar } from 'react-native';

const SplashScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Image
        source={require('../assets/images/splash.png')} // Caminho da sua imagem
        style={styles.image}
        resizeMode="cover" // Ou "contain", dependendo do efeito desejado
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff', // Cor de fundo, se necessário
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default SplashScreen;