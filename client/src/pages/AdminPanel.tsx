import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import DroneImageryUpload from '@/components/DroneImageryUpload';
import { Upload, MapPin, Settings, Eye, EyeOff, Building2, Plus, Trash2, Copy, ChevronDown, ChevronRight, Users, Image, Box } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function AdminPanel() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Enterprise management state
  const [showCreateEnterprise, setShowCreateEnterprise] = useState(false);
  const [newEnterpriseName, setNewEnterpriseName] = useState('');
  const [newEnterpriseDescription, setNewEnterpriseDescription] = useState('');
  const [newEnterpriseMaxMembers, setNewEnterpriseMaxMembers] = useState('50');
  const [expandedEnterpriseId, setExpandedEnterpriseId] = useState<number | null>(null);
  const [selectedDroneImageId, setSelectedDroneImageId] = useState<string>('');
  const [selectedTilesetId, setSelectedTilesetId] = useState<string>('');

  const { data: droneImages = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/admin/drone-images'],
    enabled: !!user?.isAdmin,
  });

  // Enterprise queries
  const { data: enterprises = [], isLoading: isLoadingEnterprises } = useQuery<any[]>({
    queryKey: ['/api/enterprises'],
    enabled: !!user?.isAdmin,
  });

  const { data: allTilesets = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/cesium-tilesets'],
    enabled: !!user?.isAdmin,
  });

  const { data: enterpriseDetails, isLoading: isLoadingDetails } = useQuery<any>({
    queryKey: [`/api/enterprises/${expandedEnterpriseId}/details`],
    enabled: !!user?.isAdmin && expandedEnterpriseId !== null,
  });

  const { data: enterpriseInvites = [] } = useQuery<any[]>({
    queryKey: [`/api/enterprises/${expandedEnterpriseId}/invites`],
    enabled: !!user?.isAdmin && expandedEnterpriseId !== null,
  });

  // Enterprise mutations
  const createEnterprise = useMutation({
    mutationFn: async (data: { name: string; description: string; maxMembers: number }) => {
      const res = await apiRequest('POST', '/api/enterprises', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprises'] });
      setShowCreateEnterprise(false);
      setNewEnterpriseName('');
      setNewEnterpriseDescription('');
      setNewEnterpriseMaxMembers('50');
      toast({ title: 'Enterprise created', description: 'The enterprise has been created successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const assignDroneImage = useMutation({
    mutationFn: async ({ enterpriseId, droneImageId }: { enterpriseId: number; droneImageId: number }) => {
      const res = await apiRequest('POST', `/api/enterprises/${enterpriseId}/drone-images`, { droneImageId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enterprises/${expandedEnterpriseId}/details`] });
      setSelectedDroneImageId('');
      toast({ title: 'Drone image assigned', description: 'The drone image has been assigned to the enterprise.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeDroneImage = useMutation({
    mutationFn: async ({ enterpriseId, droneImageId }: { enterpriseId: number; droneImageId: number }) => {
      await apiRequest('DELETE', `/api/enterprises/${enterpriseId}/drone-images/${droneImageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enterprises/${expandedEnterpriseId}/details`] });
      toast({ title: 'Drone image removed', description: 'The drone image has been removed from the enterprise.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const assignTileset = useMutation({
    mutationFn: async ({ enterpriseId, cesiumTilesetId }: { enterpriseId: number; cesiumTilesetId: number }) => {
      const res = await apiRequest('POST', `/api/enterprises/${enterpriseId}/cesium-tilesets`, { cesiumTilesetId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enterprises/${expandedEnterpriseId}/details`] });
      setSelectedTilesetId('');
      toast({ title: 'Tileset assigned', description: 'The Cesium tileset has been assigned to the enterprise.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeTileset = useMutation({
    mutationFn: async ({ enterpriseId, tilesetId }: { enterpriseId: number; tilesetId: number }) => {
      await apiRequest('DELETE', `/api/enterprises/${enterpriseId}/cesium-tilesets/${tilesetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enterprises/${expandedEnterpriseId}/details`] });
      toast({ title: 'Tileset removed', description: 'The Cesium tileset has been removed from the enterprise.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const createInvite = useMutation({
    mutationFn: async (enterpriseId: number) => {
      const res = await apiRequest('POST', `/api/enterprises/${enterpriseId}/invites`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enterprises/${expandedEnterpriseId}/invites`] });
      toast({ title: 'Invite created', description: 'A new invite code has been generated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
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

        {/* Enterprise Management */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Enterprise Management
                </CardTitle>
                <CardDescription>
                  Create and manage enterprises, assign drone images and tilesets
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowCreateEnterprise(!showCreateEnterprise)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Enterprise
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Create Enterprise Form */}
            {showCreateEnterprise && (
              <div className="mb-6 p-4 border rounded-lg space-y-4">
                <h3 className="font-semibold">Create New Enterprise</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name *</label>
                    <Input
                      value={newEnterpriseName}
                      onChange={(e) => setNewEnterpriseName(e.target.value)}
                      placeholder="Enterprise name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Max Members</label>
                    <Input
                      type="number"
                      value={newEnterpriseMaxMembers}
                      onChange={(e) => setNewEnterpriseMaxMembers(e.target.value)}
                      placeholder="50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <Input
                    value={newEnterpriseDescription}
                    onChange={(e) => setNewEnterpriseDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      if (!newEnterpriseName.trim()) return;
                      createEnterprise.mutate({
                        name: newEnterpriseName.trim(),
                        description: newEnterpriseDescription.trim(),
                        maxMembers: parseInt(newEnterpriseMaxMembers) || 50,
                      });
                    }}
                    disabled={!newEnterpriseName.trim() || createEnterprise.isPending}
                  >
                    {createEnterprise.isPending ? 'Creating...' : 'Create Enterprise'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateEnterprise(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Enterprise List */}
            {isLoadingEnterprises ? (
              <div className="text-center py-8">Loading enterprises...</div>
            ) : enterprises.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No enterprises yet</p>
                <p className="text-muted-foreground">Create your first enterprise to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {enterprises.map((enterprise: any) => (
                  <div key={enterprise.id} className="border rounded-lg">
                    {/* Enterprise Row */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedEnterpriseId(
                        expandedEnterpriseId === enterprise.id ? null : enterprise.id
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {expandedEnterpriseId === enterprise.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <h3 className="font-semibold">{enterprise.name}</h3>
                          {enterprise.description && (
                            <p className="text-sm text-muted-foreground">{enterprise.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={enterprise.isActive !== false ? "default" : "secondary"}>
                          {enterprise.isActive !== false ? "Active" : "Inactive"}
                        </Badge>
                        {enterprise.maxMembers && (
                          <span className="text-xs text-muted-foreground">
                            Max {enterprise.maxMembers} members
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded Enterprise Detail */}
                    {expandedEnterpriseId === enterprise.id && (
                      <div className="border-t p-4 space-y-6">
                        {isLoadingDetails ? (
                          <div className="text-center py-4">Loading details...</div>
                        ) : (
                          <>
                            {/* Drone Image Assignments */}
                            <div>
                              <h4 className="font-medium flex items-center gap-2 mb-3">
                                <Image className="h-4 w-4" />
                                Drone Images
                              </h4>
                              <div className="flex gap-2 mb-3">
                                <Select value={selectedDroneImageId} onValueChange={setSelectedDroneImageId}>
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select a drone image to assign" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {droneImages
                                      .filter((img: any) => {
                                        const assigned = enterpriseDetails?.droneImages || [];
                                        return !assigned.some((a: any) => a.id === img.id);
                                      })
                                      .map((img: any) => (
                                        <SelectItem key={img.id} value={String(img.id)}>
                                          {img.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (selectedDroneImageId) {
                                      assignDroneImage.mutate({
                                        enterpriseId: enterprise.id,
                                        droneImageId: parseInt(selectedDroneImageId),
                                      });
                                    }
                                  }}
                                  disabled={!selectedDroneImageId || assignDroneImage.isPending}
                                >
                                  Assign
                                </Button>
                              </div>
                              {(enterpriseDetails?.droneImages || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No drone images assigned</p>
                              ) : (
                                <div className="space-y-2">
                                  {(enterpriseDetails?.droneImages || []).map((img: any) => (
                                    <div key={img.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                      <span className="text-sm">{img.name}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeDroneImage.mutate({
                                          enterpriseId: enterprise.id,
                                          droneImageId: img.id,
                                        })}
                                        disabled={removeDroneImage.isPending}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Cesium Tileset Assignments */}
                            <div>
                              <h4 className="font-medium flex items-center gap-2 mb-3">
                                <Box className="h-4 w-4" />
                                Cesium Tilesets
                              </h4>
                              <div className="flex gap-2 mb-3">
                                <Select value={selectedTilesetId} onValueChange={setSelectedTilesetId}>
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select a tileset to assign" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allTilesets
                                      .filter((ts: any) => {
                                        const assigned = enterpriseDetails?.cesiumTilesets || [];
                                        return !assigned.some((a: any) => a.id === ts.id);
                                      })
                                      .map((ts: any) => (
                                        <SelectItem key={ts.id} value={String(ts.id)}>
                                          {ts.name}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (selectedTilesetId) {
                                      assignTileset.mutate({
                                        enterpriseId: enterprise.id,
                                        cesiumTilesetId: parseInt(selectedTilesetId),
                                      });
                                    }
                                  }}
                                  disabled={!selectedTilesetId || assignTileset.isPending}
                                >
                                  Assign
                                </Button>
                              </div>
                              {(enterpriseDetails?.cesiumTilesets || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No tilesets assigned</p>
                              ) : (
                                <div className="space-y-2">
                                  {(enterpriseDetails?.cesiumTilesets || []).map((ts: any) => (
                                    <div key={ts.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                      <span className="text-sm">{ts.name}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeTileset.mutate({
                                          enterpriseId: enterprise.id,
                                          tilesetId: ts.id,
                                        })}
                                        disabled={removeTileset.isPending}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Members */}
                            <div>
                              <h4 className="font-medium flex items-center gap-2 mb-3">
                                <Users className="h-4 w-4" />
                                Members ({(enterpriseDetails?.members || []).length})
                              </h4>
                              {(enterpriseDetails?.members || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No members yet</p>
                              ) : (
                                <div className="space-y-2">
                                  {(enterpriseDetails?.members || []).map((member: any) => (
                                    <div key={member.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                      <div>
                                        <span className="text-sm font-medium">{member.fullName || member.username}</span>
                                        <span className="text-xs text-muted-foreground ml-2">@{member.username}</span>
                                      </div>
                                      <Badge variant="outline">{member.role}</Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Invite Codes */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium">Invite Codes</h4>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => createInvite.mutate(enterprise.id)}
                                  disabled={createInvite.isPending}
                                  className="flex items-center gap-2"
                                >
                                  <Plus className="h-3 w-3" />
                                  {createInvite.isPending ? 'Creating...' : 'Generate Code'}
                                </Button>
                              </div>
                              {enterpriseInvites.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No invite codes yet</p>
                              ) : (
                                <div className="space-y-2">
                                  {enterpriseInvites.map((invite: any) => (
                                    <div key={invite.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                      <div>
                                        <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                                          {invite.inviteCode}
                                        </code>
                                        <span className="text-xs text-muted-foreground ml-2">
                                          Used: {invite.usedCount || 0}/{invite.maxUses || 'unlimited'}
                                        </span>
                                        {invite.expiresAt && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(invite.inviteCode);
                                          toast({ title: 'Copied', description: 'Invite code copied to clipboard.' });
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
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