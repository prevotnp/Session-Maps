export interface User {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  isSubscribed: boolean;
  subscriptionExpiry?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<any>;
  register: (userData: any) => Promise<any>;
  logout: () => Promise<any>;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface SharedLocation {
  userId: number;
  location: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
}

export interface DroneImageryOverlay {
  id: number;
  name: string;
  bounds: {
    north: number;
    east: number;
    south: number;
    west: number;
  };
  date: string;
  isActive: boolean;
  sizeInMB: number;
}

export interface OfflineMapArea {
  id: number;
  name: string;
  bounds: {
    north: number;
    east: number;
    south: number;
    west: number;
  };
  downloadDate: string;
  sizeInMB: number;
  includesDroneData: boolean;
}

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  type: 'base' | 'overlay';
  icon?: string;
}

export interface MapSettings {
  rotation: number;
  terrainExaggeration: number;
  labelVisibility: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  northEast: Coordinates;
  southWest: Coordinates;
}

export interface Subscription {
  isSubscribed: boolean;
  planType?: 'monthly' | 'yearly';
  expiryDate?: string;
}
