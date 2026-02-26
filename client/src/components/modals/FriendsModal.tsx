import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Users, UserPlus, Bell, Search as SearchIcon, X, Check, UserMinus, Eye, MapPin } from "lucide-react";
import type { User } from "@shared/schema";

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewProfile: (username: string) => void;
}

interface Friendship {
  id: number;
  friend: User;
}

interface FriendRequest {
  id: number;
  requester?: User;
  receiver?: User;
  status: string;
  createdAt: string;
}

export function FriendsModal({ isOpen, onClose, onViewProfile }: FriendsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const isLocationSharing = (user as any)?.locationSharingEnabled ?? true;
  const { toast } = useToast();

  const toggleGlobalLocationMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest('PATCH', '/api/user/location-sharing', { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    }
  });

  const toggleFriendLocationMutation = useMutation({
    mutationFn: async ({ friendId, hidden }: { friendId: number; hidden: boolean }) => {
      await apiRequest('PATCH', `/api/friends/${friendId}/location-sharing`, { hidden });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
    }
  });

  // Fetch friends list
  const { data: friends = [], isLoading: isLoadingFriends } = useQuery<Friendship[]>({
    queryKey: ["/api/friends"],
    enabled: isOpen,
  });

  // Fetch pending friend requests (received)
  const { data: pendingRequests = [], isLoading: isLoadingPending } = useQuery<FriendRequest[]>({
    queryKey: ["/api/friend-requests/pending"],
    enabled: isOpen,
  });

  // Fetch sent friend requests
  const { data: sentRequests = [], isLoading: isLoadingSent } = useQuery<FriendRequest[]>({
    queryKey: ["/api/friend-requests/sent"],
    enabled: isOpen,
  });

  // Search users
  const { data: searchResults = [], isLoading: isSearching, refetch: searchUsers } = useQuery<User[]>({
    queryKey: ["/api/friends/search", searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      const response = await fetch(`/api/friends/search?query=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: false,
  });

  // Send friend request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async (receiverId: number) => {
      return await apiRequest("POST", "/api/friend-requests", { receiverId });
    },
    onSuccess: () => {
      toast({ title: "Friend request sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests/sent"] });
      setSearchQuery("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to send friend request",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  // Accept friend request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      return await apiRequest("PATCH", `/api/friend-requests/${requestId}/accept`);
    },
    onSuccess: () => {
      toast({ title: "Friend request accepted" });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to accept request",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Decline friend request mutation
  const declineRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      return await apiRequest("PATCH", `/api/friend-requests/${requestId}/decline`);
    },
    onSuccess: () => {
      toast({ title: "Friend request declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests/pending"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to decline request",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Cancel sent request mutation
  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      return await apiRequest("DELETE", `/api/friend-requests/${requestId}`);
    },
    onSuccess: () => {
      toast({ title: "Friend request cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests/sent"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to cancel request",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Remove friend mutation
  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: number) => {
      return await apiRequest("DELETE", `/api/friends/${friendId}`);
    },
    onSuccess: () => {
      toast({ title: "Friend removed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to remove friend",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.length >= 2) {
      searchUsers();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Friends
          </DialogTitle>
        </DialogHeader>

        {/* Share My Location Toggle */}
        <div className="flex items-center justify-between p-3 mb-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <MapPin className={`h-5 w-5 ${isLocationSharing ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="flex flex-col">
              <Label htmlFor="location-toggle" className="font-medium cursor-pointer">
                Share My Location
              </Label>
              <span className="text-xs text-muted-foreground">
                {isLocationSharing ? 'Friends can see where you are' : 'Your location is hidden from all friends'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${!isLocationSharing ? 'text-foreground' : 'text-muted-foreground'}`}>Off</span>
            <Switch
              id="location-toggle"
              checked={isLocationSharing}
              onCheckedChange={(checked) => toggleGlobalLocationMutation.mutate(checked)}
              disabled={toggleGlobalLocationMutation.isPending}
              data-testid="switch-location-sharing"
            />
            <span className={`text-xs font-medium ${isLocationSharing ? 'text-primary' : 'text-muted-foreground'}`}>On</span>
          </div>
        </div>

        <Tabs defaultValue="friends" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add Friends
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="friends" className="mt-0">
              {isLoadingFriends ? (
                <div className="text-center py-8 text-muted-foreground">Loading friends...</div>
              ) : friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No friends yet</p>
                  <p className="text-sm mt-1">Search for users to add friends</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friendship: any) => {
                    const isHidden = friendship.locationHidden ?? false;
                    const isSharingWithFriend = isLocationSharing && !isHidden;
                    
                    return (
                      <div
                        key={friendship.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50"
                        data-testid={`friend-item-${friendship.friend.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{friendship.friend.fullName || friendship.friend.username}</div>
                          <div className="text-sm text-muted-foreground">@{friendship.friend.username}</div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <MapPin className={`h-4 w-4 ${isSharingWithFriend ? 'text-primary' : 'text-muted-foreground'}`} />
                          <Switch
                            checked={!isHidden}
                            onCheckedChange={(checked) => {
                              toggleFriendLocationMutation.mutate({
                                friendId: friendship.friend.id,
                                hidden: !checked
                              });
                            }}
                            disabled={!isLocationSharing || toggleFriendLocationMutation.isPending}
                            className="scale-75"
                            data-testid={`switch-friend-location-${friendship.friend.id}`}
                          />
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onViewProfile(friendship.friend.username);
                              onClose();
                            }}
                            data-testid={`button-view-profile-${friendship.friend.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Profile
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFriendMutation.mutate(friendship.friend.id)}
                            disabled={removeFriendMutation.isPending}
                            data-testid={`button-remove-friend-${friendship.friend.id}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="requests" className="mt-0 space-y-6">
              {/* Pending Requests (Received) */}
              <div>
                <h3 className="font-semibold mb-3">Pending Requests</h3>
                {isLoadingPending ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
                ) : pendingRequests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">No pending requests</div>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`request-item-${request.id}`}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{request.requester?.fullName || request.requester?.username}</div>
                          <div className="text-sm text-muted-foreground">@{request.requester?.username}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => acceptRequestMutation.mutate(request.id)}
                            disabled={acceptRequestMutation.isPending}
                            data-testid={`button-accept-${request.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => declineRequestMutation.mutate(request.id)}
                            disabled={declineRequestMutation.isPending}
                            data-testid={`button-decline-${request.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent Requests */}
              <div>
                <h3 className="font-semibold mb-3">Sent Requests</h3>
                {isLoadingSent ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
                ) : sentRequests.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">No sent requests</div>
                ) : (
                  <div className="space-y-2">
                    {sentRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`sent-request-item-${request.id}`}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{request.receiver?.fullName || request.receiver?.username}</div>
                          <div className="text-sm text-muted-foreground">@{request.receiver?.username}</div>
                          <div className="text-xs text-yellow-600 mt-1">Pending</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelRequestMutation.mutate(request.id)}
                          disabled={cancelRequestMutation.isPending}
                          data-testid={`button-cancel-${request.id}`}
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="search" className="mt-0">
              <form onSubmit={handleSearch} className="mb-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by name, username, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-friends"
                  />
                  <Button type="submit" disabled={searchQuery.length < 2 || isSearching} data-testid="button-search">
                    <SearchIcon className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Enter at least 2 characters to search</p>
              </form>

              {isSearching ? (
                <div className="text-center py-8 text-muted-foreground">Searching...</div>
              ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <SearchIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((user) => {
                    const isFriend = friends.some(f => f.friend.id === user.id);
                    const hasPendingRequest = sentRequests.some(r => r.receiver?.id === user.id);
                    
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`search-result-${user.id}`}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{user.fullName || user.username}</div>
                          <div className="text-sm text-muted-foreground">@{user.username}</div>
                        </div>
                        {isFriend ? (
                          <div className="text-sm text-green-600 font-medium">Friends ✓</div>
                        ) : hasPendingRequest ? (
                          <div className="text-sm text-yellow-600">Request Sent</div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendRequestMutation.mutate(user.id)}
                            disabled={sendRequestMutation.isPending}
                            data-testid={`button-add-friend-${user.id}`}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add Friend
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
