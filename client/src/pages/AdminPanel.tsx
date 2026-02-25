import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import DroneImageryUpload from '@/components/DroneImageryUpload';
import { Upload, MapPin, Settings, Eye, EyeOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function AdminPanel() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { user } = useAuth();

  const { data: droneImages = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/admin/drone-images'],
    enabled: !!user?.isAdmin,
  });

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need administrator privileges to access this panel.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleUploadSuccess = () => {
    refetch();
  };

  const toggleImageVisibility = async (imageId: number, currentState: boolean) => {
    try {
      await fetch(`/api/admin/drone-images/${imageId}/toggle-active`, {
        method: 'POST',
        credentials: 'include',
      });
      refetch();
    } catch (error) {
      console.error('Error toggling image visibility:', error);
    }
  };

  if (showUploadModal) {
    return (
      <div className="min-h-screen bg-background p-4">
        <DroneImageryUpload
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={handleUploadSuccess}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Manage drone imagery and map overlays</p>
          </div>
          <Button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload New Imagery
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Imagery</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{droneImages.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Maps</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {droneImages?.filter((img: any) => img.isActive).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Public Maps</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {droneImages?.filter((img: any) => img.isPublic).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Drone Imagery List */}
        <Card>
          <CardHeader>
            <CardTitle>Uploaded Drone Imagery</CardTitle>
            <CardDescription>
              Manage your uploaded drone maps and their visibility settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading imagery...</div>
            ) : droneImages.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No drone imagery uploaded yet</p>
                <p className="text-muted-foreground mb-4">
                  Upload your first drone imagery to get started
                </p>
                <Button onClick={() => setShowUploadModal(true)}>
                  Upload Imagery
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {droneImages?.map((image: any) => (
                  <div
                    key={image.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{image.name}</h3>
                        <div className="flex gap-1">
                          <Badge variant={image.isActive ? "default" : "secondary"}>
                            {image.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant={image.isPublic ? "outline" : "secondary"}>
                            {image.isPublic ? "Public" : "Private"}
                          </Badge>
                        </div>
                      </div>
                      {image.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {image.description}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Captured: {new Date(image.capturedAt).toLocaleDateString()} • 
                        Size: {image.sizeInMB}MB • 
                        Bounds: {image.northEastLat}, {image.northEastLng} to {image.southWestLat}, {image.southWestLng}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleImageVisibility(image.id, image.isActive)}
                      >
                        {image.isActive ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}