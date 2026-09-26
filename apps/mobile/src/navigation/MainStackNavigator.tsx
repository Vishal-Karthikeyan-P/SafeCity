import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types/navigation';
import { MainTabNavigator } from './MainTabNavigator';
import { ActiveSOSScreen } from '../screens/sos/ActiveSOSScreen';
import { EmergencyContactsScreen } from '../screens/sos/EmergencyContactsScreen';

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
      <Stack.Screen
        name="EmergencyContacts"
        component={EmergencyContactsScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
};
