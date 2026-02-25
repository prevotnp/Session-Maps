import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Waypoint } from '@shared/schema';

interface WaypointData {
  userWaypoints: Waypoint[];
  sharedWaypoints: Waypoint[];
}

export const useWaypoints = () => {
  const [waypoints, setWaypoints] = useState<WaypointData>({ userWaypoints: [], sharedWaypoints: [] });
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchWaypoints = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/waypoints', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setWaypoints(data);
      }
    } catch (error) {
      console.error('Error fetching waypoints:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWaypoints();
  }, [user]);

  const createWaypoint = async (waypointData: {
    name: string;
    latitude: number;
    longitude: number;
    elevation?: number;
  }): Promise<boolean> => {
    try {
      const response = await fetch('/api/waypoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...waypointData,
          latitude: waypointData.latitude.toString(),
          longitude: waypointData.longitude.toString(),
          elevation: waypointData.elevation?.toString(),
        }),
      });

      if (response.ok) {
        await fetchWaypoints(); // Refresh waypoints
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating waypoint:', error);
      return false;
    }
  };

  const updateWaypoint = async (id: number, updates: { name?: string }): Promise<boolean> => {
    try {
      const response = await fetch(`/api/waypoints/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchWaypoints(); // Refresh waypoints
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating waypoint:', error);
      return false;
    }
  };

  const deleteWaypoint = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/waypoints/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchWaypoints(); // Refresh waypoints
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting waypoint:', error);
      return false;
    }
  };

  return {
    waypoints: [...waypoints.userWaypoints, ...waypoints.sharedWaypoints],
    userWaypoints: waypoints.userWaypoints,
    sharedWaypoints: waypoints.sharedWaypoints,
    isLoading,
    createWaypoint,
    updateWaypoint,
    deleteWaypoint,
    refreshWaypoints: fetchWaypoints,
  };
};