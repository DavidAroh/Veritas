import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { COLORS } from '@/lib/theme'

// Show notifications even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export default function RootLayout() {
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {})
  }, [])

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bg },
          headerTintColor: COLORS.text,
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Veritas' }} />
        <Stack.Screen name="browse" options={{ title: 'Browse' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  )
}
