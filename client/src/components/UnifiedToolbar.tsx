import { useState, useEffect, useRef } from 'react';
import { Mountain, ChevronDown, ChevronUp, Ruler, Route as RouteIcon, Satellite, Eye, Circle, Radio, Footprints, Bike, Snowflake } from 'lucide-react';
import { PiBirdFill } from 'react-icons/pi';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DroneImage } from '@shared/schema';
import { TrailOverlayType, TRAIL_OVERLAY_CONFIG } from '@/lib/mapUtils';

interface LiveMapInvite {
  id: number;
  sessionId: number;
  status: string;
}

interface UnifiedToolbarProps {
  onToggleLayer: (layerType: string) => void;
  activeLayers: string[];
  activeTrailOverlays: Set<TrailOverlayType>;
  onStartOfflineSelection: () => void;
  onToggleDroneLayer: (droneImageId: number, isActive: boolean) => void;
  activeDroneLayers: Set<number>;
  onOpenRouteBuilder: () => void;
  isMeasurementMode: boolean;
  onToggleMeasurement: () => void;
  isOfflineSelectionMode: boolean;
  onOpenRecordActivity?: () => void;
  onOpenLiveMap?: () => void;
  isRecordingActive?: boolean;
  showOutdoorPOIs?: boolean;
  onToggleOutdoorPOIs?: () => void;
}

