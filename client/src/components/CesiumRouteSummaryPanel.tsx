import { useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Pencil, MapPin, Mountain, Ruler, Clock, Route as RouteIcon } from 'lucide-react';
import type { Route } from '@shared/schema';

interface CesiumRouteSummaryPanelProps {
  route: Route;
  viewer: any;
  onClose: () => void;
  onEdit?: (route: Route) => void;
  isOwner?: boolean;
}

interface ParsedWaypoint {
  name: string;
  lngLat: [number, number];
  elevation: number;
}

function formatDistance(meters: number | string | null | undefined): string {
  if (!meters) return 'N/A';
  const m = typeof meters === 'string' ? parseFloat(meters) : meters;
  if (isNaN(m)) return 'N/A';
  const miles = m / 1609.34;
  if (miles >= 0.1) {
    return `${miles.toFixed(2)} mi`;
  }
  const feet = m * 3.28084;
  return `${Math.round(feet)} ft`;
}

function formatElevation(meters: number | string | null | undefined): string {
  if (meters === null || meters === undefined) return 'N/A';
  const m = typeof meters === 'string' ? parseFloat(meters) : meters;
  if (isNaN(m)) return 'N/A';
  const feet = Math.round(m * 3.28084);
  return `${feet.toLocaleString()} ft`;
}

