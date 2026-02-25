import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Trash2, Save, Undo2, Route as RouteIcon, MapPin, Mountain, Ruler, Clock, Move } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Route } from '@shared/schema';

interface CesiumRouteBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  viewer: any;
  cesiumTilesetId: number;
  editingRoute?: Route | null;
  onRouteSaved?: (route: Route) => void;
}

interface WaypointData {
  name: string;
  lngLat: [number, number];
  elevation: number;
  cartesian: any;
}

function formatDistanceDisplay(meters: number): string {
  const miles = meters / 1609.34;
  if (miles >= 0.1) {
    return `${miles.toFixed(2)} mi`;
  }
  const feet = meters * 3.28084;
  return `${feet.toFixed(0)} ft`;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}

export default function CesiumRouteBuilder({
  isOpen,
  onClose,
  viewer,
  cesiumTilesetId,
  editingRoute,
  onRouteSaved,
}: CesiumRouteBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [waypoints, setWaypoints] = useState<WaypointData[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const entitiesRef = useRef<any[]>([]);
  const polylineEntityRef = useRef<any>(null);
  const handlerRef = useRef<any>(null);
  const waypointsRef = useRef<WaypointData[]>([]);
  const draggingRef = useRef<number | null>(null);
  const mouseDownPosRef = useRef<{x: number, y: number} | null>(null);
  const didDragRef = useRef(false);

  const Cesium = (window as any).Cesium;

  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);

  useEffect(() => {
    draggingRef.current = draggingIndex;
  }, [draggingIndex]);

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
    viewer.scene.requestRender();
  }, [viewer]);

  const updatePolyline = useCallback((wps: WaypointData[]) => {
    if (!viewer || !Cesium || viewer.isDestroyed()) return;
    if (polylineEntityRef.current) {
      try { viewer.entities.remove(polylineEntityRef.current); } catch {}
      polylineEntityRef.current = null;
    }
    if (wps.length < 2) return;
    const positions = wps.map(w => w.cartesian);
    polylineEntityRef.current = viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: Cesium.Color.fromCssColorString('#FF6B35'),
        clampToGround: false,
        depthFailMaterial: Cesium.Color.fromCssColorString('#FF6B35').withAlpha(0.5),
      },
    });
    viewer.scene.requestRender();
  }, [viewer, Cesium]);

  const addWaypointEntity = useCallback((wp: WaypointData, index: number, isSelected: boolean = false) => {
    if (!viewer || !Cesium || viewer.isDestroyed()) return;
    const entity = viewer.entities.add({
      position: wp.cartesian,
      point: {
        pixelSize: isSelected ? 18 : 12,
        color: isSelected
          ? Cesium.Color.fromCssColorString('#00FF88')
          : Cesium.Color.fromCssColorString('#FF6B35'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: isSelected ? 3 : 2,
        heightReference: Cesium.HeightReference.NONE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: String(index + 1),
        font: 'bold 14px sans-serif',
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
    viewer.scene.requestRender();
  }, [viewer, Cesium]);

  const rebuildEntities = useCallback((wps: WaypointData[], selectedIdx: number | null = null) => {
    removeAllEntities();
    wps.forEach((wp, i) => addWaypointEntity(wp, i, i === selectedIdx));
    updatePolyline(wps);
  }, [removeAllEntities, addWaypointEntity, updatePolyline]);

  const calculateStats = useCallback((wps: WaypointData[]) => {
    if (!Cesium || wps.length < 2) return { totalDistance: 0, elevationGain: 0, elevationLoss: 0, estimatedTime: 0 };
    let totalDistance = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    for (let i = 1; i < wps.length; i++) {
      totalDistance += Cesium.Cartesian3.distance(wps[i - 1].cartesian, wps[i].cartesian);
      const diff = wps[i].elevation - wps[i - 1].elevation;
      if (diff > 0) elevationGain += diff;
      else elevationLoss += Math.abs(diff);
    }
    const estimatedTime = Math.round(totalDistance / 83.33);
    return { totalDistance, elevationGain, elevationLoss, estimatedTime };
  }, [Cesium]);

  const findNearestWaypointIndex = useCallback((screenX: number, screenY: number): number | null => {
    if (!viewer || !Cesium || viewer.isDestroyed()) return null;
    const wps = waypointsRef.current;
    if (wps.length === 0) return null;

    const hitRadius = 25;
    let closestIdx: number | null = null;
    let closestDist = Infinity;

    for (let i = 0; i < wps.length; i++) {
      const screenPoint = Cesium.SceneTransforms.worldToWindowCoordinates
        ? Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, wps[i].cartesian)
        : Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, wps[i].cartesian);
      if (!screenPoint) continue;
      const dx = screenX - screenPoint.x;
      const dy = screenY - screenPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [viewer, Cesium]);

  const pickPosition = useCallback((screenX: number, screenY: number): any | null => {
    if (!viewer || !Cesium || viewer.isDestroyed()) return null;
    const cartesian2 = new Cesium.Cartesian2(screenX, screenY);
    return viewer.scene.pickPosition(cartesian2) || null;
  }, [viewer, Cesium]);

  useEffect(() => {
    if (!isOpen || !viewer || !Cesium || viewer.isDestroyed()) return;

    const canvas = viewer.scene.canvas as HTMLCanvasElement;

    const getCanvasCoords = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const coords = getCanvasCoords(e);
      mouseDownPosRef.current = coords;
      didDragRef.current = false;

      const wpIdx = findNearestWaypointIndex(coords.x, coords.y);
      if (wpIdx !== null) {
        draggingRef.current = wpIdx;
        setDraggingIndex(wpIdx);
        rebuildEntities(waypointsRef.current, wpIdx);

        viewer.scene.screenSpaceCameraController.enableRotate = false;
        viewer.scene.screenSpaceCameraController.enableTranslate = false;
        viewer.scene.screenSpaceCameraController.enableZoom = false;
        viewer.scene.screenSpaceCameraController.enableTilt = false;
        viewer.scene.screenSpaceCameraController.enableLook = false;

        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const dragIdx = draggingRef.current;
      if (dragIdx === null) return;

      didDragRef.current = true;
      const coords = getCanvasCoords(e);
      const position = pickPosition(coords.x, coords.y);
      if (!position) return;

      const carto = Cesium.Cartographic.fromCartesian(position);
      const lng = Cesium.Math.toDegrees(carto.longitude);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const elevation = carto.height;

      const wps = [...waypointsRef.current];
      wps[dragIdx] = {
        ...wps[dragIdx],
        lngLat: [lng, lat],
        elevation,
        cartesian: position,
      };
      waypointsRef.current = wps;
      setWaypoints(wps);
      rebuildEntities(wps, dragIdx);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const dragIdx = draggingRef.current;

      if (dragIdx !== null) {
        draggingRef.current = null;
        setDraggingIndex(null);
        rebuildEntities(waypointsRef.current, null);

        viewer.scene.screenSpaceCameraController.enableRotate = true;
        viewer.scene.screenSpaceCameraController.enableTranslate = true;
        viewer.scene.screenSpaceCameraController.enableZoom = true;
        viewer.scene.screenSpaceCameraController.enableTilt = true;
        viewer.scene.screenSpaceCameraController.enableLook = true;

        try { canvas.releasePointerCapture(e.pointerId); } catch {}
        return;
      }

      if (mouseDownPosRef.current && !didDragRef.current) {
        const coords = getCanvasCoords(e);
        const dx = coords.x - mouseDownPosRef.current.x;
        const dy = coords.y - mouseDownPosRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < 5) {
          const position = pickPosition(coords.x, coords.y);
          if (!position) return;

          const carto = Cesium.Cartographic.fromCartesian(position);
          const lng = Cesium.Math.toDegrees(carto.longitude);
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const elevation = carto.height;

          const newWp: WaypointData = {
            name: `Waypoint ${waypointsRef.current.length + 1}`,
            lngLat: [lng, lat],
            elevation,
            cartesian: position,
          };

          const updated = [...waypointsRef.current, newWp];
          waypointsRef.current = updated;
          setWaypoints(updated);
          addWaypointEntity(newWp, updated.length - 1);
          updatePolyline(updated);
        }
      }
      mouseDownPosRef.current = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);

      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.screenSpaceCameraController.enableRotate = true;
        viewer.scene.screenSpaceCameraController.enableTranslate = true;
        viewer.scene.screenSpaceCameraController.enableZoom = true;
        viewer.scene.screenSpaceCameraController.enableTilt = true;
        viewer.scene.screenSpaceCameraController.enableLook = true;
      }
    };
  }, [isOpen, viewer, Cesium, addWaypointEntity, updatePolyline, rebuildEntities, findNearestWaypointIndex, pickPosition]);

  useEffect(() => {
    if (!isOpen || !editingRoute || !Cesium) return;
    try {
      const wpCoords = editingRoute.waypointCoordinates
        ? JSON.parse(editingRoute.waypointCoordinates)
        : [];
      if (wpCoords.length === 0) return;

      setName(editingRoute.name);
      setDescription(editingRoute.description || '');

      const loadedWps: WaypointData[] = wpCoords.map((w: any, i: number) => {
        const elev = w.elevation ?? 0;
        const cartesian = Cesium.Cartesian3.fromDegrees(w.lngLat[0], w.lngLat[1], elev);
        return {
          name: w.name || `Waypoint ${i + 1}`,
          lngLat: w.lngLat as [number, number],
          elevation: elev,
          cartesian,
        };
      });

      setWaypoints(loadedWps);
      waypointsRef.current = loadedWps;
      setTimeout(() => rebuildEntities(loadedWps), 100);
    } catch (e) {
      console.error('Failed to load editing route waypoints:', e);
    }
  }, [isOpen, editingRoute, Cesium, rebuildEntities]);

  useEffect(() => {
    if (!isOpen) {
      removeAllEntities();
      setWaypoints([]);
      waypointsRef.current = [];
      setName('');
      setDescription('');
      setDraggingIndex(null);
      draggingRef.current = null;
    }
  }, [isOpen, removeAllEntities]);

  useEffect(() => {
    return () => {
      removeAllEntities();
      if (handlerRef.current) {
        try { handlerRef.current.destroy(); } catch {}
        handlerRef.current = null;
      }
    };
  }, [removeAllEntities]);

  const handleDeleteWaypoint = useCallback((index: number) => {
    setDraggingIndex(null);
    draggingRef.current = null;
    setWaypoints((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      waypointsRef.current = updated;
      rebuildEntities(updated);
      return updated;
    });
  }, [rebuildEntities]);

  const handleUndoLast = useCallback(() => {
    setDraggingIndex(null);
    draggingRef.current = null;
    setWaypoints((prev) => {
      if (prev.length === 0) return prev;
      const updated = prev.slice(0, -1);
      waypointsRef.current = updated;
      rebuildEntities(updated);
      return updated;
    });
  }, [rebuildEntities]);

  const handleClearAll = useCallback(() => {
    setDraggingIndex(null);
    draggingRef.current = null;
    setWaypoints([]);
    waypointsRef.current = [];
    removeAllEntities();
  }, [removeAllEntities]);

  const handleWaypointNameChange = useCallback((index: number, newName: string) => {
    setWaypoints((prev) => {
      const updated = prev.map((wp, i) => (i === index ? { ...wp, name: newName } : wp));
      waypointsRef.current = updated;
      return updated;
    });
  }, []);

  const createRouteMutation = useMutation({
    mutationFn: async (routeData: any) => {
      const res = await apiRequest('POST', '/api/routes', routeData);
      return await res.json();
    },
    onSuccess: (savedRoute: Route) => {
      queryClient.invalidateQueries({ queryKey: ['/api/routes'] });
      toast({ title: 'Route saved', description: 'Your 3D route has been saved successfully.' });
      onRouteSaved?.(savedRoute);
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving route', description: error.message, variant: 'destructive' });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: async (routeData: any) => {
      const res = await apiRequest('PUT', `/api/routes/${editingRoute?.id}`, routeData);
      return await res.json();
    },
    onSuccess: (updatedRoute: Route) => {
      queryClient.invalidateQueries({ queryKey: ['/api/routes'] });
      toast({ title: 'Route updated', description: 'Your 3D route has been updated successfully.' });
      onRouteSaved?.(updatedRoute);
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating route', description: error.message, variant: 'destructive' });
    },
  });

  const handleSave = useCallback(() => {
    if (!name.trim() || waypoints.length < 2) return;

    const stats = calculateStats(waypoints);
    const pathCoordinates = waypoints.map((w) => w.lngLat);
    const waypointCoordinates = waypoints.map((w) => ({
      name: w.name,
      lngLat: w.lngLat,
      elevation: w.elevation,
    }));

    const routeData = {
      name: name.trim(),
      description: description.trim() || null,
      waypointIds: '[]',
      pathCoordinates: JSON.stringify(pathCoordinates),
      waypointCoordinates: JSON.stringify(waypointCoordinates),
      totalDistance: stats.totalDistance,
      elevationGain: stats.elevationGain,
      elevationLoss: stats.elevationLoss,
      estimatedTime: stats.estimatedTime,
      routingMode: 'direct',
      cesiumTilesetId,
    };

    if (editingRoute) {
      updateRouteMutation.mutate(routeData);
    } else {
      createRouteMutation.mutate(routeData);
    }
  }, [name, description, waypoints, cesiumTilesetId, editingRoute, calculateStats, createRouteMutation, updateRouteMutation]);

  const stats = calculateStats(waypoints);
  const canSave = name.trim().length > 0 && waypoints.length >= 2;
  const isSaving = createRouteMutation.isPending || updateRouteMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="absolute left-4 top-20 bottom-20 w-80 z-40 pointer-events-auto flex flex-col bg-gray-900/90 backdrop-blur-sm border border-white/20 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <RouteIcon className="w-5 h-5 text-[#FF6B35]" />
          <h3 className="text-white font-semibold text-sm">
            {editingRoute ? 'Edit 3D Route' : 'Build 3D Route'}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <div>
          <label className="text-white/70 text-xs font-medium mb-1 block">Route Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter route name"
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-9 text-sm"
          />
        </div>

        <div>
          <label className="text-white/70 text-xs font-medium mb-1 block">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm min-h-[60px] resize-none"
          />
        </div>

        <div className="bg-white/5 rounded-md px-3 py-2">
          <div className="flex items-center gap-2 text-white/50 text-xs">
            <Move className="w-3 h-3" />
            <span>Click & drag waypoints to reposition</span>
          </div>
        </div>

        {draggingIndex !== null && (
          <div className="bg-green-500/10 border border-green-400/30 rounded-md px-3 py-2">
            <div className="flex items-center gap-2 text-green-300 text-xs font-medium">
              <Move className="w-3.5 h-3.5" />
              <span>Dragging Waypoint {draggingIndex + 1}...</span>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-white/70 text-xs font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Waypoints ({waypoints.length})
            </label>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10"
                onClick={handleUndoLast}
                disabled={waypoints.length === 0}
              >
                <Undo2 className="w-3 h-3 mr-1" />
                Undo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-400/10"
                onClick={handleClearAll}
                disabled={waypoints.length === 0}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {waypoints.length === 0 ? (
            <div className="bg-white/5 rounded-md px-3 py-4 text-center">
              <Plus className="w-5 h-5 text-white/30 mx-auto mb-1" />
              <p className="text-white/40 text-xs">Click on the 3D map to place waypoints</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {waypoints.map((wp, index) => (
                <div
                  key={index}
                  className={`rounded-md px-2.5 py-2 flex items-start gap-2 transition-colors ${
                    draggingIndex === index
                      ? 'bg-green-500/15 border border-green-400/30'
                      : 'bg-white/5'
                  }`}
                >
                  <span className={`font-bold text-xs mt-1 min-w-[16px] ${
                    draggingIndex === index ? 'text-green-400' : 'text-[#FF6B35]'
                  }`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Input
                      value={wp.name}
                      onChange={(e) => handleWaypointNameChange(index, e.target.value)}
                      className="bg-transparent border-none text-white text-xs h-5 p-0 focus-visible:ring-0"
                    />
                    <p className="text-white/40 text-[10px] mt-0.5">
                      {wp.lngLat[1].toFixed(6)}, {wp.lngLat[0].toFixed(6)} · {wp.elevation.toFixed(1)}m
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-white/30 hover:text-red-400 hover:bg-red-400/10 shrink-0"
                    onClick={() => handleDeleteWaypoint(index)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {waypoints.length >= 2 && (
          <div className="bg-white/5 rounded-md px-3 py-2.5 space-y-1.5">
            <h4 className="text-white/70 text-xs font-medium mb-1">Route Stats</h4>
            <div className="flex items-center gap-2 text-white text-xs">
              <Ruler className="w-3 h-3 text-[#FF6B35]" />
              <span>Distance: {formatDistanceDisplay(stats.totalDistance)}</span>
            </div>
            <div className="flex items-center gap-2 text-white text-xs">
              <Mountain className="w-3 h-3 text-green-400" />
              <span>Gain: {stats.elevationGain.toFixed(1)}m · Loss: {stats.elevationLoss.toFixed(1)}m</span>
            </div>
            <div className="flex items-center gap-2 text-white text-xs">
              <Clock className="w-3 h-3 text-blue-400" />
              <span>Est. Time: {formatTime(stats.estimatedTime)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-white/10 space-y-2">
        <Button
          className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white text-sm h-9"
          onClick={handleSave}
          disabled={!canSave || isSaving}
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : editingRoute ? 'Update Route' : 'Save Route'}
        </Button>
        <Button
          variant="ghost"
          className="w-full text-white/60 hover:text-white hover:bg-white/10 text-sm h-9"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
