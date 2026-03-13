import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Building2, ArrowRight, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface EnterpriseMembership {
  id: number;
  enterpriseId: number;
  role: string;
  status: string;
  enterprise: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
  };
}

interface EnterpriseSelectorProps {
  onClose?: () => void;
}

const EnterpriseSelector: React.FC<EnterpriseSelectorProps> = ({ onClose }) => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [inviteCode, setInviteCode] = useState('');

  const { data: memberships = [] } = useQuery<EnterpriseMembership[]>({
    queryKey: ["/api/my-enterprises"],
  });

  const joinMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/enterprises/join", { inviteCode: code });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Joined!", description: data.message || `You've joined the enterprise.` });
      setInviteCode('');
      queryClient.invalidateQueries({ queryKey: ["/api/my-enterprises"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to join enterprise", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4 p-4 max-h-[70vh] overflow-y-auto">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Building2 className="h-5 w-5" />
        Enterprise
      </h2>

      {memberships.length > 0 ? (
        <div className="space-y-3">
          {memberships.map((m) => (
            <Card key={m.enterpriseId} className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{m.enterprise.name}</h3>
                    {m.enterprise.description && (
                      <p className="text-sm text-white/60 mt-0.5">{m.enterprise.description}</p>
                    )}
                    <Badge variant="outline" className="mt-1 text-xs">{m.role}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigate(`/enterprise/${m.enterpriseId}`);
                      onClose?.();
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/60">You don't belong to any enterprise yet.</p>
      )}

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Join Enterprise
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Input
              placeholder="Enter invite code (e.g. JHMR-A8K2F9)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inviteCode.trim()) {
                  joinMutation.mutate(inviteCode.trim());
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => inviteCode.trim() && joinMutation.mutate(inviteCode.trim())}
              disabled={joinMutation.isPending || !inviteCode.trim()}
            >
              Join
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnterpriseSelector;
