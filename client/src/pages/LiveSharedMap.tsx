import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBackgroundResilience } from '@/hooks/useBackgroundResilience';
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Users, 
  MessageCircle, 
  MapPin, 
  Route as RouteIcon, 
  Copy, 
  LogOut, 
  Trash2,
  Send,
  Share2,
  Plus,
  Navigation,
  X,
  UserPlus,
  Check,
  Ruler,
  Eye,
  Satellite,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { PiBirdFill } from "react-icons/pi";
import { cn } from "@/lib/utils";
import type { DroneImage } from "@shared/schema";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Color palette for different users in live map sessions
const MEMBER_COLORS = [
  '#3b82f6', // Blue (current user)
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
];

// Get consistent color for a user based on their position in the members list
const getMemberColor = (userId: number, members: LiveMapMember[], currentUserId?: number): string => {
  if (userId === currentUserId) return MEMBER_COLORS[0]; // Current user always blue
  const otherMembers = members.filter(m => m.userId !== currentUserId).sort((a, b) => a.userId - b.userId);
  const index = otherMembers.findIndex(m => m.userId === userId);
  return MEMBER_COLORS[(index % (MEMBER_COLORS.length - 1)) + 1];
};

interface AuthUser {
  id: number;
  username: string;
  fullName: string | null;
}

interface LiveMapSession {
  id: number;
  ownerId: number;
  name: string;
  shareCode: string;
  isActive: boolean;
  activeDroneLayers: string | null;
  centerLatitude: string | null;
  centerLongitude: string | null;
  zoomLevel: string | null;
  createdAt: string;
}

interface LiveMapMember {
  id: number;
  sessionId: number;
  userId: number;
  role: string;
  latitude: string | null;
  longitude: string | null;
  accuracy: string | null;
  heading: string | null;
  lastActive: string | null;
  user: {
    id: number;
    username: string;
    fullName: string | null;
  };
}

interface LiveMapPoi {
  id: number;
  sessionId: number;
  createdBy: number;
  name: string;
  note: string | null;
  latitude: string;
  longitude: string;
  createdAt: string;
  createdByUser: {
    id: number;
    username: string;
  };
}

interface LiveMapRoute {
  id: number;
  sessionId: number;
  createdBy: number;
  name: string;
  pathCoordinates: string;
  totalDistance: string | null;
  createdAt: string;
  createdByUser: {
    id: number;
    username: string;
  };
}

interface LiveMapMessage {
  id: number;
  sessionId: number;
  userId: number;
  body: string;
  messageType: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
    fullName: string | null;
  };
}

interface SessionData extends LiveMapSession {
  members: LiveMapMember[];
  pois: LiveMapPoi[];
  routes: LiveMapRoute[];
  messages: LiveMapMessage[];
}

interface FriendData {
  id: number;
  userAId: number;
  userBId: number;
  createdAt: string;
  friend: {
    id: number;
    username: string;
    fullName: string | null;
  };
}

