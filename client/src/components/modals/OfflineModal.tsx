import React, { useState } from 'react';
import { X, MapPin, Check, Download } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface OfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  bounds: {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  } | null;
}

const OfflineModal: React.FC<OfflineModalProps> = ({ isOpen, onClose, bounds }) => {
  const [includeDroneData, setIncludeDroneData] = useState(true);
  const { toast } = useToast();
  
  // Calculate area in square miles if bounds are provided
  const calculateArea = () => {
    if (!bounds) return 4.5; // Default for demo
    
    const latDiff = bounds.northEast.lat - bounds.southWest.lat;
    const lngDiff = bounds.northEast.lng - bounds.southWest.lng;
    
    // Approximate conversion to square miles (rough calculation)
    const avgLat = (bounds.northEast.lat + bounds.southWest.lat) / 2;
    const milePerDegreeLat = 69;
    const milePerDegreeLng = 69 * Math.cos(avgLat * Math.PI / 180);
    
    const areaInSquareMiles = (latDiff * milePerDegreeLat) * (lngDiff * milePerDegreeLng);
    return Math.max(0.1, areaInSquareMiles); // Minimum 0.1 sq mi
  };
  
  const area = calculateArea();
  
  // Calculate sizes based on area and the toggle
  // Rough estimate: ~55 MB per square mile for satellite imagery
  const satelliteSize = Math.round(area * 55);
  const topoSize = Math.round(area * 15);
  const droneSize = includeDroneData ? Math.round(area * 40) : 0;
  const totalSize = satelliteSize + topoSize + droneSize;
  
  // Download map mutation
  const downloadMapMutation = useMutation({
    mutationFn: async () => {
      if (!bounds) {
        throw new Error('No area selected');
      }
      return await apiRequest('POST', '/api/offline-maps', {
        name: 'Selected Area',
        northEastLat: bounds.northEast.lat,
        northEastLng: bounds.northEast.lng,
        southWestLat: bounds.southWest.lat,
        southWestLng: bounds.southWest.lng,
        includesDroneData: includeDroneData,
        sizeInMB: totalSize
      });
    },
    onSuccess: () => {
      toast({
        title: "Map Downloaded",
        description: "This area is now available offline.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download map for offline use.",
        variant: "destructive"
      });
    }
  });
  
  const handleDownload = () => {
    if (!bounds) {
      toast({
        title: "No area selected",
        description: "Please select an area on the map first.",
        variant: "destructive"
      });
      return;
    }
    downloadMapMutation.mutate();
  };

  if (!isOpen) return null;
  
  // Show error state if no bounds provided
  if (!bounds) {
    return (
      <div className="absolute inset-0 bg-black/70 z-20 flex items-end">
        <div className="w-full bg-dark rounded-t-2xl">
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-12 h-1 bg-white/20 rounded-full"></div>
          </div>
          <div className="p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Download for Offline Use</h2>
              <button className="text-white/60" onClick={onClose}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
              <p className="text-white">No area selected. Please select an area on the map first.</p>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/70 z-20 flex items-end">
      <div className="w-full bg-dark rounded-t-2xl">
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1 bg-white/20 rounded-full"></div>
        </div>
        <div className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Download for Offline Use</h2>
            <button className="text-white/60" onClick={onClose}>
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="bg-dark-gray/50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <MapPin className="h-5 w-5 text-accent mr-2" />
                <span className="font-medium">Selected Area</span>
              </div>
              <span className="text-sm text-white/60">~{area.toFixed(1)} mi²</span>
            </div>
            
            {/* A satellite view of a forested area with a selection box highlighted */}
            <div className="h-36 bg-gray-800 rounded-lg mb-3 overflow-hidden flex items-center justify-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1508923567004-3a6b8004f3d7?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=300')", backgroundSize: 'cover', backgroundPosition: 'center'}}>
              <div className="h-full w-full flex items-center justify-center">
                <div className="border-2 border-dashed border-secondary w-3/4 h-3/4 rounded flex items-center justify-center">
                  <span className="bg-secondary/20 text-white text-xs px-2 py-1 rounded">
                    {bounds ? `${area.toFixed(1)} mi² area` : 'Selected Area'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Satellite Imagery</span>
                <span className="text-white/60">{satelliteSize} MB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Topographic Data</span>
                <span className="text-white/60">{topoSize} MB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Drone Imagery (3 Areas)</span>
                <span className="text-white/60">{droneSize} MB</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="text-lg font-medium">Total Size: {totalSize} MB</div>
              <div className="text-sm text-white/60">Storage Available: 14.2 GB</div>
            </div>
            <div className="flex items-center">
              <span className="text-sm mr-3">Include Drone Data</span>
              <Switch
                checked={includeDroneData}
                onCheckedChange={setIncludeDroneData}
              />
            </div>
          </div>
          
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-xl flex items-center justify-center"
            onClick={handleDownload}
            disabled={downloadMapMutation.isPending}
          >
            {downloadMapMutation.isPending ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Downloading...
              </span>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Download Area
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OfflineModal;
