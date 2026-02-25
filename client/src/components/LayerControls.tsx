import { useState, useEffect, useRef } from 'react';
import { Globe, Mountain, Cloud, MapPin, Satellite, Square, Box, Map, Eye, ChevronDown, ChevronUp, Footprints } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DroneImage } from '@shared/schema';
import { TrailOverlayType, TRAIL_OVERLAY_CONFIG } from '@/lib/mapUtils';

interface LayerControlsProps {
  onToggleLayer: (layerType: string) => void;
  onOpenOfflineModal: () => void;
  onToggleDroneLayer: (droneImageId: number, isActive: boolean) => void;
  activeDroneLayers: Set<number>;
  activeTrailOverlays?: Set<TrailOverlayType>;
}

const LayerControls: React.FC<LayerControlsProps> = ({ onToggleLayer, onOpenOfflineModal, onToggleDroneLayer, activeDroneLayers, activeTrailOverlays = new Set(['hiking']) }) => {
  const [activeLayer, setActiveLayer] = useState('esri-hd');
  const [propertyLinesVisible, setPropertyLinesVisible] = useState(false);
  const [droneDropdownOpen, setDroneDropdownOpen] = useState(false);
  const [trailsOpen, setTrailsOpen] = useState(false);
  const trailsRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const droneDropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch available drone imagery
  const { data: droneImages = [] } = useQuery<DroneImage[]>({
    queryKey: ['/api/drone-images'],
  });

  // Track which drone images have 3D models
  const [droneModels, setDroneModels] = useState<Record<number, boolean>>({});
  
  // Fetch 3D model availability for all drone images
  useEffect(() => {
    if (droneImages.length === 0) return;
    
    droneImages.forEach(async (droneImage) => {
      try {
        const response = await fetch(`/api/drone-images/${droneImage.id}/model`);
        if (response.ok) {
          setDroneModels(prev => ({ ...prev, [droneImage.id]: true }));
        }
      } catch {
        // No model available
      }
    });
  }, [droneImages]);
  
  const handleToggleLayer = (layerType: string) => {
    if (layerType === 'property-lines') {
      setPropertyLinesVisible(!propertyLinesVisible);
    } else {
      setActiveLayer(layerType);
    }
    onToggleLayer(layerType);
  };
  
  return (
    <div className="absolute bottom-24 left-0 right-0 z-10 px-2 sm:px-4">
      <div className="flex justify-center">
        <div className="bg-dark/80 backdrop-blur-sm rounded-full px-2 sm:px-4 py-2 flex items-center space-x-2 sm:space-x-4 max-w-full">
          <button 
            className={cn(
              "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 flex flex-col items-center border-2 border-transparent",
              activeLayer === 'esri-hd' && "active"
            )}
            onClick={() => handleToggleLayer('esri-hd')}
          >
            <Satellite className="h-5 w-5" />
            <span className="text-xs mt-1">3D</span>
          </button>
          
          <button 
            className={cn(
              "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 flex flex-col items-center border-2 border-transparent",
              activeLayer === 'esri-2d' && "active"
            )}
            onClick={() => handleToggleLayer('esri-2d')}
          >
            <Eye className="h-5 w-5" />
            <span className="text-xs mt-1">2D</span>
          </button>
          
          <button 
            className={cn(
              "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 flex flex-col items-center border-2 border-transparent",
              activeLayer === 'topo' && "active"
            )}
            onClick={() => handleToggleLayer('topo')}
          >
            <Mountain className="h-5 w-5" />
            <span className="text-xs mt-1">Topo</span>
          </button>
          
          {/* Drone Imagery Dropdown */}
          <div className="relative" ref={droneDropdownRef}>
            <button 
              className={cn(
                "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 flex flex-col items-center border-2 border-transparent",
                droneDropdownOpen && "active"
              )}
              onClick={() => setDroneDropdownOpen(!droneDropdownOpen)}
            >
              <Cloud className="h-5 w-5" />
              <span className="text-xs mt-1">Drone</span>
              {droneDropdownOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            
            {droneDropdownOpen && (
              <div className="fixed bottom-20 left-2 right-2 sm:absolute sm:bottom-full sm:mb-2 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 bg-dark/90 backdrop-blur-sm rounded-lg p-3 w-auto sm:w-auto sm:min-w-72 max-w-sm shadow-lg border border-white/10 z-50">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                  <span className="w-8 text-center text-[10px] text-white/50 font-medium">2D</span>
                  <span className="w-8 text-center text-[10px] text-white/50 font-medium">3D</span>
                  <span className="text-xs text-white/70 font-medium flex-1">Drone Imagery</span>
                </div>
                {droneImages.length === 0 ? (
                  <div className="text-xs text-white/50 py-2">No drone imagery available</div>
                ) : (
                  <div className="space-y-2">
                    {droneImages.map((droneImage) => {
                      const displayName = droneImage.name;
                      const has3DModel = droneModels[droneImage.id];
                      const is2DActive = activeDroneLayers.has(droneImage.id);
                      return (
                        <div key={droneImage.id} className="flex items-center gap-2">
                          <button
                            onClick={() => onToggleDroneLayer(droneImage.id, !is2DActive)}
                            className={cn(
                              "flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold transition-all",
                              is2DActive
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                                : "bg-white/10 text-white/50 hover:bg-white/20 hover:text-white"
                            )}
                            title={is2DActive ? "Turn off 2D overlay" : "Turn on 2D overlay"}
                            data-testid={`button-2d-${droneImage.id}`}
                          >
                            {is2DActive ? "ON" : "OFF"}
                          </button>
                          <button
                            onClick={() => {
                              if (has3DModel) {
                                navigate(`/drone/${droneImage.id}/3d`);
                              }
                            }}
                            disabled={!has3DModel}
                            className={cn(
                              "flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold transition-all",
                              has3DModel
                                ? "bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/30"
                                : "bg-white/5 text-white/20 cursor-not-allowed"
                            )}
                            title={has3DModel ? "Open 3D model viewer" : "No 3D model available"}
                            data-testid={`button-3d-${droneImage.id}`}
                          >
                            VIEW
                          </button>
                          <span className="text-xs text-white flex-1 truncate" title={displayName}>
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
          
          {/* Trails Dropdown */}
          <div className="relative" ref={trailsRef}>
            <button 
              className={cn(
                "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 flex flex-col items-center border-2 border-transparent",
                (trailsOpen || activeTrailOverlays.size > 0) && "active"
              )}
              onClick={() => setTrailsOpen(!trailsOpen)}
            >
              <Footprints className="h-5 w-5" />
              <span className="text-xs mt-1 flex items-center">Trails {trailsOpen ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}</span>
            </button>
            
            {trailsOpen && (
              <div className="fixed bottom-20 left-2 right-2 sm:absolute sm:bottom-full sm:mb-2 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 bg-dark/90 backdrop-blur-sm rounded-lg p-3 w-auto sm:w-auto sm:min-w-56 max-w-sm shadow-lg border border-white/10 z-50">
                <div className="text-xs text-white/70 font-medium mb-2 pb-2 border-b border-white/10">Trail Overlays</div>
                <div className="space-y-1">
                  {(Object.keys(TRAIL_OVERLAY_CONFIG) as TrailOverlayType[]).map((type) => {
                    const config = TRAIL_OVERLAY_CONFIG[type];
                    const isActive = activeTrailOverlays.has(type);
                    return (
                      <div 
                        key={type} 
                        className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => onToggleLayer(`trails-${type}`)}
                      >
                        <div 
                          className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center",
                            isActive ? "border-transparent" : "border-white/30"
                          )}
                          style={isActive ? { backgroundColor: config.color, borderColor: config.color } : undefined}
                        >
                          {isActive && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="w-3 h-1 rounded-full" style={{ backgroundColor: config.color }} />
                        <span className="text-xs text-white">{config.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button 
            className={cn(
              "layer-toggle-btn bg-dark-gray/50 rounded-full p-2 flex flex-col items-center border-2 border-transparent",
              activeLayer === 'markers' && "active"
            )}
            onClick={() => handleToggleLayer('markers')}
          >
            <MapPin className="h-5 w-5" />
            <span className="text-xs mt-1">Add Waypoint</span>
          </button>
          

        </div>
      </div>
    </div>
  );
};

export default LayerControls;