const UnifiedToolbar: React.FC<UnifiedToolbarProps> = ({ 
  onToggleLayer,
  activeLayers,
  activeTrailOverlays,
  onStartOfflineSelection, 
  onToggleDroneLayer, 
  activeDroneLayers,
  onOpenRouteBuilder,
  isMeasurementMode,
  onToggleMeasurement,
  isOfflineSelectionMode,
  onOpenRecordActivity,
  onOpenLiveMap,
  isRecordingActive = false,
  showOutdoorPOIs = false,
  onToggleOutdoorPOIs
}) => {
  const [droneDropdownOpen, setDroneDropdownOpen] = useState(false);
  const [trailsDropdownOpen, setTrailsDropdownOpen] = useState(false);
  const trailsDropdownRef = useRef<HTMLDivElement>(null);
  const [droneModels, setDroneModels] = useState<Record<number, boolean>>({});
  const [, navigate] = useLocation();
  const droneDropdownRef = useRef<HTMLDivElement>(null);

  const { data: cesiumTilesets = [] } = useQuery<any[]>({
    queryKey: ['/api/cesium-tilesets'],
  });
  const cesiumTilesetsByDroneImage: Record<number, any> = {};
  cesiumTilesets.forEach((t: any) => {
    if (t.droneImageId) cesiumTilesetsByDroneImage[t.droneImageId] = t;
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
    if (!trailsDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (trailsDropdownRef.current && !trailsDropdownRef.current.contains(e.target as Node)) {
        setTrailsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [trailsDropdownOpen]);

  // Fetch available drone imagery
  const { data: droneImages = [] } = useQuery<DroneImage[]>({
    queryKey: ['/api/drone-images'],
  });
  
  // Fetch 3D models for all drone images
  useEffect(() => {
    if (droneImages && droneImages.length > 0) {
      droneImages.forEach(async (image) => {
        try {
          const response = await fetch(`/api/drone-images/${image.id}/model`);
          if (response.ok) {
            setDroneModels(prev => ({ ...prev, [image.id]: true }));
          } else {
            setDroneModels(prev => ({ ...prev, [image.id]: false }));
          }
        } catch {
          setDroneModels(prev => ({ ...prev, [image.id]: false }));
        }
      });
    }
  }, [droneImages]);
  
  // Fetch pending live map invites
  const { data: pendingInvites = [] } = useQuery<LiveMapInvite[]>({
    queryKey: ['/api/live-map-invites'],
  });
  
  // Determine active base layer and topo state from activeLayers
  const isTopoActive = activeLayers.includes('topo');
  const activeBaseLayer = activeLayers.find(layer => ['esri-hd', 'esri-2d'].includes(layer)) || 'esri-hd';
  
  const handleToggleLayer = (layerType: string) => {
    onToggleLayer(layerType);
  };

  
  return (
    <div className={cn(
      "absolute left-0 right-0 px-2 sm:px-4 transition-all duration-300",
      isRecordingActive ? "bottom-20 z-40" : "bottom-20 z-10"
    )}>
      <div className="flex justify-center">
        <div className="relative max-w-full">
          {/* Main Toolbar */}
          <div className="bg-dark/90 backdrop-blur-sm rounded-2xl px-2 py-2 flex items-end space-x-1 shadow-2xl border border-white/10">
            
            {/* Explore Group */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] text-white font-medium underline mb-px">Explore</span>
              <div className="flex items-center space-x-0.5">
                {/* 2D/3D Toggle Button */}
                <button 
                  className={cn(
                    "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 min-w-[44px] min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                    (activeBaseLayer === 'esri-hd' || activeBaseLayer === 'esri-2d') && "active ring-2 ring-primary"
                  )}
                  onClick={() => handleToggleLayer(activeBaseLayer === 'esri-hd' ? 'esri-2d' : 'esri-hd')}
                  data-testid="button-2d-3d"
                >
                  {activeBaseLayer === 'esri-hd' ? <Satellite className="h-5 w-5 text-sky-400" /> : <Eye className="h-5 w-5 text-sky-400" />}
                  <span className="text-[10px] mt-0.5">2D/3D</span>
                </button>
                
                {/* Topo Button */}
                <button 
                  className={cn(
                    "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 min-w-[44px] min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                    isTopoActive && "active ring-2 ring-primary"
                  )}
                  onClick={() => handleToggleLayer('topo')}
                  data-testid="button-topo"
                >
                  <Mountain className="h-5 w-5" />
                  <span className="text-[10px] mt-0.5">Topo</span>
                </button>
                
                {/* Trails Dropdown */}
                <div className="relative" ref={trailsDropdownRef}>
                  <button 
                    className={cn(
                      "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 min-w-[44px] min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                      (trailsDropdownOpen || activeTrailOverlays.size > 0) && "active ring-2 ring-primary"
                    )}
                    onClick={() => setTrailsDropdownOpen(!trailsDropdownOpen)}
                    data-testid="button-trails"
                  >
                    <Footprints className="h-5 w-5 text-red-400" />
                    <span className="text-[10px] mt-0.5 flex items-center">
                      Trails {trailsDropdownOpen ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                    </span>
                  </button>
                  
                  {trailsDropdownOpen && (
                    <div className="fixed bottom-20 left-2 right-2 sm:absolute sm:bottom-full sm:mb-2 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 bg-[#1a1a1a] rounded-lg overflow-hidden w-auto sm:w-auto sm:min-w-56 max-w-sm shadow-2xl border border-white/20 z-50">
                      <div className="flex items-center gap-3 p-3 border-b border-white/20 bg-white/5">
                        <span className="text-xs text-white font-medium">Trail Overlays</span>
                      </div>
                      <div>
                        {(Object.keys(TRAIL_OVERLAY_CONFIG) as TrailOverlayType[]).map((type, index, arr) => {
                          const config = TRAIL_OVERLAY_CONFIG[type];
                          const isActive = activeTrailOverlays.has(type);
                          return (
                            <div 
                              key={type} 
                              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors ${index !== arr.length - 1 ? 'border-b border-white/10' : ''}`}
                              onClick={() => onToggleLayer(`trails-${type}`)}
                            >
                              <div 
                                className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                  isActive 
                                    ? "border-transparent" 
                                    : "border-white/30"
                                )}
                                style={isActive ? { backgroundColor: config.color, borderColor: config.color } : undefined}
                              >
                                {isActive && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div 
                                className="w-3 h-1 rounded-full" 
                                style={{ backgroundColor: config.color }}
                              />
                              <span className="text-sm text-white flex-1">{config.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Outdoor POIs Toggle */}
                <button 
                  className={cn(
                    "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 min-w-[44px] min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                    showOutdoorPOIs && "active ring-2 ring-emerald-500"
                  )}
                  onClick={onToggleOutdoorPOIs}
                  data-testid="button-outdoor-pois"
                >
                  <span className="text-lg">⛺</span>
                  <span className="text-[10px] mt-0.5">Camps</span>
                </button>
                
                {/* Drone Dropdown */}
                <div className="relative" ref={droneDropdownRef}>
                  <button 
                    className={cn(
                      "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 min-w-[44px] min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                      droneDropdownOpen && "active ring-2 ring-primary"
                    )}
                    onClick={() => setDroneDropdownOpen(!droneDropdownOpen)}
                    data-testid="button-drone"
                  >
                    <PiBirdFill className="h-5 w-5 text-amber-500" />
                    <span className="text-[10px] mt-0.5 flex flex-col items-center leading-tight">
                      <span className="flex items-center">Drone {droneDropdownOpen ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}</span>
                      <span>Imagery</span>
                    </span>
                  </button>
                  
                  {droneDropdownOpen && (
                    <div className="fixed bottom-20 left-2 right-2 sm:absolute sm:bottom-full sm:mb-2 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 bg-[#1a1a1a] rounded-lg overflow-hidden w-auto sm:w-auto sm:min-w-72 max-w-sm shadow-2xl border border-white/20 z-50">
                      <div className="flex items-center gap-3 p-3 border-b border-white/20 bg-white/5">
                        <span className="text-xs text-white font-medium">Drone Layers</span>
                      </div>
                      {droneImages.length === 0 ? (
                        <div className="text-xs text-white p-3">No drone imagery available</div>
                      ) : (
                        <div>
                          {droneImages.map((droneImage, index) => {
                            const displayName = droneImage.name;
                            const has3DModel = droneModels[droneImage.id];
                            return (
                              <div 
                                key={droneImage.id} 
                                className={`flex items-center gap-3 p-3 ${index !== droneImages.length - 1 ? 'border-b border-white/20' : ''}`}
                              >
                                <button
                                  onClick={() => onToggleDroneLayer(droneImage.id, true)}
                                  className="px-4 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                                  title="View 2D overlay on map"
                                  data-testid={`button-view-${droneImage.id}`}
                                >
                                  View
                                </button>
                                {activeDroneLayers.has(droneImage.id) && (
                                  <button
                                    onClick={() => onToggleDroneLayer(droneImage.id, false)}
                                    className="px-4 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                                    title="Hide 2D overlay from map"
                                    data-testid={`button-hide-${droneImage.id}`}
                                  >
                                    Hide
                                  </button>
                                )}
                                {has3DModel && (
                                  <button
                                    onClick={() => navigate(`/drone/${droneImage.id}/3d`)}
                                    className="px-3 py-1.5 rounded text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                                    title="Open 3D model viewer"
                                    data-testid={`button-view-3d-${droneImage.id}`}
                                  >
                                    3D Model
                                  </button>
                                )}
                                {cesiumTilesetsByDroneImage[droneImage.id] && (
                                  <button
                                    onClick={() => navigate(`/cesium/${cesiumTilesetsByDroneImage[droneImage.id].id}`)}
                                    className="px-3 py-1.5 rounded text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
                                    title="Open 3D Map viewer"
                                  >
                                    3D Map
                                  </button>
                                )}
                                <span className="text-sm text-white flex-1 truncate" title={displayName}>
                                  {displayName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Measure Button */}
                <button 
                  className={cn(
                    "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 min-w-[44px] min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95",
                    isMeasurementMode && "active ring-2 ring-orange-500"
                  )}
                  onClick={onToggleMeasurement}
                  data-testid="button-measure"
                >
                  <Ruler className="h-5 w-5 text-yellow-400" />
                  <span className="text-[10px] mt-0.5">Measure</span>
                </button>
              </div>
            </div>
            
            {!isRecordingActive && (
              <>
                {/* Divider */}
                <div className="h-12 w-px bg-white/20 self-center"></div>
                
                {/* Create Group */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] text-white font-medium underline mb-px">Create</span>
                  <div className="flex items-center space-x-0.5">
                    {/* Build Route Button */}
                    <button 
                      className="layer-toggle-btn bg-dark-gray/50 rounded-full p-2 min-w-[44px] min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95 hover:ring-2 hover:ring-primary/50"
                      onClick={onOpenRouteBuilder}
                      data-testid="button-build-route"
                    >
                      <RouteIcon className="h-5 w-5 text-blue-400" />
                      <span className="text-[10px] mt-0.5 flex flex-col items-center leading-tight">
                        <span>New</span>
                        <span>Route</span>
                      </span>
                    </button>
                    
                    {/* Record Button */}
                    <button 
                      className="layer-toggle-btn bg-dark-gray/50 rounded-full p-2 min-w-[44px] min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95 hover:ring-2 hover:ring-green-500/50"
                      onClick={onOpenRecordActivity}
                      data-testid="button-record-activity"
                    >
                      <Circle className="h-5 w-5 text-red-500 fill-red-500" />
                      <span className="text-[10px] mt-0.5 flex flex-col items-center leading-tight">
                        <span>Record</span>
                        <span>Activity</span>
                      </span>
                    </button>
                    
                    {/* Live Map Button */}
                    <div className="relative">
                      <button 
                        className="layer-toggle-btn bg-dark-gray/50 rounded-full p-2 min-w-[44px] min-h-[44px] flex flex-col items-center border-2 border-transparent transition-all active:scale-95 hover:ring-2 hover:ring-green-500/50"
                        onClick={onOpenLiveMap}
                        data-testid="button-live-map"
                      >
                        <Radio className="h-5 w-5 text-green-400" />
                        <span className="text-[10px] mt-0.5 flex flex-col items-center leading-tight">
                          <span>Team</span>
                          <span>Map</span>
                        </span>
                      </button>
                      {pendingInvites.length > 0 && (
                        <span 
                          className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1 animate-pulse"
                          data-testid="badge-invites-count"
                        >
                          {pendingInvites.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedToolbar;