export default function LiveSharedMap() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/live-map/:id");
  const { user: rawUser } = useAuth();
  const user = rawUser as AuthUser | undefined;
  const { toast } = useToast();
  
  const [showChat, setShowChat] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [isAddingPoi, setIsAddingPoi] = useState(false);
  const [pendingPoiLocation, setPendingPoiLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [newPoiName, setNewPoiName] = useState("");
  const [newPoiNote, setNewPoiNote] = useState("");
  const [selectedPoi, setSelectedPoi] = useState<LiveMapPoi | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  
  // Local measurement state (not shared with other users)
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurementPath, setMeasurementPath] = useState<mapboxgl.LngLat[]>([]);
  const measurementMarkersRef = useRef<mapboxgl.Marker[]>([]);
  
  // Draw route state
  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [drawRoutePoints, setDrawRoutePoints] = useState<[number, number][]>([]);
  const [showSaveRouteDialog, setShowSaveRouteDialog] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  
  // Shared route viewing/editing state
  const [selectedSharedRoute, setSelectedSharedRoute] = useState<any | null>(null);
  const [isEditingSharedRoute, setIsEditingSharedRoute] = useState(false);
  const [editingRoutePoints, setEditingRoutePoints] = useState<[number, number][]>([]);
  const editRouteMarkersRef = useRef<mapboxgl.Marker[]>([]);
  
  // 3D mode and drone imagery state
  const [is3DMode, setIs3DMode] = useState(false);
  const [activeDroneLayers, setActiveDroneLayers] = useState<Set<number>>(new Set());
  const [droneDropdownOpen, setDroneDropdownOpen] = useState(false);
  const [droneModels, setDroneModels] = useState<Record<number, boolean>>({});
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapInitialized = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const memberMarkersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const poiMarkersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const watchIdRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const drawRouteMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const sharedRouteLayersRef = useRef<string[]>([]);
  const sharedRouteMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const routeHandlersRef = useRef<Array<{ layerId: string; clickHandler: any; enterHandler: any; leaveHandler: any }>>([]);
  const droneDropdownRef = useRef<HTMLDivElement>(null);
  
  // Track path history for each member during the session
  const [memberPaths, setMemberPaths] = useState<Map<number, [number, number][]>>(new Map());
  
  const sessionId = params?.id ? parseInt(params.id) : null;
  
  // Fetch session data
  const { data: session, isLoading, error } = useQuery<SessionData>({
    queryKey: ['/api/live-maps', sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/live-maps/${sessionId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load session');
      return res.json();
    },
    enabled: !!sessionId
  });
  
  const isOwner = session && user && session.ownerId === user.id;
  const isSessionEnded = session && !session.isActive;
  
  // Fetch friends list for inviting
  const { data: friends = [] } = useQuery<FriendData[]>({
    queryKey: ['/api/friends'],
    enabled: showInviteDialog
  });
  
  // Fetch drone images for overlay
  const { data: droneImages = [] } = useQuery<DroneImage[]>({
    queryKey: ['/api/drone-images']
  });

  useEffect(() => {
    if (!droneDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (droneDropdownRef.current && !droneDropdownRef.current.contains(e.target as Node)) {
        setDroneDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [droneDropdownOpen]);

  useEffect(() => {
    if (droneImages && droneImages.length > 0) {
      droneImages.forEach(async (image) => {
        try {
          const response = await fetch(`/api/drone-images/${image.id}/model`);
          setDroneModels(prev => ({ ...prev, [image.id]: response.ok }));
        } catch {
          setDroneModels(prev => ({ ...prev, [image.id]: false }));
        }
      });
    }
  }, [droneImages]);

  const { data: cesiumTilesets = [] } = useQuery<any[]>({
    queryKey: ['/api/cesium-tilesets'],
  });
  const cesiumTilesetsByDroneImage: Record<number, any> = {};
  cesiumTilesets.forEach((t: any) => {
    if (t.droneImageId) cesiumTilesetsByDroneImage[t.droneImageId] = t;
  });

  // Get friends not already in session
  const availableFriends = friends.filter(f => 
    !session?.members.some(m => m.userId === f.friend.id)
  );
  
  // Track which friends have been invited (pending invites)
  const [invitedFriends, setInvitedFriends] = useState<Set<number>>(new Set());
  
  // Send invite mutation
  const sendInviteMutation = useMutation({
    mutationFn: async (toUserId: number) => {
      return apiRequest('POST', `/api/live-maps/${sessionId}/invites`, { toUserId });
    },
    onSuccess: (_data, toUserId) => {
      setInvitedFriends(prev => new Set([...Array.from(prev), toUserId]));
      const friend = availableFriends.find(f => f.friend.id === toUserId);
      toast({ 
        title: "Invite sent!", 
        description: `${friend?.friend.fullName || friend?.friend.username} will see your invite when they open the app` 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to send invite", 
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (body: string) => {
      return apiRequest('POST', `/api/live-maps/${sessionId}/messages`, { body });
    },
    onSuccess: () => {
      setMessageInput("");
    }
  });
  
  // Create POI mutation
  const createPoiMutation = useMutation({
    mutationFn: async (data: { name: string; latitude: number; longitude: number; note?: string }) => {
      return apiRequest('POST', `/api/live-maps/${sessionId}/pois`, data);
    },
    onSuccess: () => {
      setIsAddingPoi(false);
      setNewPoiName("");
      queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
    }
  });
  
  // Delete POI mutation
  const deletePoiMutation = useMutation({
    mutationFn: async (poiId: number) => {
      return apiRequest('DELETE', `/api/live-maps/${sessionId}/pois/${poiId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
      toast({ title: "Waypoint deleted", description: "Waypoint has been removed from the map" });
    }
  });
  
  // Save route mutation
  const saveRouteMutation = useMutation({
    mutationFn: async (data: { name: string; pathCoordinates: string }) => {
      return apiRequest('POST', `/api/live-maps/${sessionId}/routes`, data);
    },
    onSuccess: () => {
      setShowSaveRouteDialog(false);
      setNewRouteName("");
      setDrawRoutePoints([]);
      setIsDrawingRoute(false);
      drawRouteMarkersRef.current.forEach(m => m.remove());
      drawRouteMarkersRef.current = [];
      queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
      toast({ title: "Route saved!", description: "Route has been shared with the team" });
    }
  });
  
  // Update route mutation
  const updateRouteMutation = useMutation({
    mutationFn: async (data: { routeId: number; name: string; pathCoordinates: string }) => {
      return apiRequest('PUT', `/api/live-maps/${sessionId}/routes/${data.routeId}`, {
        name: data.name,
        pathCoordinates: data.pathCoordinates
      });
    },
    onSuccess: () => {
      exitRouteEditMode();
      queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
      toast({ title: "Route updated!", description: "Changes saved" });
    }
  });
  
  // Delete route mutation
  const deleteRouteMutation = useMutation({
    mutationFn: async (routeId: number) => {
      return apiRequest('DELETE', `/api/live-maps/${sessionId}/routes/${routeId}`);
    },
    onSuccess: () => {
      setSelectedSharedRoute(null);
      queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
      toast({ title: "Route deleted", description: "Route has been removed" });
    }
  });
  
  // Exit route edit mode helper
  const exitRouteEditMode = useCallback(() => {
    editRouteMarkersRef.current.forEach(m => m.remove());
    editRouteMarkersRef.current = [];
    setIsEditingSharedRoute(false);
    setEditingRoutePoints([]);
    if (map.current) {
      if (map.current.getLayer('edit-route-line')) map.current.removeLayer('edit-route-line');
      if (map.current.getSource('edit-route-line')) map.current.removeSource('edit-route-line');
    }
  }, []);
  
  // Helper function to calculate total distance of a path
  const calculatePathDistance = (path: [number, number][]): number => {
    if (path.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const [lng1, lat1] = path[i - 1];
      const [lng2, lat2] = path[i];
      // Haversine formula
      const R = 6371000; // meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      total += R * c;
    }
    return total;
  };
  
  // Save all member paths as routes before ending session
  const saveSessionPathsAsRoutes = async (): Promise<number> => {
    let savedCount = 0;
    
    for (const [userId, path] of Array.from(memberPaths.entries())) {
      if (path.length < 2) continue;
      
      // Find the member info
      const member = session?.members.find(m => m.userId === userId);
      const memberName = member?.user.fullName || member?.user.username || `User ${userId}`;
      
      const distance = calculatePathDistance(path);
      const routeName = `${session?.name || 'Live Team Map'} - ${memberName}'s Path`;
      
      try {
        await apiRequest('POST', '/api/routes', {
          name: routeName,
          description: `Path recorded during live map session "${session?.name}" on ${new Date().toLocaleDateString()}`,
          waypointIds: JSON.stringify([]),
          pathCoordinates: JSON.stringify(path.map(([lng, lat]) => ({ lat, lng }))),
          totalDistance: String(Math.round(distance)),
          elevationGain: "0",
          elevationLoss: "0",
          estimatedTime: 0,
          routingMode: 'recorded'
        });
        savedCount++;
      } catch (error) {
        console.error(`Failed to save path for user ${userId}:`, error);
      }
    }
    
    return savedCount;
  };
  
  // Leave session mutation
  const leaveMutation = useMutation({
    mutationFn: async () => {
      // Save my path as a route before leaving
      const myPath = memberPaths.get(user?.id || 0);
      if (myPath && myPath.length >= 2) {
        const distance = calculatePathDistance(myPath);
        await apiRequest('POST', '/api/routes', {
          name: `${session?.name || 'Live Team Map'} - My Path`,
          description: `Path recorded during live map session "${session?.name}" on ${new Date().toLocaleDateString()}`,
          waypointIds: JSON.stringify([]),
          pathCoordinates: JSON.stringify(myPath.map(([lng, lat]) => ({ lat, lng }))),
          totalDistance: String(Math.round(distance)),
          elevationGain: "0",
          elevationLoss: "0",
          estimatedTime: 0,
          routingMode: 'recorded'
        });
      }
      return apiRequest('POST', `/api/live-maps/${sessionId}/leave`);
    },
    onSuccess: () => {
      toast({ title: "Left session", description: "Your path has been saved as a route" });
      setLocation("/");
    }
  });
  
  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Save all member paths as routes before ending
      const savedCount = await saveSessionPathsAsRoutes();
      return apiRequest('DELETE', `/api/live-maps/${sessionId}`);
    },
    onSuccess: () => {
      toast({ title: "Session ended", description: "All paths have been saved as routes" });
      setLocation("/");
    }
  });
  
  // Toggle 2D/3D mode
  const toggle3DMode = () => {
    if (!map.current) return;
    
    const m = map.current;
    
    if (!is3DMode) {
      // Enable 3D mode
      if (!m.getSource('mapbox-dem')) {
        m.addSource('mapbox-dem', {
          'type': 'raster-dem',
          'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
          'tileSize': 512,
          'maxzoom': 14
        });
      }
      m.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
      m.easeTo({ pitch: 45, bearing: 0, duration: 1000 });
    } else {
      // Disable 3D mode
      m.setTerrain(null);
      m.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
    }
    
    setIs3DMode(!is3DMode);
  };
  
  // Toggle drone imagery layer
  const toggleDroneLayer = (droneImage: DroneImage, enabled: boolean) => {
    if (!map.current) return;
    
    const m = map.current;
    const layerId = `drone-imagery-${droneImage.id}`;
    const sourceId = `drone-source-${droneImage.id}`;
    
    if (enabled) {
      // Add drone imagery
      const imageUrl = `/api/drone-images/${droneImage.id}/file`;
      
      const centerLat = (parseFloat(droneImage.northEastLat) + parseFloat(droneImage.southWestLat)) / 2;
      const centerLng = (parseFloat(droneImage.northEastLng) + parseFloat(droneImage.southWestLng)) / 2;
      const latRange = parseFloat(droneImage.northEastLat) - parseFloat(droneImage.southWestLat);
      const lngRange = parseFloat(droneImage.northEastLng) - parseFloat(droneImage.southWestLng);
      
      const neLat = centerLat + (latRange / 2);
      const swLat = centerLat - (latRange / 2);
      const neLng = centerLng + (lngRange / 2);
      const swLng = centerLng - (lngRange / 2);
      
      if (!m.getSource(sourceId)) {
        m.addSource(sourceId, {
          'type': 'image',
          'url': imageUrl,
          'coordinates': [
            [swLng, neLat],
            [neLng, neLat],
            [neLng, swLat],
            [swLng, swLat]
          ]
        });
      }
      
      if (!m.getLayer(layerId)) {
        m.addLayer({
          'id': layerId,
          'type': 'raster',
          'source': sourceId,
          'paint': { 'raster-opacity': 0.85 }
        });
      }
      
      // Fly to the drone imagery location
      m.flyTo({
        center: [centerLng, centerLat],
        zoom: 15
      });
      
      setActiveDroneLayers(prev => new Set([...Array.from(prev), droneImage.id]));
    } else {
      // Remove drone imagery
      if (m.getLayer(layerId)) m.removeLayer(layerId);
      if (m.getSource(sourceId)) m.removeSource(sourceId);
      
      setActiveDroneLayers(prev => {
        const next = new Set(prev);
        next.delete(droneImage.id);
        return next;
      });
    }
  };
  
  // Initialize map - only once when session is available and container exists
  useEffect(() => {
    if (!mapContainer.current || mapInitialized.current || !session) return;
    
    mapInitialized.current = true;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-110.8, 43.5],
      zoom: 10
    });
    
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        mapInitialized.current = false;
        // Clear marker refs when map is destroyed
        memberMarkersRef.current.clear();
        poiMarkersRef.current.clear();
      }
    };
  }, [session?.id]); // Only depend on session ID, not entire session object
  
  // Handle map click for POI creation or measurement
  useEffect(() => {
    if (!map.current) return;
    
    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (isAddingPoi) {
        setPendingPoiLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        setIsAddingPoi(false);
      } else if (isMeasuring) {
        setMeasurementPath(prev => [...prev, e.lngLat]);
      } else if (isDrawingRoute && !isEditingSharedRoute) {
        setDrawRoutePoints(prev => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      }
    };
    
    map.current.on('click', handleClick);
    
    if ((isMeasuring || isDrawingRoute) && map.current) {
      map.current.getCanvas().style.cursor = 'crosshair';
    } else if (map.current) {
      map.current.getCanvas().style.cursor = '';
    }
    
    return () => {
      map.current?.off('click', handleClick);
      if (map.current) {
        map.current.getCanvas().style.cursor = '';
      }
    };
  }, [isAddingPoi, isMeasuring, isDrawingRoute]);
  
  // Draw measurement path (local only - not shared)
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;
    
    // Format distance helper
    const formatDistance = (meters: number) => {
      const feet = meters * 3.28084;
      const miles = meters * 0.000621371;
      if (meters < 1000) {
        return `${Math.round(meters)}m / ${Math.round(feet)}ft`;
      }
      return `${(meters / 1000).toFixed(2)}km / ${miles.toFixed(2)}mi`;
    };
    
    // Remove existing layers
    if (m.getLayer('local-measurement-line')) m.removeLayer('local-measurement-line');
    if (m.getSource('local-measurement-line')) m.removeSource('local-measurement-line');
    
    // Remove existing markers
    measurementMarkersRef.current.forEach(marker => marker.remove());
    measurementMarkersRef.current = [];
    
    // Remove segment labels
    document.querySelectorAll('.live-map-measurement-label').forEach(el => el.remove());
    
    if (measurementPath.length === 0) return;
    
    // Draw line if we have 2+ points
    if (measurementPath.length >= 2) {
      m.addSource('local-measurement-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: measurementPath.map(p => [p.lng, p.lat])
          }
        }
      });
      
      m.addLayer({
        id: 'local-measurement-line',
        type: 'line',
        source: 'local-measurement-line',
        paint: {
          'line-color': '#FF6B35',
          'line-width': 4,
          'line-opacity': 0.9
        }
      });
      
      // Add segment labels
      for (let i = 1; i < measurementPath.length; i++) {
        const p1 = measurementPath[i - 1];
        const p2 = measurementPath[i];
        const dist = p1.distanceTo(p2);
        const midLng = (p1.lng + p2.lng) / 2;
        const midLat = (p1.lat + p2.lat) / 2;
        
        const labelEl = document.createElement('div');
        labelEl.className = 'live-map-measurement-label';
        labelEl.style.cssText = `
          position: absolute;
          background: rgba(0, 0, 0, 0.75);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          pointer-events: none;
          z-index: 999;
          white-space: nowrap;
          transform: translate(-50%, -50%);
        `;
        labelEl.textContent = formatDistance(dist);
        
        const screenPos = m.project([midLng, midLat]);
        labelEl.style.left = `${screenPos.x}px`;
        labelEl.style.top = `${screenPos.y - 15}px`;
        
        m.getContainer().appendChild(labelEl);
      }
    }
    
    // Create numbered markers for each point
    measurementPath.forEach((point, index) => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background: #FF6B35;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: bold;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      `;
      el.textContent = String(index + 1);
      
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(m);
      
      measurementMarkersRef.current.push(marker);
    });
    
    // Update labels on map move
    const updateLabels = () => {
      const labels = document.querySelectorAll('.live-map-measurement-label');
      labels.forEach((label, i) => {
        if (i < measurementPath.length - 1) {
          const p1 = measurementPath[i];
          const p2 = measurementPath[i + 1];
          const midLng = (p1.lng + p2.lng) / 2;
          const midLat = (p1.lat + p2.lat) / 2;
          const screenPos = m.project([midLng, midLat]);
          (label as HTMLElement).style.left = `${screenPos.x}px`;
          (label as HTMLElement).style.top = `${screenPos.y - 15}px`;
        }
      });
    };
    
    m.on('move', updateLabels);
    
    return () => {
      m.off('move', updateLabels);
    };
  }, [measurementPath]);
  
  // Clear measurement when exiting measurement mode
  const clearMeasurement = useCallback(() => {
    setMeasurementPath([]);
    measurementMarkersRef.current.forEach(marker => marker.remove());
    measurementMarkersRef.current = [];
    document.querySelectorAll('.live-map-measurement-label').forEach(el => el.remove());
    if (map.current) {
      if (map.current.getLayer('local-measurement-line')) map.current.removeLayer('local-measurement-line');
      if (map.current.getSource('local-measurement-line')) map.current.removeSource('local-measurement-line');
    }
  }, []);
  
  // Calculate total measurement distance
  const totalMeasurementDistance = measurementPath.length >= 2
    ? measurementPath.slice(1).reduce((total, point, i) => total + measurementPath[i].distanceTo(point), 0)
    : 0;
  
  // Draw route path on map
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;
    
    if (m.getLayer('draw-route-line')) m.removeLayer('draw-route-line');
    if (m.getSource('draw-route-line')) m.removeSource('draw-route-line');
    
    drawRouteMarkersRef.current.forEach(marker => marker.remove());
    drawRouteMarkersRef.current = [];
    
    if (drawRoutePoints.length === 0) return;
    
    if (drawRoutePoints.length >= 2) {
      m.addSource('draw-route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: drawRoutePoints
          }
        }
      });
      
      m.addLayer({
        id: 'draw-route-line',
        type: 'line',
        source: 'draw-route-line',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-dasharray': [2, 2]
        }
      });
    }
    
    drawRoutePoints.forEach((point, index) => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: bold;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      `;
      el.textContent = String(index + 1);
      
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([point[0], point[1]])
        .addTo(m);
      
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setDrawRoutePoints(prev => {
          const updated = [...prev];
          updated[index] = [lngLat.lng, lngLat.lat];
          return updated;
        });
      });
      
      drawRouteMarkersRef.current.push(marker);
    });
  }, [drawRoutePoints]);
  
  // Render shared routes on map
  useEffect(() => {
    if (!session?.routes || !map.current) return;
    const m = map.current;
    
    routeHandlersRef.current.forEach(({ layerId, clickHandler, enterHandler, leaveHandler }) => {
      if (m.getLayer(layerId)) {
        m.off('click', layerId, clickHandler);
        m.off('mouseenter', layerId, enterHandler);
        m.off('mouseleave', layerId, leaveHandler);
      }
    });
    routeHandlersRef.current = [];
    sharedRouteLayersRef.current.forEach(sourceId => {
      const layerId = sourceId.replace('shared-route-', 'shared-route-line-');
      if (m.getLayer(layerId)) m.removeLayer(layerId);
      if (m.getSource(sourceId)) m.removeSource(sourceId);
    });
    sharedRouteLayersRef.current = [];
    
    sharedRouteMarkersRef.current.forEach(marker => marker.remove());
    sharedRouteMarkersRef.current = [];
    
    session.routes.forEach(route => {
      const sourceId = `shared-route-${route.id}`;
      const layerId = `shared-route-line-${route.id}`;
      
      try {
        const coords: { lat: number; lng: number }[] = JSON.parse(route.pathCoordinates);
        if (coords.length < 2) return;
        
        const lngLatCoords = coords.map(c => [c.lng, c.lat] as [number, number]);
        
        m.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: lngLatCoords
            }
          }
        });
        
        m.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#10b981',
            'line-width': 3,
            'line-opacity': 0.8
          }
        });
        
        const clickHandler = (e: mapboxgl.MapLayerMouseEvent) => {
          e.originalEvent.stopPropagation();
          setSelectedSharedRoute(route);
        };
        const enterHandler = () => { m.getCanvas().style.cursor = 'pointer'; };
        const leaveHandler = () => { m.getCanvas().style.cursor = ''; };
        m.on('click', layerId, clickHandler);
        m.on('mouseenter', layerId, enterHandler);
        m.on('mouseleave', layerId, leaveHandler);
        
        sharedRouteLayersRef.current.push(sourceId);
        routeHandlersRef.current.push({ layerId, clickHandler, enterHandler, leaveHandler });
        
        const startEl = document.createElement('div');
        startEl.style.cssText = `width:12px;height:12px;background:#10b981;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);`;
        const startMarker = new mapboxgl.Marker({ element: startEl })
          .setLngLat(lngLatCoords[0])
          .addTo(m);
        sharedRouteMarkersRef.current.push(startMarker);
        
        const endEl = document.createElement('div');
        endEl.style.cssText = `width:12px;height:12px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);`;
        const endMarker = new mapboxgl.Marker({ element: endEl })
          .setLngLat(lngLatCoords[lngLatCoords.length - 1])
          .addTo(m);
        sharedRouteMarkersRef.current.push(endMarker);
      } catch (e) {
        console.error('Failed to parse route coordinates:', e);
      }
    });
    
    return () => {
      routeHandlersRef.current.forEach(({ layerId, clickHandler, enterHandler, leaveHandler }) => {
        if (m.getLayer(layerId)) {
          m.off('click', layerId, clickHandler);
          m.off('mouseenter', layerId, enterHandler);
          m.off('mouseleave', layerId, leaveHandler);
        }
      });
      routeHandlersRef.current = [];
      sharedRouteLayersRef.current.forEach(sourceId => {
        const layerId = sourceId.replace('shared-route-', 'shared-route-line-');
        if (m.getLayer(layerId)) m.removeLayer(layerId);
        if (m.getSource(sourceId)) m.removeSource(sourceId);
      });
      sharedRouteLayersRef.current = [];
      sharedRouteMarkersRef.current.forEach(marker => marker.remove());
      sharedRouteMarkersRef.current = [];
    };
  }, [session?.routes]);
  
  // Render edit mode markers and line for shared route editing
  useEffect(() => {
    if (!map.current || !isEditingSharedRoute) return;
    const m = map.current;
    
    if (m.getLayer('edit-route-line')) m.removeLayer('edit-route-line');
    if (m.getSource('edit-route-line')) m.removeSource('edit-route-line');
    
    editRouteMarkersRef.current.forEach(marker => marker.remove());
    editRouteMarkersRef.current = [];
    
    if (editingRoutePoints.length === 0) return;
    
    if (editingRoutePoints.length >= 2) {
      m.addSource('edit-route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: editingRoutePoints
          }
        }
      });
      
      m.addLayer({
        id: 'edit-route-line',
        type: 'line',
        source: 'edit-route-line',
        paint: {
          'line-color': '#f59e0b',
          'line-width': 4,
          'line-dasharray': [2, 2]
        }
      });
    }
    
    editingRoutePoints.forEach((point, index) => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background: #f59e0b;
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: bold;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: grab;
      `;
      el.textContent = String(index + 1);
      
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([point[0], point[1]])
        .addTo(m);
      
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setEditingRoutePoints(prev => {
          const updated = [...prev];
          updated[index] = [lngLat.lng, lngLat.lat];
          return updated;
        });
      });
      
      editRouteMarkersRef.current.push(marker);
    });
  }, [editingRoutePoints, isEditingSharedRoute]);
  
  // Connect to WebSocket with reconnection
  useEffect(() => {
    if (!sessionId || !user) return;
    
    intentionalCloseRef.current = false;
    
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;
      
      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        ws.send(JSON.stringify({ type: 'auth', userId: user.id }));
        ws.send(JSON.stringify({ type: 'session:join', sessionId }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'member:locationUpdate':
            updateMemberMarker(data.data.userId, data.data.latitude, data.data.longitude);
            break;
          case 'member:joined':
          case 'member:left':
          case 'member:disconnected':
            queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
            break;
          case 'message:new':
            queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
            break;
          case 'poi:created':
          case 'poi:deleted':
            queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
            break;
          case 'route:created':
          case 'route:deleted':
          case 'route:updated':
            queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
            break;
          case 'session:ended':
            toast({ 
              title: "Session ended", 
              description: "The session owner has ended this live team map" 
            });
            setLocation("/");
            break;
        }
      };
      
      ws.onerror = () => {
        console.error('WebSocket error');
      };
      
      ws.onclose = () => {
        if (!intentionalCloseRef.current) {
          const attempt = reconnectAttemptRef.current;
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          reconnectAttemptRef.current = attempt + 1;
          toast({
            title: "Reconnecting...",
            description: `Connection lost. Retrying in ${Math.round(delay / 1000)}s...`,
          });
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };
    };
    
    connect();
    
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionId, user]);
  
  // Chat auto-scroll
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, showChat]);
  
  // Start location tracking
  useEffect(() => {
    if (!wsRef.current || !user) return;
    
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, heading } = position.coords;
          
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'session:location',
              latitude,
              longitude,
              accuracy,
              heading
            }));
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
    
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user]);
  
  // Update member markers on map and track path history
  const updateMemberMarker = useCallback((userId: number, lat: number, lng: number) => {
    if (!map.current || !session?.members) return;
    
    const color = getMemberColor(userId, session.members, user?.id);
    
    // Add to path history
    setMemberPaths(prev => {
      const newPaths = new Map(prev);
      const currentPath = newPaths.get(userId) || [];
      // Only add if significantly different from last point (5m threshold)
      const lastPoint = currentPath[currentPath.length - 1];
      if (!lastPoint || 
          Math.abs(lastPoint[0] - lng) > 0.00005 || 
          Math.abs(lastPoint[1] - lat) > 0.00005) {
        newPaths.set(userId, [...currentPath, [lng, lat] as [number, number]]);
      }
      return newPaths;
    });
    
    const existingMarker = memberMarkersRef.current.get(userId);
    if (existingMarker) {
      existingMarker.setLngLat([lng, lat]);
      // Update marker color if needed
      const el = existingMarker.getElement();
      if (el) {
        el.style.background = color;
      }
    } else {
      // Create colored marker for member with pulsing animation for current user
      const el = document.createElement('div');
      el.className = 'member-marker';
      const isCurrentUser = userId === user?.id;
      el.style.cssText = `
        width: ${isCurrentUser ? '28px' : '24px'};
        height: ${isCurrentUser ? '28px' : '24px'};
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        ${isCurrentUser ? 'animation: pulse 2s ease-in-out infinite;' : ''}
      `;
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(map.current);
      
      memberMarkersRef.current.set(userId, marker);
    }
  }, [user, session?.members]);
  
  const handleLiveMapResume = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log('Live Map: Reconnecting WebSocket after background...');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (user) {
          ws.send(JSON.stringify({ type: 'auth', userId: user.id }));
          ws.send(JSON.stringify({ type: 'session:join', sessionId }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'member:locationUpdate':
              updateMemberMarker(data.data.userId, data.data.latitude, data.data.longitude);
              break;
            case 'member:joined':
            case 'member:left':
            case 'member:disconnected':
            case 'message:new':
            case 'poi:created':
            case 'poi:deleted':
            case 'route:created':
            case 'route:deleted':
            case 'route:updated':
              queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });
              break;
          }
        } catch (e) {
          console.error('WS message parse error:', e);
        }
      };

      ws.onerror = () => {
        console.error('Live Map: WebSocket reconnection failed');
      };
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy, heading } = position.coords;
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'session:location',
              latitude,
              longitude,
              accuracy,
              heading
            }));
          }
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
    }

    queryClient.invalidateQueries({ queryKey: ['/api/live-maps', sessionId] });

    console.log('Live Map: Fully resumed after background');
  }, [user, sessionId, updateMemberMarker, queryClient]);

  useBackgroundResilience({
    isActive: !!sessionId && !!user,
    onForegroundResume: handleLiveMapResume,
    label: 'LiveTeamMap',
  });
  
  // Render member markers from session data
  useEffect(() => {
    if (!session?.members || !map.current) return;
    
    session.members.forEach(member => {
      if (member.latitude && member.longitude) {
        updateMemberMarker(
          member.userId, 
          parseFloat(member.latitude), 
          parseFloat(member.longitude)
        );
      }
    });
  }, [session?.members, updateMemberMarker]);
  
  // Draw path lines for each member on the map
  useEffect(() => {
    if (!map.current || !session?.members) return;
    
    const m = map.current;
    
    // Update or create path lines for each member
    memberPaths.forEach((path, userId) => {
      if (path.length < 2) return;
      
      const sourceId = `member-path-${userId}`;
      const layerId = `member-path-line-${userId}`;
      const color = getMemberColor(userId, session.members, user?.id);
      
      const geojsonData: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: path
        }
      };
      
      if (m.getSource(sourceId)) {
        // Update existing source
        (m.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojsonData);
      } else {
        // Create new source and layer
        m.addSource(sourceId, {
          type: 'geojson',
          data: geojsonData
        });
        
        m.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': color,
            'line-width': 2,
            'line-opacity': 0.7
          }
        });
      }
    });
  }, [memberPaths, session?.members, user?.id]);
  
  // Render POI markers
  useEffect(() => {
    if (!session?.pois || !map.current) return;
    
    // Remove old markers that no longer exist
    poiMarkersRef.current.forEach((marker, id) => {
      if (!session.pois.find(p => p.id === id)) {
        marker.remove();
        poiMarkersRef.current.delete(id);
      }
    });
    
    // Add new markers
    session.pois.forEach(poi => {
      if (!poiMarkersRef.current.has(poi.id)) {
        const el = document.createElement('div');
        el.className = 'poi-marker';
        el.style.cssText = `
          width: 28px;
          height: 28px;
          background: #f97316;
          border: 2px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
        `;
        el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="white" stroke-width="2"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`;
        
        // Click handler to show waypoint details dialog
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedPoi(poi);
        });
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat([parseFloat(poi.longitude), parseFloat(poi.latitude)])
          .addTo(map.current!);
        
        poiMarkersRef.current.set(poi.id, marker);
      }
    });
  }, [session?.pois]);
  
  const handleCopyShareCode = () => {
    if (session?.shareCode) {
      navigator.clipboard.writeText(session.shareCode);
      toast({ title: "Copied!", description: "Share code copied to clipboard" });
    }
  };
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessageMutation.mutate(messageInput.trim());
    }
  };
  
  if (!match) {
    return null;
  }
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading live team map...</div>
      </div>
    );
  }
  
  if (error || !session) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-red-500">Failed to load live team map session</p>
            <Button onClick={() => setLocation("/")} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Session Ended Banner */}
      {isSessionEnded && (
        <div className="bg-amber-600 text-white px-4 py-2 text-center text-sm flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" />
          This session has ended. You are viewing a read-only archive.
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-white">
              {session.name}
              {isSessionEnded && <span className="text-amber-400 ml-2 text-sm">(Ended)</span>}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Share2 className="w-3 h-3 mr-1" />
                {session.shareCode}
              </Badge>
              {!isSessionEnded && (
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleCopyShareCode}>
                  <Copy className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isSessionEnded ? (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Map
            </Button>
          ) : isOwner ? (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => deleteMutation.mutate()}
              data-testid="button-end-session"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              End Session
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => leaveMutation.mutate()}
              data-testid="button-leave-session"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave
            </Button>
          )}
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Map - use absolute positioning for reliable Mapbox rendering */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />
          
          {/* Unified Toolbar */}
          <div className={cn(
            "absolute left-0 right-0 px-2 sm:px-4 transition-all duration-300 z-20"
          )} style={{ bottom: 'calc(max(4px, env(safe-area-inset-bottom, 4px)) + 34px)' }}>
            <div className="flex justify-center">
              <div className="relative max-w-full">
                <div className="bg-[#1a1a1a] rounded-2xl px-1 sm:px-2 py-2 flex items-center space-x-0.5 shadow-2xl border border-white/10">

                  {/* 2D/3D Toggle */}
                  <button
                    onClick={toggle3DMode}
                    className={cn(
                      "layer-toggle-btn bg-dark-gray/50 rounded-full p-1.5 sm:p-2 min-w-[38px] sm:min-w-[44px] min-h-[38px] sm:min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                      is3DMode && "active ring-2 ring-primary"
                    )}
                    data-testid="button-toggle-3d"
                  >
                    {is3DMode ? <Satellite className="h-5 w-5 text-sky-400" /> : <Eye className="h-5 w-5 text-sky-400" />}
                    <span className="text-[10px] mt-0.5">{is3DMode ? '3D' : '2D'}</span>
                  </button>

                  {/* Drone Imagery Dropdown */}
                  <div className="relative" ref={droneDropdownRef}>
                    <button
                      onClick={() => setDroneDropdownOpen(!droneDropdownOpen)}
                      className={cn(
                        "layer-toggle-btn bg-dark-gray/50 rounded-full p-1.5 sm:p-2 min-w-[38px] sm:min-w-[44px] min-h-[38px] sm:min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                        (droneDropdownOpen || activeDroneLayers.size > 0) && "active ring-2 ring-primary"
                      )}
                      data-testid="button-drone-imagery"
                    >
                      <PiBirdFill className="h-5 w-5 text-amber-500" />
                      <span className="text-[10px] mt-0.5 flex flex-col items-center leading-tight">
                        <span className="flex items-center">
                          Drone {droneDropdownOpen ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                        </span>
                        <span>Imagery</span>
                      </span>
                    </button>

                    {droneDropdownOpen && (
                      <div className="fixed left-2 right-2 sm:absolute sm:bottom-full sm:mb-2 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 bg-[#1a1a1a] rounded-lg overflow-hidden w-auto sm:w-auto sm:min-w-72 max-w-sm shadow-2xl border border-white/20 z-50" style={{ bottom: 'calc(max(4px, env(safe-area-inset-bottom, 4px)) + 34px + 80px)' }}>
                        <div className="flex items-center justify-between p-3 border-b border-white/20 bg-white/5">
                          <span className="text-xs text-white font-medium">Drone Layers</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDroneDropdownOpen(false); }}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                            aria-label="Close"
                          >
                            <X className="h-4 w-4 text-white/70" />
                          </button>
                        </div>
                        {droneImages.length === 0 ? (
                          <div className="text-xs text-white p-3">No drone imagery available</div>
                        ) : (
                          <div>
                            {droneImages.map((droneImage, index) => {
                              const has3DModel = droneModels[droneImage.id];
                              return (
                                <div
                                  key={droneImage.id}
                                  className={`flex items-center gap-3 p-3 ${index !== droneImages.length - 1 ? 'border-b border-white/20' : ''}`}
                                >
                                  <button
                                    onClick={() => toggleDroneLayer(droneImage, true)}
                                    className="px-4 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                                    title="View 2D overlay on map"
                                  >
                                    View
                                  </button>
                                  {activeDroneLayers.has(droneImage.id) && (
                                    <button
                                      onClick={() => toggleDroneLayer(droneImage, false)}
                                      className="px-4 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                                      title="Hide 2D overlay from map"
                                    >
                                      Hide
                                    </button>
                                  )}
                                  {has3DModel && (
                                    <button
                                      onClick={() => setLocation(`/drone/${droneImage.id}/3d`)}
                                      className="px-3 py-1.5 rounded text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                                      title="Open 3D model viewer"
                                    >
                                      3D Model
                                    </button>
                                  )}
                                  {cesiumTilesetsByDroneImage[droneImage.id] && (
                                    <button
                                      onClick={() => setLocation(`/cesium/${cesiumTilesetsByDroneImage[droneImage.id].id}`)}
                                      className="px-3 py-1.5 rounded text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                                      title="Open 3D Map viewer"
                                    >
                                      3D Map
                                    </button>
                                  )}
                                  <span className="text-sm text-white flex-1 truncate" title={droneImage.name}>
                                    {droneImage.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-12 w-px bg-white/20 self-center"></div>

                  {/* Add Waypoint */}
                  <button
                    onClick={() => setIsAddingPoi(!isAddingPoi)}
                    className={cn(
                      "layer-toggle-btn bg-dark-gray/50 rounded-full p-1.5 sm:p-2 min-w-[38px] sm:min-w-[44px] min-h-[38px] sm:min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                      isAddingPoi && "active ring-2 ring-orange-500"
                    )}
                    data-testid="toolbar-add-waypoint"
                  >
                    <MapPin className="h-5 w-5 text-orange-400" />
                    <span className="text-[10px] mt-0.5">Waypoint</span>
                  </button>

                  {/* Draw Route */}
                  <button
                    onClick={() => {
                      if (isDrawingRoute) {
                        setDrawRoutePoints([]);
                        drawRouteMarkersRef.current.forEach(m => m.remove());
                        drawRouteMarkersRef.current = [];
                      }
                      setIsDrawingRoute(!isDrawingRoute);
                    }}
                    className={cn(
                      "layer-toggle-btn bg-dark-gray/50 rounded-full p-1.5 sm:p-2 min-w-[38px] sm:min-w-[44px] min-h-[38px] sm:min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                      isDrawingRoute && "active ring-2 ring-blue-500"
                    )}
                    data-testid="toolbar-draw-route"
                  >
                    <RouteIcon className="h-5 w-5 text-blue-400" />
                    <span className="text-[10px] mt-0.5">Route</span>
                  </button>

                  {/* My Team */}
                  <button
                    onClick={() => setShowMembers(!showMembers)}
                    className={cn(
                      "layer-toggle-btn bg-dark-gray/50 rounded-full p-1.5 sm:p-2 min-w-[38px] sm:min-w-[44px] min-h-[38px] sm:min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                      showMembers && "active ring-2 ring-green-500"
                    )}
                    data-testid="toolbar-members"
                  >
                    <Users className="h-5 w-5 text-green-400" />
                    <span className="text-[10px] mt-0.5 flex flex-col items-center leading-tight">
                      <span>My</span>
                      <span>Team</span>
                    </span>
                  </button>

                  {/* Messages */}
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className={cn(
                      "layer-toggle-btn bg-dark-gray/50 rounded-full p-1.5 sm:p-2 min-w-[38px] sm:min-w-[44px] min-h-[38px] sm:min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                      showChat && "active ring-2 ring-purple-500"
                    )}
                    data-testid="toolbar-messages"
                  >
                    <MessageCircle className="h-5 w-5 text-purple-400" />
                    <span className="text-[10px] mt-0.5">Chat</span>
                  </button>

                  {/* Measure */}
                  <button
                    onClick={() => {
                      if (isMeasuring) {
                        clearMeasurement();
                      }
                      setIsMeasuring(!isMeasuring);
                    }}
                    className={cn(
                      "layer-toggle-btn bg-dark-gray/50 rounded-full p-1.5 sm:p-2 min-w-[38px] sm:min-w-[44px] min-h-[38px] sm:min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                      isMeasuring && "active ring-2 ring-yellow-500"
                    )}
                    data-testid="toolbar-measure"
                  >
                    <Ruler className="h-5 w-5 text-yellow-400" />
                    <span className="text-[10px] mt-0.5">Measure</span>
                  </button>

                </div>
              </div>
            </div>
          </div>
          
          {/* Measurement Panel - Local only */}
          {isMeasuring && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg border border-gray-700 z-20">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">
                    {measurementPath.length === 0 ? 'Tap on map to start' : `${measurementPath.length} point${measurementPath.length !== 1 ? 's' : ''}`}
                  </p>
                  <p className="text-lg font-bold text-white">
                    {measurementPath.length >= 2 
                      ? `Total: ${totalMeasurementDistance < 1000 
                          ? `${Math.round(totalMeasurementDistance)}m / ${Math.round(totalMeasurementDistance * 3.28084)}ft`
                          : `${(totalMeasurementDistance / 1000).toFixed(2)}km / ${(totalMeasurementDistance * 0.000621371).toFixed(2)}mi`}`
                      : 'Tap to add points'}
                  </p>
                </div>
                {measurementPath.length > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={clearMeasurement}
                    data-testid="button-clear-measurement"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearMeasurement();
                    setIsMeasuring(false);
                  }}
                  data-testid="button-done-measurement"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
          
          {/* Draw Route Mode Banner */}
          {isDrawingRoute && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg border border-blue-500 z-20">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">
                    {drawRoutePoints.length === 0 ? 'Tap on map to start drawing' : `${drawRoutePoints.length} point${drawRoutePoints.length !== 1 ? 's' : ''}`}
                  </p>
                  <p className="text-lg font-bold text-white">
                    {drawRoutePoints.length >= 2
                      ? `${(calculatePathDistance(drawRoutePoints) * 0.000621371).toFixed(2)} miles`
                      : 'Tap to add points'}
                  </p>
                </div>
                {drawRoutePoints.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDrawRoutePoints(prev => prev.slice(0, -1))}
                  >
                    Undo
                  </Button>
                )}
                {drawRoutePoints.length >= 2 && (
                  <Button
                    size="sm"
                    onClick={() => setShowSaveRouteDialog(true)}
                  >
                    Save
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setDrawRoutePoints([]);
                    drawRouteMarkersRef.current.forEach(m => m.remove());
                    drawRouteMarkersRef.current = [];
                    setIsDrawingRoute(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          
          {/* Edit Shared Route Mode Toolbar */}
          {isEditingSharedRoute && selectedSharedRoute && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg border border-amber-500 z-20">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">
                    Editing: {selectedSharedRoute.name}
                  </p>
                  <p className="text-lg font-bold text-white">
                    {editingRoutePoints.length >= 2
                      ? `${(calculatePathDistance(editingRoutePoints) * 0.000621371).toFixed(2)} miles`
                      : `${editingRoutePoints.length} points`}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600"
                  onClick={() => {
                    if (selectedSharedRoute && editingRoutePoints.length >= 2) {
                      updateRouteMutation.mutate({
                        routeId: selectedSharedRoute.id,
                        name: selectedSharedRoute.name,
                        pathCoordinates: JSON.stringify(editingRoutePoints.map(([lng, lat]) => ({ lat, lng })))
                      });
                    }
                  }}
                  disabled={updateRouteMutation.isPending}
                >
                  {updateRouteMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    exitRouteEditMode();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          
          {/* Route Detail Panel */}
          {selectedSharedRoute && !isEditingSharedRoute && (
            <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-20 w-80 max-w-[90vw]">
              <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl px-4 py-4 shadow-lg border border-gray-700">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-base truncate">{selectedSharedRoute.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      by {selectedSharedRoute.createdByUser?.username || 'Unknown'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setSelectedSharedRoute(null)}
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-4 mb-3 text-sm">
                  <div className="text-gray-300">
                    <span className="text-white font-medium">
                      {(() => {
                        try {
                          const coords: {lat: number; lng: number}[] = JSON.parse(selectedSharedRoute.pathCoordinates);
                          const lngLatCoords = coords.map(c => [c.lng, c.lat] as [number, number]);
                          return `${(calculatePathDistance(lngLatCoords) * 0.000621371).toFixed(2)} mi`;
                        } catch { return '—'; }
                      })()}
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="text-gray-300">
                    <span className="text-white font-medium">
                      {(() => {
                        try {
                          return JSON.parse(selectedSharedRoute.pathCoordinates).length;
                        } catch { return 0; }
                      })()}
                    </span> pts
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {(selectedSharedRoute.createdBy === user?.id || isOwner) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          try {
                            const coords: {lat: number; lng: number}[] = JSON.parse(selectedSharedRoute.pathCoordinates);
                            const lngLatCoords = coords.map(c => [c.lng, c.lat] as [number, number]);
                            setEditingRoutePoints(lngLatCoords);
                            setIsEditingSharedRoute(true);
                          } catch (e) {
                            console.error('Failed to parse route for editing:', e);
                          }
                        }}
                      >
                        <RouteIcon className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          deleteRouteMutation.mutate(selectedSharedRoute.id);
                        }}
                        disabled={deleteRouteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Add Waypoint Mode Banner */}
          {isAddingPoi && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 z-20">
              <MapPin className="w-5 h-5" />
              <span>Tap on map to place waypoint</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 hover:bg-orange-600"
                onClick={() => {
                  setIsAddingPoi(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        
        {/* Members Full-Screen Overlay */}
        {showMembers && (
          <div className="absolute inset-0 bg-gray-900 z-30 flex flex-col">
            {/* Header with close button */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                My Team ({session.members.length})
              </h3>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-10 w-10 rounded-full hover:bg-gray-700"
                onClick={() => setShowMembers(false)}
                data-testid="button-close-members"
              >
                <X className="w-6 h-6 text-white" />
              </Button>
            </div>
            
            {/* Invite Friends Button */}
            <div className="p-4 border-b border-gray-700">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowInviteDialog(true)}
                data-testid="button-invite-friends"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Friends
              </Button>
            </div>
            
            {/* Members List */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {session.members.map(member => (
                  <div 
                    key={member.id} 
                    className="flex items-center gap-4 p-3 rounded-xl bg-gray-800"
                    data-testid={`member-${member.userId}`}
                  >
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                      style={{ background: getMemberColor(member.userId, session?.members || [], user?.id) }}
                    >
                      {member.user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-base font-medium truncate">
                        {member.user.fullName || member.user.username}
                        {member.userId === user?.id && ' (You)'}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {member.role === 'owner' ? 'Host' : 'Participant'}
                      </p>
                    </div>
                    {member.latitude && (
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-10 w-10"
                        onClick={() => {
                          setShowMembers(false);
                          map.current?.flyTo({
                            center: [parseFloat(member.longitude!), parseFloat(member.latitude!)],
                            zoom: 15
                          });
                        }}
                      >
                        <Navigation className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {/* Waypoints Section */}
            <div className="border-t border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-medium text-gray-300 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Waypoints ({session.pois.length})
                </h4>
              </div>
              {session.pois.length > 0 ? (
                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {session.pois.map(poi => (
                      <div 
                        key={poi.id} 
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-800 cursor-pointer"
                        onClick={() => {
                          setSelectedPoi(poi);
                          setShowMembers(false);
                          map.current?.flyTo({
                            center: [parseFloat(poi.longitude), parseFloat(poi.latitude)],
                            zoom: 16
                          });
                        }}
                        data-testid={`waypoint-${poi.id}`}
                      >
                        <MapPin className="w-5 h-5 text-orange-400" />
                        <span className="flex-1 text-gray-200 truncate">{poi.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePoiMutation.mutate(poi.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-gray-500 text-sm">No waypoints added yet</p>
              )}
            </div>
          </div>
        )}
        
        {/* Chat Full-Screen Overlay */}
        {showChat && (
          <div className="absolute inset-0 bg-gray-900 z-30 flex flex-col">
            {/* Header with close button */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Messages
              </h3>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-10 w-10 rounded-full hover:bg-gray-700"
                onClick={() => setShowChat(false)}
                data-testid="button-close-chat"
              >
                <X className="w-6 h-6 text-white" />
              </Button>
            </div>
            
            {/* Messages List */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {session.messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No messages yet. Start the conversation!</p>
                ) : (
                  session.messages.map(msg => (
                    <div 
                      key={msg.id}
                      className={`${msg.messageType === 'system' ? 'text-center' : ''}`}
                      data-testid={`message-${msg.id}`}
                    >
                      {msg.messageType === 'system' ? (
                        <span className="text-sm text-gray-500 italic">{msg.body}</span>
                      ) : (
                        <div className={`rounded-xl p-3 ${
                          msg.userId === user?.id 
                            ? 'bg-blue-600 ml-12' 
                            : 'bg-gray-800 mr-12'
                        }`}>
                          <p className="text-xs text-gray-300 mb-1">
                            {msg.user.fullName || msg.user.username}
                          </p>
                          <p className="text-base text-white">{msg.body}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            
            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700">
              <div className="flex gap-3">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 h-12 text-base"
                  data-testid="input-chat-message"
                />
                <Button 
                  type="submit" 
                  size="icon"
                  className="h-12 w-12"
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
      
      {/* Waypoint Naming Dialog - appears after clicking on map */}
      <Dialog open={!!pendingPoiLocation} onOpenChange={(open) => {
        if (!open) {
          setPendingPoiLocation(null);
          setNewPoiName("");
          setNewPoiNote("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Waypoint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Waypoint name..."
              value={newPoiName}
              onChange={(e) => setNewPoiName(e.target.value)}
              autoFocus
              data-testid="input-waypoint-name"
            />
            <textarea
              placeholder="Add a note (optional)..."
              value={newPoiNote}
              onChange={(e) => setNewPoiNote(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-waypoint-note"
            />
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPendingPoiLocation(null);
                  setNewPoiName("");
                  setNewPoiNote("");
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => {
                  if (newPoiName.trim() && pendingPoiLocation) {
                    createPoiMutation.mutate({
                      name: newPoiName.trim(),
                      latitude: pendingPoiLocation.lat,
                      longitude: pendingPoiLocation.lng,
                      note: newPoiNote.trim() || undefined
                    });
                    setPendingPoiLocation(null);
                    setNewPoiName("");
                    setNewPoiNote("");
                  }
                }}
                disabled={!newPoiName.trim() || createPoiMutation.isPending}
                data-testid="button-save-waypoint"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Save Waypoint
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* View Waypoint Details Dialog */}
      <Dialog open={!!selectedPoi} onOpenChange={(open) => {
        if (!open) {
          setSelectedPoi(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-400" />
              {selectedPoi?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPoi?.note ? (
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedPoi.note}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No notes for this waypoint</p>
            )}
            <div className="text-xs text-gray-500">
              Added by {selectedPoi?.createdByUser.username}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedPoi(null)}
              >
                Close
              </Button>
              <Button 
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  if (selectedPoi) {
                    deletePoiMutation.mutate(selectedPoi.id);
                    setSelectedPoi(null);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Invite Friends Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Invite Friends
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {availableFriends.length > 0 ? (
              <>
                <p className="text-sm text-gray-500">Select friends to invite:</p>
                <ScrollArea className="max-h-56">
                  <div className="space-y-2">
                    {availableFriends.map(friend => {
                      const isInvited = invitedFriends.has(friend.friend.id);
                      return (
                        <div
                          key={friend.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                          data-testid={`invite-friend-${friend.friend.id}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold text-sm">
                            {friend.friend.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {friend.friend.fullName || friend.friend.username}
                            </p>
                            <p className="text-xs text-gray-500">@{friend.friend.username}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={isInvited ? "outline" : "default"}
                            disabled={isInvited || sendInviteMutation.isPending}
                            onClick={() => sendInviteMutation.mutate(friend.friend.id)}
                          >
                            {isInvited ? (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Sent
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-1" />
                                Invite
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">No friends available to invite.</p>
                <p className="text-xs mt-1">Add friends first or all your friends are already in this session.</p>
              </div>
            )}
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowInviteDialog(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Save Route Dialog */}
      <Dialog open={showSaveRouteDialog} onOpenChange={(open) => {
        if (!open) {
          setShowSaveRouteDialog(false);
          setNewRouteName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Route</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Route name..."
              value={newRouteName}
              onChange={(e) => setNewRouteName(e.target.value)}
              autoFocus
            />
            <p className="text-sm text-gray-500">
              {drawRoutePoints.length} points, {(calculatePathDistance(drawRoutePoints) * 0.000621371).toFixed(2)} miles
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowSaveRouteDialog(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => {
                  if (newRouteName.trim()) {
                    saveRouteMutation.mutate({
                      name: newRouteName.trim(),
                      pathCoordinates: JSON.stringify(drawRoutePoints.map(([lng, lat]) => ({ lat, lng })))
                    });
                  }
                }}
                disabled={!newRouteName.trim() || saveRouteMutation.isPending}
              >
                <RouteIcon className="w-4 h-4 mr-2" />
                Save & Share
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
