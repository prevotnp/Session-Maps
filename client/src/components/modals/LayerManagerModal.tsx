import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

interface LayerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LayerManagerModal: React.FC<LayerManagerModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  
  // Layer visibility states
  const [satelliteVisible, setSatelliteVisible] = useState(true);
  const [topoVisible, setTopoVisible] = useState(true);
  const [streetMapVisible, setStreetMapVisible] = useState(false);
  const [droneVisible, setDroneVisible] = useState(true);
  const [poiVisible, setPoiVisible] = useState(true);

  const [weatherVisible, setWeatherVisible] = useState(false);
  
  // Display settings
  const [mapRotation, setMapRotation] = useState([70]);
  const [terrainExaggeration, setTerrainExaggeration] = useState([50]);
  const [labelVisibility, setLabelVisibility] = useState([30]);
  
  const handleSaveSettings = () => {
    // In a real app, this would save settings to the backend
    toast({
      title: "Settings Saved",
      description: "Your map display preferences have been updated.",
      variant: "default"
    });
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/70 z-20 flex items-end">
      <div className="w-full bg-dark rounded-t-2xl">
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1 bg-white/20 rounded-full"></div>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Map Layers</h2>
            <button className="text-white/60" onClick={onClose}>
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Base Maps */}
          <h3 className="text-md font-medium mb-3">Base Maps</h3>
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between bg-dark-gray/50 p-3 rounded-lg">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded overflow-hidden mr-3 border border-white/10">
                  <div className="h-full w-full" style={{backgroundImage: "url('https://pixabay.com/get/g14e3009e5a65ed367b662e765c2cf44f5062a163f63172359f343acc4ea16cee43cf53e15aba260dc40db2531121b5d0_1280.jpg')", backgroundSize: 'cover'}}></div>
                </div>
                <div>
                  <div className="font-medium">Satellite</div>
                  <div className="text-xs text-white/60">High-resolution satellite imagery</div>
                </div>
              </div>
              <Switch 
                checked={satelliteVisible}
                onCheckedChange={setSatelliteVisible}
              />
            </div>
            
            <div className="flex items-center justify-between bg-dark-gray/50 p-3 rounded-lg">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded overflow-hidden mr-3 border border-white/10">
                  <div className="h-full w-full" style={{backgroundImage: "url('https://pixabay.com/get/gf375245f16e2e75b01cb9ab9dd6f4113de9407daec2abcf19cc70f01025a7f805d692a643889af915d623ae943c8c7e5ddbc0d0c82573799195a2cd69884a90b_1280.jpg')", backgroundSize: 'cover'}}></div>
                </div>
                <div>
                  <div className="font-medium">Topographic</div>
                  <div className="text-xs text-white/60">Contour lines and elevation data</div>
                </div>
              </div>
              <Switch 
                checked={topoVisible}
                onCheckedChange={setTopoVisible}
              />
            </div>
            
            <div className="flex items-center justify-between bg-dark-gray/50 p-3 rounded-lg">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded overflow-hidden mr-3 border border-white/10">
                  <div className="h-full w-full bg-indigo-100"></div>
                </div>
                <div>
                  <div className="font-medium">Street Map</div>
                  <div className="text-xs text-white/60">Road networks and landmarks</div>
                </div>
              </div>
              <Switch 
                checked={streetMapVisible}
                onCheckedChange={setStreetMapVisible}
              />
            </div>
          </div>
          
          {/* Overlay Layers */}
          <h3 className="text-md font-medium mb-3">Overlay Layers</h3>
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between bg-dark-gray/50 p-3 rounded-lg">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded overflow-hidden mr-3 border border-white/10 flex items-center justify-center bg-white/5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium">Drone Imagery</div>
                  <div className="text-xs text-white/60">High-res 3D drone captures</div>
                </div>
              </div>
              <Switch 
                checked={droneVisible}
                onCheckedChange={setDroneVisible}
              />
            </div>
            
            <div className="flex items-center justify-between bg-dark-gray/50 p-3 rounded-lg">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded overflow-hidden mr-3 border border-white/10 flex items-center justify-center bg-white/5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium">Points of Interest</div>
                  <div className="text-xs text-white/60">User markers and waypoints</div>
                </div>
              </div>
              <Switch 
                checked={poiVisible}
                onCheckedChange={setPoiVisible}
              />
            </div>
            

            
            <div className="flex items-center justify-between bg-dark-gray/50 p-3 rounded-lg">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded overflow-hidden mr-3 border border-white/10 flex items-center justify-center bg-white/5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium">Weather Overlay</div>
                  <div className="text-xs text-white/60">Current and forecast conditions</div>
                </div>
              </div>
              <Switch 
                checked={weatherVisible}
                onCheckedChange={setWeatherVisible}
              />
            </div>
          </div>
          
          {/* Additional Settings */}
          <h3 className="text-md font-medium mb-3">Display Settings</h3>
          <div className="bg-dark-gray/50 p-4 rounded-lg mb-6">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Map Rotation</label>
              <div className="flex items-center justify-between">
                <span className="text-xs">North Up</span>
                <div className="w-full max-w-[150px] px-2">
                  <Slider
                    value={mapRotation}
                    onValueChange={setMapRotation}
                    max={100}
                    step={1}
                  />
                </div>
                <span className="text-xs">Free</span>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">3D Terrain Exaggeration</label>
              <div className="flex items-center justify-between">
                <span className="text-xs">Flat</span>
                <div className="w-full max-w-[150px] px-2">
                  <Slider
                    value={terrainExaggeration}
                    onValueChange={setTerrainExaggeration}
                    max={100}
                    step={1}
                  />
                </div>
                <span className="text-xs">Enhanced</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Label Visibility</label>
              <div className="flex items-center justify-between">
                <span className="text-xs">Hidden</span>
                <div className="w-full max-w-[150px] px-2">
                  <Slider
                    value={labelVisibility}
                    onValueChange={setLabelVisibility}
                    max={100}
                    step={1}
                  />
                </div>
                <span className="text-xs">Detailed</span>
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-xl"
            onClick={handleSaveSettings}
          >
            Apply Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LayerManagerModal;
