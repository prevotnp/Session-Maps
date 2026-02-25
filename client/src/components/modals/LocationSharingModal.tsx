import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Users, UserPlus, Clock, Check, X, Trash2 } from "lucide-react";

interface LocationSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LocationShare {
  id: number;
  fromUserId: number;
  toUserId: number;
  status: string;
  fromUsername: string;
  toUsername: string;
  requestedAt: string;
  respondedAt?: string;
}

interface PendingShare {
  id: number;
  fromUserId: number;
  fromUsername: string;
  requestedAt: string;
}

export default function LocationSharingModal({ isOpen, onClose }: LocationSharingModalProps) {
  const [username, setUsername] = useState("");
  const { toast } = useToast();

  // Fetch all location shares
  const { data: locationShares = [], isLoading: isLoadingShares } = useQuery<LocationShare[]>({
    queryKey: ["/api/location-shares"],
    enabled: isOpen,
  });

  // Fetch pending requests
  const { data: pendingShares = [], isLoading: isLoadingPending } = useQuery<PendingShare[]>({
    queryKey: ["/api/location-shares/pending"],
    enabled: isOpen,
  });

  // Send location share request
  const sendRequestMutation = useMutation({
    mutationFn: async (targetUsername: string) => {
      const res = await apiRequest("POST", "/api/location-shares", { username: targetUsername });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Location share request sent",
        description: data.message,
      });
      setUsername("");
      queryClient.invalidateQueries({ queryKey: ["/api/location-shares"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Accept/reject location share request
  const respondToRequestMutation = useMutation({
    mutationFn: async ({ shareId, status }: { shareId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/location-shares/${shareId}`, { status });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Request responded",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/location-shares"] });
      queryClient.invalidateQueries({ queryKey: ["/api/location-shares/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shared-locations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to respond to request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete location share
  const deleteShareMutation = useMutation({
    mutationFn: async (shareId: number) => {
      const res = await apiRequest("DELETE", `/api/location-shares/${shareId}`);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Location share removed",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/location-shares"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shared-locations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove share",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendRequest = () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to share your location with",
        variant: "destructive",
      });
      return;
    }
    sendRequestMutation.mutate(username.trim());
  };

  const handleAcceptRequest = (shareId: number) => {
    respondToRequestMutation.mutate({ shareId, status: "accepted" });
  };

  const handleRejectRequest = (shareId: number) => {
    respondToRequestMutation.mutate({ shareId, status: "rejected" });
  };

  const handleDeleteShare = (shareId: number) => {
    deleteShareMutation.mutate(shareId);
  };

  const acceptedShares = locationShares.filter(share => share.status === "accepted");
  const sentRequests = locationShares.filter(share => share.status === "pending");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Location Sharing
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="share" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="share">Share</TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {pendingShares.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                  {pendingShares.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Share your location with a friend</Label>
              <div className="flex gap-2">
                <Input
                  id="username"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendRequest()}
                />
                <Button
                  onClick={handleSendRequest}
                  disabled={sendRequestMutation.isPending || !username.trim()}
                  size="sm"
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter your friend's username to send them a location sharing request
              </p>
            </div>

            {sentRequests.length > 0 && (
              <div className="space-y-2">
                <Label>Pending Requests Sent</Label>
                <div className="space-y-2">
                  {sentRequests.map((share) => (
                    <div key={share.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{share.toUsername}</span>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteShare(share.id)}
                        disabled={deleteShareMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {isLoadingPending ? (
              <div className="text-center py-4">Loading requests...</div>
            ) : pendingShares.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No pending location share requests
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Incoming Requests</Label>
                <div className="space-y-2">
                  {pendingShares.map((share) => (
                    <div key={share.id} className="p-3 border rounded space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{share.fromUsername}</span>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Wants to share location with you
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(share.id)}
                          disabled={respondToRequestMutation.isPending}
                          className="flex-1"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(share.id)}
                          disabled={respondToRequestMutation.isPending}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {isLoadingShares ? (
              <div className="text-center py-4">Loading active shares...</div>
            ) : acceptedShares.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No active location shares
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Active Location Shares</Label>
                <div className="space-y-2">
                  {acceptedShares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm">
                          {share.fromUsername === share.toUsername ? 
                            `Sharing with ${share.toUsername}` : 
                            `${share.fromUsername} sharing with you`}
                        </span>
                        <Badge variant="secondary">Active</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteShare(share.id)}
                        disabled={deleteShareMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}