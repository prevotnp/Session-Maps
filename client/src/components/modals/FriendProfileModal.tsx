import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, MapPin, Lock, Globe } from "lucide-react";
import type { User as UserType, Route } from "@shared/schema";

interface FriendProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  onViewRoute: (route: Route) => void;
}

interface UserProfile {
  user: UserType;
  routes: Route[];
}

export function FriendProfileModal({ isOpen, onClose, username, onViewRoute }: FriendProfileModalProps) {
  const { data: profile, isLoading, error } = useQuery<UserProfile>({
    queryKey: ["/api/profiles", username],
    queryFn: async () => {
      const response = await fetch(`/api/profiles/${username}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    },
    enabled: isOpen && !!username,
  });

  const handleViewRoute = (route: Route) => {
    onViewRoute(route);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading profile...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-2">Failed to load profile</div>
            <div className="text-sm text-muted-foreground">User not found or you don't have permission to view this profile</div>
          </div>
        ) : profile ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* User Info */}
            <div className="bg-accent/30 rounded-lg p-6 mb-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{profile.user.fullName || profile.user.username}</h2>
                  <p className="text-muted-foreground">@{profile.user.username}</p>
                  {profile.user.email && (
                    <p className="text-sm text-muted-foreground mt-1">{profile.user.email}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Routes Section */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">Routes</h3>
                <div className="text-sm text-muted-foreground">
                  {profile.routes.length} {profile.routes.length === 1 ? 'route' : 'routes'}
                </div>
              </div>

              <ScrollArea className="flex-1">
                {profile.routes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MapPin className="h-12 w-12 mb-2 opacity-50" />
                    <p>No public routes yet</p>
                    <p className="text-sm mt-1">This user hasn't shared any routes publicly</p>
                  </div>
                ) : (
                  <div className="space-y-3 pr-4">
                    {profile.routes.map((route) => {
                      const distanceMeters = route.totalDistance 
                        ? parseFloat(route.totalDistance.toString())
                        : 0;
                      const distanceMiles = (distanceMeters / 1609.34).toFixed(2);
                      const elevationGainMeters = route.elevationGain 
                        ? parseFloat(route.elevationGain.toString())
                        : 0;
                      const elevationGainFeet = Math.round(elevationGainMeters * 3.28084);

                      return (
                        <div
                          key={route.id}
                          className="border rounded-lg p-4 hover:bg-accent/30 transition-colors"
                          data-testid={`profile-route-${route.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-lg">{route.name}</h4>
                                {route.isPublic ? (
                                  <span title="Public"><Globe className="h-4 w-4 text-green-600" /></span>
                                ) : (
                                  <span title="Shared with you"><Lock className="h-4 w-4 text-yellow-600" /></span>
                                )}
                              </div>
                              {route.description && (
                                <p className="text-sm text-muted-foreground mb-2">{route.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                            <div>
                              <div className="text-muted-foreground text-xs">Distance</div>
                              <div className="font-medium">{distanceMiles} mi</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Elevation Gain</div>
                              <div className="font-medium">{elevationGainFeet} ft</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Type</div>
                              <div className="font-medium capitalize">{route.routingMode}</div>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewRoute(route)}
                            className="w-full"
                            data-testid={`button-view-route-${route.id}`}
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            View on Map
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
