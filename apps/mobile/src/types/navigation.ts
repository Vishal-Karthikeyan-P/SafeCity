export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

/** Five-tab bottom navigation */
export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Report: undefined;
  SafeRoute: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  /** Full-screen SOS screen for the person who triggered it */
  ActiveSOS: { autoTrigger?: boolean } | undefined;
  /**
   * Read-only SOS viewer for an emergency contact who received an SOS alert.
   * Displays the SENDER's live location on a map — never the recipient's own coords.
   */
  SOSView: {
    sos_id: string;
    sender_name: string;
    /** Sender's initial coordinates from the push payload */
    sender_lat: number;
    sender_lng: number;
  };
  /** Phone-book style emergency contacts (legacy) */
  EmergencyContacts: undefined;
  /** In-app SafeCity user emergency contacts */
  SafeCityContacts: undefined;
  MyIncidents: undefined;
  Chat: undefined;
  Notifications: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};
