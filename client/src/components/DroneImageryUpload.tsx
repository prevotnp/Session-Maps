import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { Upload, MapPin, Loader2 } from 'lucide-react';
import { fromBlob } from 'geotiff';

interface DroneImageryUploadProps {
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function DroneImageryUpload({ onClose, onUploadSuccess }: DroneImageryUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    password: '',
    isPublic: true,
    northEastLat: '',
    northEastLng: '',
    southWestLat: '',
    southWestLng: '',
    capturedAt: new Date().toISOString().split('T')[0],
  });
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isExtractingGPS, setIsExtractingGPS] = useState(false);
  const [gpsExtracted, setGpsExtracted] = useState(false);
  const { user } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, isPublic: checked }));
  };

  const extractGPSFromGeoTIFF = async (file: File): Promise<{
    northEastLat: string;
    northEastLng: string;
    southWestLat: string;
    southWestLng: string;
  } | null> => {
    try {
      const tiff = await fromBlob(file);
      const image = await tiff.getImage();
      const bbox = image.getBoundingBox();
      
      if (bbox && bbox.length === 4) {
        const [minX, minY, maxX, maxY] = bbox;
        return {
          southWestLng: minX.toString(),
          southWestLat: minY.toString(),
          northEastLng: maxX.toString(),
          northEastLat: maxY.toString(),
        };
      }
      return null;
    } catch (error) {
      console.error('Error extracting GPS from GeoTIFF:', error);
      return null;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setSelectedFiles(files);
    setGpsExtracted(false);
    
    if (files && files.length > 0) {
      const file = files[0];
      const ext = file.name.toLowerCase();
      
      if (ext.endsWith('.tif') || ext.endsWith('.tiff')) {
        setIsExtractingGPS(true);
        const coords = await extractGPSFromGeoTIFF(file);
        setIsExtractingGPS(false);
        
        if (coords) {
          setFormData(prev => ({
            ...prev,
            northEastLat: coords.northEastLat,
            northEastLng: coords.northEastLng,
            southWestLat: coords.southWestLat,
            southWestLng: coords.southWestLng,
          }));
          setGpsExtracted(true);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFiles || selectedFiles.length === 0) {
      alert('Please select imagery files to upload');
      return;
    }

    if (!formData.northEastLat || !formData.northEastLng || !formData.southWestLat || !formData.southWestLng) {
      alert('Please provide the geographic boundaries for this imagery');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const uploadData = new FormData();
    
    uploadData.append('name', formData.name);
    uploadData.append('description', formData.description);
    uploadData.append('password', formData.password);
    uploadData.append('isPublic', formData.isPublic.toString());
    uploadData.append('northEastLat', formData.northEastLat);
    uploadData.append('northEastLng', formData.northEastLng);
    uploadData.append('southWestLat', formData.southWestLat);
    uploadData.append('southWestLng', formData.southWestLng);
    uploadData.append('capturedAt', formData.capturedAt);

    Array.from(selectedFiles).forEach(file => {
      uploadData.append('imagery', file);
    });

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onUploadSuccess();
        onClose();
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          alert(`Upload failed: ${errorData.message}`);
        } catch {
          alert(`Upload failed (status ${xhr.status}). The file may be too large.`);
        }
      }
      setIsUploading(false);
      setUploadProgress(0);
    });

    xhr.addEventListener('error', () => {
      alert('Upload failed. Please check your connection and try again.');
      setIsUploading(false);
      setUploadProgress(0);
    });

    xhr.addEventListener('abort', () => {
      setIsUploading(false);
      setUploadProgress(0);
    });

    xhr.open('POST', '/api/drone-images');
    xhr.withCredentials = true;
    xhr.send(uploadData);
  };

  if (!user) {
    return null;
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Drone Imagery
        </CardTitle>
        <CardDescription>
          Upload processed drone imagery files from Pix4D (GeoTIFF, tiles, or orthomosaics)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Map Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Jackson Hole Ski Resort Aerial Survey"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Brief description of the imagery area and capture details"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="capturedAt">Capture Date</Label>
              <Input
                id="capturedAt"
                name="capturedAt"
                type="date"
                value={formData.capturedAt}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Geographic Boundaries */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              <Label className="text-base font-medium">Geographic Boundaries</Label>
              {isExtractingGPS && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Extracting GPS from file...
                </span>
              )}
              {gpsExtracted && (
                <span className="text-sm text-green-600">
                  GPS coordinates extracted from file
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="northEastLat">Northeast Latitude</Label>
                <Input
                  id="northEastLat"
                  name="northEastLat"
                  type="number"
                  step="any"
                  value={formData.northEastLat}
                  onChange={handleInputChange}
                  placeholder="43.4823"
                  required
                />
              </div>
              <div>
                <Label htmlFor="northEastLng">Northeast Longitude</Label>
                <Input
                  id="northEastLng"
                  name="northEastLng"
                  type="number"
                  step="any"
                  value={formData.northEastLng}
                  onChange={handleInputChange}
                  placeholder="-110.7625"
                  required
                />
              </div>
              <div>
                <Label htmlFor="southWestLat">Southwest Latitude</Label>
                <Input
                  id="southWestLat"
                  name="southWestLat"
                  type="number"
                  step="any"
                  value={formData.southWestLat}
                  onChange={handleInputChange}
                  placeholder="43.4651"
                  required
                />
              </div>
              <div>
                <Label htmlFor="southWestLng">Southwest Longitude</Label>
                <Input
                  id="southWestLng"
                  name="southWestLng"
                  type="number"
                  step="any"
                  value={formData.southWestLng}
                  onChange={handleInputChange}
                  placeholder="-110.8012"
                  required
                />
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <Label htmlFor="imagery">Imagery Files</Label>
            <Input
              id="imagery"
              type="file"
              multiple
              accept=".tif,.tiff,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              required
            />
            <p className="text-sm text-muted-foreground">
              Supported formats: GeoTIFF (.tif), JPEG, PNG. You can select multiple files.
            </p>
          </div>

          {/* Access Control */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={handleSwitchChange}
              />
              <Label htmlFor="isPublic">Make publicly visible</Label>
            </div>

            {!formData.isPublic && (
              <div>
                <Label htmlFor="password">Access Password (Optional)</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Leave blank for admin-only access"
                />
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading{selectedFiles ? ` (${(Array.from(selectedFiles).reduce((s, f) => s + f.size, 0) / (1024 * 1024 * 1024)).toFixed(2)} GB)` : ''}...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-3">
                <div 
                  className="bg-primary h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <p className="text-xs text-muted-foreground">Large files may take several minutes. Please keep this window open.</p>
              )}
              {uploadProgress === 100 && (
                <p className="text-xs text-muted-foreground">Upload complete, processing file on server...</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isUploading}
              className="flex-1"
            >
              {isUploading ? 'Uploading...' : 'Upload Imagery'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}