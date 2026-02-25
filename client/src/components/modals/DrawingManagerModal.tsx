import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, GitBranch, Hexagon, Ruler, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { MapDrawing } from '@shared/schema';
import { formatDate } from '@/lib/utils';

interface DrawingManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteDrawing: (id: number) => Promise<boolean>;
}

const DrawingManagerModal: React.FC<DrawingManagerModalProps> = ({
  isOpen,
  onClose,
  onDeleteDrawing
}) => {
  // Fetch user drawings
  const { data: drawings, isLoading, refetch } = useQuery<MapDrawing[]>({
    queryKey: ['/api/map-drawings'],
    enabled: isOpen,
  });
  
  const handleDelete = async (id: number) => {
    const success = await onDeleteDrawing(id);
    if (success) {
      refetch();
    }
  };
  
  const getDrawingIcon = (type: string) => {
    switch (type) {
      case 'waypoint':
        return <MapPin className="w-4 h-4 text-red-500" />;
      case 'line':
        return <GitBranch className="w-4 h-4 text-blue-500" />;
      case 'polygon':
        return <Hexagon className="w-4 h-4 text-green-500" />;
      case 'measurement':
        return <Ruler className="w-4 h-4 text-purple-500" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };
  
  const getDrawingDetails = (drawing: MapDrawing) => {
    if (drawing.measurementValue && drawing.measurementUnit) {
      return `${drawing.measurementValue} ${drawing.measurementUnit.replace('_', ' ')}`;
    }
    
    if (drawing.type === 'waypoint') {
      const coords = JSON.parse(drawing.coordinates);
      if (coords && coords.length > 0) {
        return `${coords[0][1].toFixed(5)}, ${coords[0][0].toFixed(5)}`;
      }
    }
    
    return `Created ${formatDate(new Date(drawing.createdAt || new Date()))}`;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Your Map Drawings</DialogTitle>
          <DialogDescription>
            View and manage your saved map annotations.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isLoading ? (
            <div className="text-center py-4">Loading your drawings...</div>
          ) : drawings && drawings.length > 0 ? (
            <div className="space-y-2">
              {drawings.map((drawing) => (
                <div 
                  key={drawing.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {getDrawingIcon(drawing.type)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{drawing.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getDrawingDetails(drawing)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDelete(drawing.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p>You don't have any saved drawings yet.</p>
              <p className="text-sm mt-1">
                Use the drawing tools on the map to create waypoints, lines, and areas.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DrawingManagerModal;