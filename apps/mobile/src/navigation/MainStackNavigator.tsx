import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import { MainTabNavigator } from './MainTabNavigator';
import { ActiveSOSScreen } from '../screens/sos/ActiveSOSScreen';
import { EmergencyContactsScreen as LegacyEmergencyContacts } from '../screens/sos/EmergencyContactsScreen';
import { EmergencyContactsScreen } from '../screens/profile/EmergencyContactsScreen';
import { MyIncidentsScreen } from '../screens/profile/MyIncidentsScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

export const MainStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="ActiveSOS"
        component={ActiveSOSScreen}
        options={{ gestureEnabled: false, animation: 'fade_from_bottom' }}
      />
      {/* Legacy SOS emergency contacts (phonebook-style) */}
      <Stack.Screen
        name="EmergencyContacts"
        component={LegacyEmergencyContacts}
        options={{ animation: 'slide_from_right' }}
      />
      {/* New in-app SafeCity user emergency contacts */}
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
    </Stack.Navigator>
  );
};
