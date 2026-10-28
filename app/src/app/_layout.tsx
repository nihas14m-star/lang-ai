/**
 * Root layout: boots the local database + store, checks backend connectivity.
 * Navigation is a flat stack with Home as the hub — intentionally simple so
 * the visual layer can be redesigned freely.
 */

import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAppStore } from "../state/store";
import { useTheme } from "../core/theme";

export default function RootLayout() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const checkConnection = useAppStore((s) => s.checkConnection);
  const theme = useTheme();

  useEffect(() => {
    void bootstrap();
    void checkConnection();
    const interval = setInterval(() => void checkConnection(), 60_000);
    return () => clearInterval(interval);
  }, [bootstrap, checkConnection]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
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
    </>
  );
}
