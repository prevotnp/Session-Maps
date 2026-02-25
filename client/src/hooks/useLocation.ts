import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { setupWebsocket, sendLocationUpdate } from '@/lib/websocket';
import type { User } from '@/types';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface SharedLocation {
  userId: number;
  location: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
}

export const useLocation = () => {
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [elevation, setElevation] = useState<string>('');
  const [coordinates, setCoordinates] = useState<string>('');
  const [sharedLocations, setSharedLocations] = useState<SharedLocation[]>([]);
  const { toast } = useToast();
  const { user } = useAuth() as { user: User | undefined };
  
  // Connect to location sharing websocket
  useEffect(() => {
    if (user?.id) {
      const { socket, disconnect } = setupWebsocket(user.id);
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'location') {
            // Add shared location to the list
            setSharedLocations(prev => {
              const filtered = prev.filter(loc => loc.userId !== data.userId);
              return [...filtered, { userId: data.userId, location: data.location }];
            });
            
            toast({
              title: 'Location Shared',
              description: `User ${data.userId} shared their location`,
              variant: 'default',
            });
          }
        } catch (error) {
          console.error('Error parsing websocket message:', error);
        }
      };
      
      return () => {
        disconnect();
      };
    }
  }, [user, toast]);
  
  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { coords, timestamp } = position;
          
          setLocationData({
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            altitude: coords.altitude,
            altitudeAccuracy: coords.altitudeAccuracy,
            heading: coords.heading,
            speed: coords.speed,
            timestamp
          });
          
          // Format coordinates for display
          setCoordinates(
            `${coords.latitude.toFixed(4)}° ${coords.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(coords.longitude).toFixed(4)}° ${coords.longitude >= 0 ? 'E' : 'W'}`
          );
          
          // Set elevation if available
          if (coords.altitude) {
            const altitudeInFeet = coords.altitude * 3.28084;
            setElevation(`${Math.round(altitudeInFeet)} ft`);
          }
          
          // Get location name from reverse geocoding
          reverseGeocode(coords.latitude, coords.longitude);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: 'Location Error',
            description: 'Unable to get your current location. Please check your location permissions.',
            variant: 'destructive',
          });
          
          // Set default location (Mt. Rainier)
          setLocationName('Mount Rainier National Park');
          setCoordinates('46.8523° N, 121.7603° W');
          setElevation('4,392 ft');
        }
      );
    } else {
      toast({
        title: 'Geolocation Not Supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
    }
  };
  
  // Reverse geocode to get location name
  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      // In a real app, this would use a geocoding service like Mapbox's Geocoding API
      // For this prototype, we'll just set a placeholder name
      setLocationName('Mount Rainier National Park');
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      setLocationName('Unknown Location');
    }
  };
  
  // Share location with other users
  const shareLocation = async () => {
    if (!user?.id) {
      toast({
        title: 'Authentication Required',
        description: 'You need to be logged in to share your location.',
        variant: 'destructive',
      });
      return;
    }
    
    // Helper function to share a location
    const performShare = async (coords: { latitude: number; longitude: number; altitude: number | null }) => {
      try {
        // Save location to database first
        await apiRequest('POST', '/api/locations', {
          name: locationName || 'My Current Location',
          latitude: coords.latitude,
          longitude: coords.longitude,
          elevation: coords.altitude
        });
        
        // Send location through existing websocket connection
        sendLocationUpdate({
          latitude: coords.latitude,
          longitude: coords.longitude,
          altitude: coords.altitude
        });
        
        toast({
          title: 'Location Shared',
          description: 'Your location has been shared successfully.',
        });
      } catch (error) {
        console.error('Error sharing location:', error);
        toast({
          title: 'Share Failed',
          description: 'Failed to share your location. Please try again.',
          variant: 'destructive',
        });
        throw error; // Re-throw to prevent success toast on error
      }
    };
    
    // If location data is not available, get it first
    if (!locationData) {
      toast({
        title: 'Getting Location',
        description: 'Requesting your current location...',
      });
      
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { coords } = position;
            
            // Update local state
            setLocationData({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
              altitude: coords.altitude,
              altitudeAccuracy: coords.altitudeAccuracy,
              heading: coords.heading,
              speed: coords.speed,
              timestamp: position.timestamp
            });
            
            // Share the newly obtained location
            await performShare({
              latitude: coords.latitude,
              longitude: coords.longitude,
              altitude: coords.altitude
            });
          },
          (error) => {
            console.error('Error getting location:', error);
            toast({
              title: 'Location Permission Denied',
              description: 'Please enable location access in your browser settings to share your location.',
              variant: 'destructive',
            });
          }
        );
      } else {
        toast({
          title: 'Geolocation Not Supported',
          description: 'Your browser does not support geolocation.',
          variant: 'destructive',
        });
      }
      return;
    }
    
    // Location data is available, share it
    await performShare({
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      altitude: locationData.altitude
    });
  };
  
  return {
    locationData,
    locationName,
    elevation,
    coordinates,
    sharedLocations,
    getCurrentLocation,
    shareLocation
  };
};
