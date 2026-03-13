import { Stack } from 'expo-router';
import { AuthColors } from '@/constants/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AuthColors.background },
        animation: 'fade',
        gestureEnabled: false, // Prevent swipe back to auth
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
