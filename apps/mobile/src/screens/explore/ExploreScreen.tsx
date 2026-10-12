/**
 * ExploreScreen — "Explore" tab (merged Live Map + Incidents)
 *
 * This is a thin adapter that mounts the full MapScreen (which already contains
 * map/list view switching, filters, incident markers, and category selection)
 * under the new "Explore" tab identity.
 *
 * All map and incidents logic remains in MapScreen to avoid duplication.
 * Route name references to the old "Map" tab should use "Explore" going forward.
 */
import React from 'react';
import { MapScreen } from '../map/MapScreen';

export const ExploreScreen: React.FC = () => {
  return <MapScreen />;
};
