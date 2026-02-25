import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Share2, Mail, User as UserIcon } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ShareRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  routeId: number;
  routeName: string;
}

interface RouteShare {
  id: number;
  routeId: number;
  sharedWithUserId: number;
  sharedByUserId: number;
  sharedAt: string;
  sharedWith: {
    id: number;
    username: string;
    email: string;
    fullName: string | null;
  };
}

export function ShareRouteModal({ isOpen, onClose, routeId, routeName }: ShareRouteModalProps) {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const { toast } = useToast();

  // Fetch existing shares
  const { data: shares = [], isLoading: isLoadingShares } = useQuery<RouteShare[]>({
    queryKey: ["/api/routes", routeId, "shares"],
    queryFn: async () => {
      const response = await fetch(`/api/routes/${routeId}/shares`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch shares');
      }
      return response.json();
    },
    enabled: isOpen,
  });

  // Share route mutation
  const shareMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/routes/${routeId}/share`, {
        emailOrUsername: emailOrUsername.trim(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Route shared",
        description: "The route has been shared successfully",
      });
      setEmailOrUsername("");
      queryClient.invalidateQueries({ queryKey: ["/api/routes", routeId, "shares"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error sharing route",
        description: error.message || "Failed to share route",
      });
    },
  });

  // Revoke share mutation
  const revokeMutation = useMutation({
    mutationFn: async (shareId: number) => {
      return await apiRequest("DELETE", `/api/routes/${routeId}/shares/${shareId}`);
    },
    onSuccess: () => {
      toast({
        title: "Access revoked",
        description: "User can no longer access this route",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/routes", routeId, "shares"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error revoking access",
        description: error.message || "Failed to revoke access",
      });
    },
  });

  const handleShare = () => {
    if (!emailOrUsername.trim()) {
      toast({
        variant: "destructive",
        title: "Email or username required",
        description: "Please enter an email or username to share with",
      });
      return;
    }
    shareMutation.mutate();
  };

  const handleRevoke = (shareId: number) => {
    revokeMutation.mutate(shareId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Share2 className="w-5 h-5" />
            Share "{routeName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Share input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Share with friend
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  data-testid="input-share-email"
                  placeholder="Enter email or username"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleShare();
                    }
                  }}
                  className="pl-9 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  disabled={shareMutation.isPending}
                />
              </div>
              <Button
                data-testid="button-share"
                onClick={handleShare}
                disabled={shareMutation.isPending || !emailOrUsername.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {shareMutation.isPending ? "Sharing..." : "Share"}
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter the email address or username of the person you want to share this route with
            </p>
          </div>

          {/* Shared with list */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Shared with
            </label>
            
            {isLoadingShares ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Loading...
              </div>
            ) : shares.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <Share2 className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm">Not shared with anyone yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    data-testid={`share-item-${share.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">
                          {share.sharedWith.fullName || share.sharedWith.username}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {share.sharedWith.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      data-testid={`button-revoke-${share.id}`}
                      onClick={() => handleRevoke(share.id)}
                      variant="ghost"
                      size="sm"
                      disabled={revokeMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
