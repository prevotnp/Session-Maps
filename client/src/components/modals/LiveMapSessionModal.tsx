import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Plus, 
  LogIn, 
  MapPin, 
  Clock, 
  Trash2,
  Radio,
  Mail,
  Check,
  X
} from "lucide-react";

interface LiveMapSession {
  id: number;
  ownerId: number;
  name: string;
  shareCode: string;
  isActive: boolean;
  createdAt: string;
}

interface LiveMapInvite {
  id: number;
  sessionId: number;
  fromUserId: number;
  toUserId: number;
  status: string;
  createdAt: string;
  session: LiveMapSession;
  fromUser: {
    id: number;
    username: string;
    fullName: string | null;
  };
}

interface AuthUser {
  id: number;
  username: string;
}

interface LiveMapSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiveMapSessionModal({ isOpen, onClose }: LiveMapSessionModalProps) {
  const [, setLocation] = useLocation();
  const { user: rawUser } = useAuth();
  const user = rawUser as AuthUser | undefined;
  const { toast } = useToast();
  
  const [newSessionName, setNewSessionName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  
  const { data: sessions = [], isLoading } = useQuery<LiveMapSession[]>({
    queryKey: ['/api/live-maps'],
    enabled: isOpen
  });
  
  // Fetch pending invites
  const { data: invites = [] } = useQuery<LiveMapInvite[]>({
    queryKey: ['/api/live-map-invites'],
    enabled: isOpen
  });
  
  const createSessionMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest('POST', '/api/live-maps', { name });
      return res.json();
    },
    onSuccess: (data: LiveMapSession) => {
      queryClient.invalidateQueries({ queryKey: ['/api/live-maps'] });
      toast({ title: "Session created", description: `Share code: ${data.shareCode}` });
      setNewSessionName("");
      onClose();
      setLocation(`/live-map/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create session", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });
  
  const joinSessionMutation = useMutation({
    mutationFn: async (shareCode: string) => {
      const res = await apiRequest('POST', '/api/live-maps/join', { shareCode });
      return res.json();
    },
    onSuccess: (data: LiveMapSession) => {
      toast({ title: "Joined session", description: `Welcome to ${data.name}` });
      setJoinCode("");
      onClose();
      setLocation(`/live-map/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to join", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });
  
  const deleteSessionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/live-maps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/live-maps'] });
      toast({ title: "Session deleted" });
    }
  });
  
  // Respond to invite mutation
  const respondToInviteMutation = useMutation({
    mutationFn: async ({ inviteId, status }: { inviteId: number; status: 'accepted' | 'declined' }) => {
      const res = await apiRequest('PATCH', `/api/live-map-invites/${inviteId}`, { status });
      return res.json();
    },
    onSuccess: (data, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/live-map-invites'] });
      queryClient.invalidateQueries({ queryKey: ['/api/live-maps'] });
      if (status === 'accepted') {
        toast({ title: "Invite accepted!" });
        onClose();
        setLocation(`/live-map/${data.sessionId}`);
      } else {
        toast({ title: "Invite declined" });
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to respond", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });
  
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSessionName.trim()) {
      createSessionMutation.mutate(newSessionName.trim());
    }
  };
  
  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      joinSessionMutation.mutate(joinCode.trim());
    }
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-green-500" />
            Live Team Maps
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="sessions" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sessions" data-testid="tab-my-sessions">
              My Sessions
            </TabsTrigger>
            <TabsTrigger value="create" data-testid="tab-create">
              Create
            </TabsTrigger>
            <TabsTrigger value="join" data-testid="tab-join">
              Join
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="sessions" className="mt-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No live team map sessions yet</p>
                <p className="text-sm mt-1">Create one or join an invite</p>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {sessions.map(session => (
                    <Card 
                      key={session.id} 
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => {
                        onClose();
                        setLocation(`/live-map/${session.id}`);
                      }}
                      data-testid={`session-${session.id}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium truncate">{session.name}</h4>
                              {session.isActive ? (
                                <Badge variant="default" className="bg-green-600 text-xs">
                                  Live
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  Ended
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(session.createdAt)}
                              </span>
                              <span className="font-mono">{session.shareCode}</span>
                            </div>
                          </div>
                          {session.ownerId === user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSessionMutation.mutate(session.id);
                              }}
                              data-testid={`delete-session-${session.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
          
          <TabsContent value="create" className="mt-4">
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-name">Session Name</Label>
                <Input
                  id="session-name"
                  placeholder="e.g., Field Survey Team"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  data-testid="input-session-name"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={!newSessionName.trim() || createSessionMutation.isPending}
                data-testid="button-create-session"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createSessionMutation.isPending ? 'Creating...' : 'Create Live Team Map'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                A share code will be generated that you can send to team members
              </p>
            </form>
          </TabsContent>
          
          <TabsContent value="join" className="mt-4">
            <ScrollArea className="h-72">
              <div className="space-y-4">
                {/* Pending Invites Section */}
                {invites.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2 text-orange-500">
                      <Mail className="w-4 h-4" />
                      You've Been Invited ({invites.length})
                    </h4>
                    {invites.map(invite => (
                      <Card 
                        key={invite.id} 
                        className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30"
                        data-testid={`invite-${invite.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{invite.session.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                From {invite.fromUser.fullName || invite.fromUser.username}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-2"
                                disabled={respondToInviteMutation.isPending}
                                onClick={() => respondToInviteMutation.mutate({ inviteId: invite.id, status: 'accepted' })}
                                data-testid={`accept-invite-${invite.id}`}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                disabled={respondToInviteMutation.isPending}
                                onClick={() => respondToInviteMutation.mutate({ inviteId: invite.id, status: 'declined' })}
                                data-testid={`decline-invite-${invite.id}`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                
                {invites.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No pending invites</p>
                  </div>
                )}
                
                {/* Share Code Form */}
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground text-center mb-3">
                    Or join with a share code
                  </p>
                  <form onSubmit={handleJoinSession} className="space-y-3">
                    <Input
                      id="share-code"
                      placeholder="Enter code..."
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="font-mono text-lg tracking-widest text-center"
                      data-testid="input-share-code"
                    />
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={!joinCode.trim() || joinSessionMutation.isPending}
                      data-testid="button-join-session"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      {joinSessionMutation.isPending ? 'Joining...' : 'Join'}
                    </Button>
                  </form>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