function formatTime(minutes: number | null | undefined): string {
  if (!minutes) return 'N/A';
  if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}min`;
  }
  return `${minutes}min`;
}

function parseWaypoints(route: Route): ParsedWaypoint[] {
  try {
    if (route.waypointCoordinates) {
      const parsed = JSON.parse(route.waypointCoordinates);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((wp: any, i: number) => ({
          name: wp.name || `Waypoint ${i + 1}`,
          lngLat: wp.lngLat as [number, number],
          elevation: wp.elevation ?? 0,
        }));
      }
    }
  } catch {}

  try {
    if (route.pathCoordinates) {
      const parsed = JSON.parse(route.pathCoordinates);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((coord: any, i: number) => ({
          name: `Point ${i + 1}`,
          lngLat: [coord[0], coord[1]] as [number, number],
          elevation: coord[2] ?? 0,
        }));
      }
    }
  } catch {}

  return [];
}

export default function CesiumRouteSummaryPanel({
  route,
  viewer,
  onClose,
  onEdit,
  isOwner = false,
}: CesiumRouteSummaryPanelProps) {
  const entitiesRef = useRef<any[]>([]);
  const polylineEntityRef = useRef<any>(null);

  const removeAllEntities = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;
    entitiesRef.current.forEach((entity) => {
      try { viewer.entities.remove(entity); } catch {}
    });
    entitiesRef.current = [];
    if (polylineEntityRef.current) {
      try { viewer.entities.remove(polylineEntityRef.current); } catch {}
      polylineEntityRef.current = null;
    }
    try { viewer.scene.requestRender(); } catch {}
  }, [viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const Cesium = (window as any).Cesium;
    if (!Cesium) return;

    const waypoints = parseWaypoints(route);
    if (waypoints.length === 0) return;

    removeAllEntities();

    const positions: any[] = [];

    waypoints.forEach((wp, index) => {
      const cartesian = Cesium.Cartesian3.fromDegrees(wp.lngLat[0], wp.lngLat[1], wp.elevation || 0);
      positions.push(cartesian);

      const entity = viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString('#FF6B35'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: wp.name,
          font: 'bold 13px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -15),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      entitiesRef.current.push(entity);
    });

    if (positions.length >= 2) {
      const polylineEntity = viewer.entities.add({
        polyline: {
          positions,
          width: 4,
          material: Cesium.Color.fromCssColorString('#FF6B35'),
          clampToGround: false,
          depthFailMaterial: Cesium.Color.fromCssColorString('#FF6B35').withAlpha(0.5),
        },
      });
      polylineEntityRef.current = polylineEntity;

      try {
        viewer.flyTo(polylineEntity, { duration: 1.5 });
      } catch {}
    } else if (positions.length === 1) {
      try {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            waypoints[0].lngLat[0],
            waypoints[0].lngLat[1],
            (waypoints[0].elevation || 0) + 500
          ),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 1.5,
        });
      } catch {}
    }

    viewer.scene.requestRender();
  }, [route.id, viewer, removeAllEntities]);

  useEffect(() => {
    return () => {
      removeAllEntities();
    };
  }, [removeAllEntities]);

  const handleClose = useCallback(() => {
    removeAllEntities();
    onClose();
  }, [removeAllEntities, onClose]);

  const waypoints = parseWaypoints(route);
  const elevationGain = route.elevationGain ? parseFloat(route.elevationGain as string) : 0;
  const elevationLoss = route.elevationLoss ? parseFloat(route.elevationLoss as string) : 0;

  return (
    <div className="absolute left-4 top-20 bottom-20 w-80 z-40 pointer-events-auto flex flex-col bg-gray-900/90 backdrop-blur-sm border border-white/20 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <RouteIcon className="w-5 h-5 text-[#FF6B35] shrink-0" />
          <h3 className="text-white font-semibold text-sm truncate">Route Summary</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10 shrink-0"
          onClick={handleClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <h2 className="text-white text-lg font-bold leading-tight">{route.name}</h2>
          {route.description && (
            <p className="text-white/60 text-sm mt-1">{route.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-md px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Ruler className="w-3 h-3 text-[#FF6B35]" />
              <span className="text-white/50 text-[10px] uppercase tracking-wide">Distance</span>
            </div>
            <p className="text-white text-sm font-semibold">{formatDistance(route.totalDistance)}</p>
          </div>

          <div className="bg-white/5 rounded-md px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <MapPin className="w-3 h-3 text-[#FF6B35]" />
              <span className="text-white/50 text-[10px] uppercase tracking-wide">Waypoints</span>
            </div>
            <p className="text-white text-sm font-semibold">{waypoints.length}</p>
          </div>

          <div className="bg-white/5 rounded-md px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Mountain className="w-3 h-3 text-green-400" />
              <span className="text-white/50 text-[10px] uppercase tracking-wide">Elev Gain</span>
            </div>
            <p className="text-white text-sm font-semibold">{formatElevation(elevationGain)}</p>
          </div>

          <div className="bg-white/5 rounded-md px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Mountain className="w-3 h-3 text-red-400" />
              <span className="text-white/50 text-[10px] uppercase tracking-wide">Elev Loss</span>
            </div>
            <p className="text-white text-sm font-semibold">{formatElevation(elevationLoss)}</p>
          </div>

          <div className="bg-white/5 rounded-md px-3 py-2 col-span-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-white/50 text-[10px] uppercase tracking-wide">Est. Time</span>
            </div>
            <p className="text-white text-sm font-semibold">{formatTime(route.estimatedTime)}</p>
          </div>
        </div>

        <div>
          <label className="text-white/70 text-xs font-medium flex items-center gap-1 mb-2">
            <MapPin className="w-3 h-3" />
            Waypoints ({waypoints.length})
          </label>
          {waypoints.length > 0 ? (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {waypoints.map((wp, index) => (
                <div
                  key={index}
                  className="bg-white/5 rounded-md px-2.5 py-2 flex items-start gap-2"
                >
                  <span className="text-[#FF6B35] font-bold text-xs mt-0.5 min-w-[16px]">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{wp.name}</p>
                    <p className="text-white/40 text-[10px] mt-0.5">
                      {wp.lngLat[1].toFixed(6)}, {wp.lngLat[0].toFixed(6)}
                    </p>
                    <p className="text-white/40 text-[10px]">
                      Elev: {formatElevation(wp.elevation)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 rounded-md px-3 py-3 text-center">
              <p className="text-white/40 text-xs">No waypoint data available</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-white/10 space-y-2">
        {isOwner && onEdit && (
          <Button
            className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white text-sm h-9"
            onClick={() => onEdit(route)}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit Route
          </Button>
        )}
        <Button
          variant="ghost"
          className="w-full text-white/60 hover:text-white hover:bg-white/10 text-sm h-9"
          onClick={handleClose}
        >
          <X className="w-4 h-4 mr-2" />
          Close
        </Button>
      </div>
    </div>
  );
}
