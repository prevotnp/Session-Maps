import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Camera, Trash2, Loader2, MapPin, Image } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WaypointEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeId: number;
  poi: {
    id: number;
    name: string;
    latitude: string;
    longitude: string;
    elevation: string | null;
    note: string | null;
    photos: string | null;
  };
  isOwner: boolean;
}

export function WaypointEditModal({ isOpen, onClose, routeId, poi, isOwner }: WaypointEditModalProps) {
  const [name, setName] = useState(poi.name);
  const [note, setNote] = useState(poi.note || "");
  const [photos, setPhotos] = useState<string[]>(poi.photos ? JSON.parse(poi.photos) : []);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", `/api/routes/${routeId}/pois/${poi.id}`, {
        name,
        note,
      });
    },
    onSuccess: () => {
      toast({
        title: "Waypoint updated",
        description: "Your changes have been saved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/routes", routeId, "pois"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error saving",
        description: error.message || "Failed to update waypoint",
      });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('photos', file);
    });

    try {
      const response = await fetch(`/api/routes/${routeId}/pois/${poi.id}/photos`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload photos');
      }

      const result = await response.json();
      setPhotos(result.photos);
      toast({
        title: "Photos uploaded",
        description: `${files.length} photo(s) added successfully`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload photos",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async (photoPath: string) => {
    try {
      const response = await fetch(`/api/routes/${routeId}/pois/${poi.id}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPath }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete photo');
      const result = await response.json();
      setPhotos(result.photos);
      toast({
        title: "Photo deleted",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message || "Failed to delete photo",
      });
    }
  };

  const elevationFeet = poi.elevation 
    ? Math.round(parseFloat(poi.elevation) * 3.28084).toLocaleString() 
    : 'N/A';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <MapPin className="w-5 h-5 text-indigo-500" />
            {isOwner ? "Edit Waypoint" : "Waypoint Details"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            {isOwner ? (
              <Input
                data-testid="input-waypoint-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Waypoint name"
                className="bg-white dark:bg-gray-800"
              />
            ) : (
              <p className="text-gray-900 dark:text-gray-100">{name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Latitude:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{parseFloat(poi.latitude).toFixed(6)}°</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Longitude:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{parseFloat(poi.longitude).toFixed(6)}°</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">Elevation:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{elevationFeet} ft</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            {isOwner ? (
              <Textarea
                data-testid="textarea-waypoint-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add notes about this location..."
                rows={3}
                className="bg-white dark:bg-gray-800"
              />
            ) : (
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                {note || "No notes added"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Photos ({photos.length})
              </label>
              {isOwner && (
                <Button
                  data-testid="button-add-photos"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gap-1"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  Add Photos
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group aspect-square">
                    <img
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    {isOwner && (
                      <button
                        data-testid={`button-delete-photo-${index}`}
                        onClick={() => handleDeletePhoto(photo)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">
                No photos yet
              </p>
            )}
          </div>

          {isOwner && (
            <div className="flex gap-2 pt-4">
              <Button
                data-testid="button-cancel-waypoint-edit"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                data-testid="button-save-waypoint"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Save Changes
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
