import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../core/ThemeContext';
import { loadFonts, FontFamilies } from '../core/fonts';
import { useTheme } from '../core/ThemeContext';

const fontMap = {
  'Urbanist_400Regular': require('../../assets/fonts/Urbanist-Regular.ttf'),
  'Urbanist_500Medium': require('../../assets/fonts/Urbanist-Medium.ttf'),
  'Urbanist_600SemiBold': require('../../assets/fonts/Urbanist-SemiBold.ttf'),
  'Urbanist_700Bold': require('../../assets/fonts/Urbanist-Bold.ttf'),
  'SpaceMono_400Regular': require('../../assets/fonts/SpaceMono-Regular.ttf'),
  'SpaceMono_500Medium': require('../../assets/fonts/SpaceMono-Medium.ttf'),
  'Caveat_400Regular': require('../../assets/fonts/Caveat-Regular.ttf'),
  'Caveat_700Bold': require('../../assets/fonts/Caveat-Bold.ttf'),
};

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    loadFonts().then(setFontsLoaded);
  }, []);

  if (!fontsLoaded) {
    return (
      <ThemeProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#FDFBF7' },
          }}
        >
          <Stack.Screen name="index" />
        </Stack>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FDFBF7' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="diagnostic" />
        <Stack.Screen name="conversation" />
        <Stack.Screen name="speaking" />
        <Stack.Screen name="grammar" />
        <Stack.Screen name="vocabulary" />
        <Stack.Screen name="review" />
        <Stack.Screen name="listening" />
        <Stack.Screen name="writing" />
        <Stack.Screen name="interview" />
        <Stack.Screen name="pronunciation" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="profile" />
      </Stack>
    </ThemeProvider>
  );
}

export function useFontsLoaded() {
  return true; // Fonts loaded at root level
}