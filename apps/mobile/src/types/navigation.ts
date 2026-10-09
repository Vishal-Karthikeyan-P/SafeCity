export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Routes: undefined;
  Map: undefined;
  Report: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  ActiveSOS: { autoTrigger?: boolean } | undefined;
  EmergencyContacts: undefined;
  SafeCityContacts: undefined;
  MyIncidents: undefined;
  Chat: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

