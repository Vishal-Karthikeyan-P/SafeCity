import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import { MainTabNavigator } from './MainTabNavigator';
import { ActiveSOSScreen } from '../screens/sos/ActiveSOSScreen';
import { SOSViewScreen } from '../screens/sos/SOSViewScreen';
import { EmergencyContactsScreen as LegacyEmergencyContacts } from '../screens/sos/EmergencyContactsScreen';
import { EmergencyContactsScreen } from '../screens/profile/EmergencyContactsScreen';
import { MyIncidentsScreen } from '../screens/profile/MyIncidentsScreen';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

export const MainStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Bottom tabs root */}
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />

      {/* Full-screen SOS for the person who triggered it */}
      <Stack.Screen
        name="ActiveSOS"
        component={ActiveSOSScreen}
        options={{ gestureEnabled: false, animation: 'fade_from_bottom' }}
      />

      {/* Read-only SOS location viewer for recipients — shows SENDER's map */}
      <Stack.Screen
        name="SOSView"
        component={SOSViewScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: true }}
      />

      {/* Notifications as a full-screen stack screen (tab removed) */}
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ animation: 'slide_from_right' }}
      />

      {/* Legacy SOS emergency contacts (phone-book style) */}
      <Stack.Screen
        name="EmergencyContacts"
        component={LegacyEmergencyContacts}
        options={{ animation: 'slide_from_right' }}
      />

      {/* In-app SafeCity user emergency contacts */}
      <Stack.Screen
        name="SafeCityContacts"
        component={EmergencyContactsScreen}
        options={{ animation: 'slide_from_right' }}
      />

      <Stack.Screen
        name="MyIncidents"
        component={MyIncidentsScreen}
        options={{ animation: 'slide_from_right' }}
      />

      {/* Gemini AI Safety Chatbot screen */}
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
};
