import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  User, MapPin, Lock, Globe, UserPlus, UserMinus, Clock,
  Route as RouteIcon, Activity, 
  ChevronDown, ChevronUp, Navigation 
} from "lucide-react";
import type { Route, Activity as ActivityType } from "@shared/schema";

interface FriendProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  onViewRoute: (route: Route) => void;
}

interface ProfileData {
  user: {
    id: number;
    username: string;
    fullName: string | null;
    email?: string;
    createdAt: string;
  };
  isFriend: boolean;
  isOwner: boolean;
  publicRouteCount: number;
  publicActivityCount: number;
  routes: Route[];
  activities: ActivityType[];
}

interface FriendRequest {
  id: number;
  senderId: number;
  receiverId: number;
  status: string;
}

export function FriendProfileModal({ isOpen, onClose, username, onViewRoute }: FriendProfileModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [routesExpanded, setRoutesExpanded] = useState(true);
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);

  const { data: profile, isLoading, error } = useQuery<ProfileData>({
    queryKey: ["/api/profiles", username],
    queryFn: async () => {
      const response = await fetch(`/api/profiles/${username}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
    enabled: isOpen && !!username,
  });

  const { data: sentRequests = [] } = useQuery<FriendRequest[]>({
    queryKey: ["/api/friend-requests/sent"],
    enabled: isOpen && !!profile && !profile.isFriend && !profile.isOwner,
  });

  const hasPendingRequest = profile?.user?.id
    ? sentRequests.some(r => r.receiverId === profile.user.id && r.status === 'pending')
    : false;

  const sendFriendRequest = useMutation({
    mutationFn: async (receiverId: number) => {
      return apiRequest("POST", "/api/friend-requests", { receiverId });
    },
    onSuccess: () => {
      toast({ title: "Friend request sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests/sent"] });
    },
    onError: () => {
      toast({ title: "Failed to send request", variant: "destructive" });
    },
  });

  const removeFriend = useMutation({
    mutationFn: async (friendId: number) => {
      return apiRequest("DELETE", `/api/friends/${friendId}`);
    },
    onSuccess: () => {
      toast({ title: "Friend removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", username] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: () => {
      toast({ title: "Failed to remove friend", variant: "destructive" });
    },
  });

  const handleViewRoute = (route: Route) => {
    onViewRoute(route);
    onClose();
  };

  const formatDistance = (meters: string | number | null) => {
    if (!meters) return '0 mi';
    const m = typeof meters === 'string' ? parseFloat(meters) : meters;
    return (m / 1609.34).toFixed(1) + ' mi';
  };

  const formatElevation = (meters: string | number | null) => {
    if (!meters) return '0 ft';
    const m = typeof meters === 'string' ? parseFloat(meters) : meters;
    return Math.round(m * 3.28084).toLocaleString() + ' ft';
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const userInitials = profile?.user?.fullName
    ? profile.user.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
    : (username || '').substring(0, 2).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-destructive mb-2">Failed to load profile</div>
            <div className="text-sm text-gray-500">User not found or you don't have permission</div>
          </div>
        ) : profile && !profile.isFriend && !profile.isOwner ? (
          <div className="flex flex-col items-center py-8">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${username}`} alt={username} />
              <AvatarFallback className="text-xl bg-primary text-white">{userInitials}</AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-bold text-white">{profile.user.fullName || profile.user.username}</h2>
            <p className="text-gray-400 mb-6">@{profile.user.username}</p>

            {hasPendingRequest ? (
              <Button variant="outline" className="mb-4" disabled>
                <Clock className="h-4 w-4 mr-2" />
                Friend request sent
              </Button>
            ) : (
              <Button
                className="mb-4"
                onClick={() => sendFriendRequest.mutate(profile.user.id)}
                disabled={sendFriendRequest.isPending}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {sendFriendRequest.isPending ? 'Sending...' : 'Add Friend'}
              </Button>
            )}

            <div className="flex items-center gap-2 text-gray-500 bg-gray-800 rounded-lg px-4 py-3">
              <Lock className="h-5 w-5" />
              <span className="text-sm">Add as a friend to see their routes and activities</span>
            </div>
          </div>
        ) : profile ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4">
              <Avatar className="h-20 w-20 mb-3">
                <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${username}`} alt={username} />
                <AvatarFallback className="text-xl bg-primary text-white">{userInitials}</AvatarFallback>
              </Avatar>
              <h2 className="text-lg font-bold text-white">{profile.user.fullName || profile.user.username}</h2>
              <p className="text-gray-400">@{profile.user.username}</p>
              {profile.user.email && (
                <p className="text-gray-500 text-sm mt-1">{profile.user.email}</p>
              )}
              {profile.isFriend && !profile.isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-red-400 border-red-400/50 hover:bg-red-400/10"
                  onClick={() => removeFriend.mutate(profile.user.id)}
                  disabled={removeFriend.isPending}
                >
                  <UserMinus className="h-4 w-4 mr-1" />
                  {removeFriend.isPending ? 'Removing...' : 'Unfriend'}
                </Button>
              )}
            </div>

            <div className="flex justify-center gap-8 py-3 border-y border-gray-700">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{profile.publicRouteCount}</div>
                <div className="text-xs text-gray-400">Public Routes</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">{profile.publicActivityCount}</div>
                <div className="text-xs text-gray-400">Public Activities</div>
              </div>
            </div>

            <div className="border border-gray-700 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 text-left"
                onClick={() => setRoutesExpanded(!routesExpanded)}
              >
                <div className="flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-blue-400" />
                  <span className="font-medium text-white text-sm">Routes ({profile.routes.length})</span>
                </div>
                {routesExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {routesExpanded && (
                <div className="border-t border-gray-700 max-h-60 overflow-y-auto">
                  {profile.routes.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No public routes yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {profile.routes.map((route) => (
                        <div key={route.id} className="flex items-center gap-3 p-3 px-4" data-testid={`profile-route-${route.id}`}>
                          {route.isPublic ? (
                            <Globe className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <Lock className="h-4 w-4 text-yellow-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{route.name}</div>
                            <div className="text-xs text-gray-500">
                              {formatDistance(route.totalDistance)} · {formatElevation(route.elevationGain)} · <span className="capitalize">{route.routingMode}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 text-blue-400 hover:text-blue-300 text-xs"
                            onClick={() => handleViewRoute(route)}
                            data-testid={`button-view-route-${route.id}`}
                          >
                            <Navigation className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border border-gray-700 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 text-left"
                onClick={() => setActivitiesExpanded(!activitiesExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-orange-400" />
                  <span className="font-medium text-white text-sm">Activities ({profile.activities.length})</span>
                </div>
                {activitiesExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {activitiesExpanded && (
                <div className="border-t border-gray-700 max-h-60 overflow-y-auto">
                  {profile.activities.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No public activities yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {profile.activities.map((activity) => (
                        <div key={activity.id} className="flex items-center gap-3 p-3 px-4">
                          {activity.isPublic ? (
                            <Globe className="h-4 w-4 text-green-500 shrink-0" />
                          ) : (
                            <Lock className="h-4 w-4 text-yellow-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{activity.name}</div>
                            <div className="text-xs text-gray-500">
                              {formatDistance(activity.distanceMeters)} · {formatDuration(activity.elapsedTimeSeconds)} · <span className="capitalize">{activity.activityType}</span>
                            </div>
                          </div>
                          <ChevronDown className="h-4 w-4 text-gray-500 shrink-0 -rotate-90" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
