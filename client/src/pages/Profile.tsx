import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ChevronLeft, 
  User, 
  MapPin, 
  Download, 
  Cloud, 
  LogOut
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { DroneImage, OfflineMapArea } from '@shared/schema';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!user && !isLoggingOut) {
      navigate('/login');
    }
  }, [user, navigate, isLoggingOut]);

  // Get user's drone images
  const { data: droneImages, isLoading: isDroneLoading } = useQuery<DroneImage[]>({
    queryKey: ['/api/drone-images/user'],
    enabled: !!user
  });

  // Get user's offline map areas
  const { data: offlineMaps, isLoading: isOfflineLoading } = useQuery<OfflineMapArea[]>({
    queryKey: ['/api/offline-maps'],
    enabled: !!user
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiRequest("POST", "/api/logout");
      queryClient.setQueryData(["/api/auth/user"], null);
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Logged out", description: "You have been successfully logged out." });
      navigate('/login');
    } catch (error) {
      toast({ title: "Logout failed", description: "Failed to log out.", variant: "destructive" });
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return null; // Will redirect to login
  }

  const userInitials = user.fullName
    ? user.fullName.split(' ').map(name => name[0]).join('').toUpperCase()
    : user.username.substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Profile Header */}
      <div className="relative">
        <div className="flex justify-between items-center p-4">
          <Button variant="ghost" size="icon" className="min-w-[44px] min-h-[44px]" onClick={() => navigate('/')}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-semibold">Profile</h1>
          <div />
        </div>
        
        <div className="flex flex-col items-center p-6 pb-10">
          <Avatar className="h-24 w-24 mb-4">
            <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${user.username}`} alt={user.username} />
            <AvatarFallback className="text-2xl bg-primary text-white">{userInitials}</AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold">{user.fullName || user.username}</h2>
          <p className="text-muted-foreground mb-2">{user.email}</p>
          
        </div>
      </div>

      {/* Profile Content */}
      <div className="px-4 space-y-4 mb-24">

        {/* Drone Imagery Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Cloud className="h-5 w-5 mr-2 text-primary" />
              My Drone Imagery
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isDroneLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : droneImages && droneImages.length > 0 ? (
              <div className="space-y-3">
                {droneImages.slice(0, 2).map(image => (
                  <div key={image.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div 
                        className="w-10 h-10 rounded bg-gray-700 mr-3"
                        style={{
                          backgroundImage: `url('https://images.unsplash.com/photo-${image.id % 3 === 0 ? '1552083375-1447ce886485' : '1520962880247-cfaf541c8724'}?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100')`,
                          backgroundSize: 'cover'
                        }}
                      />
                      <div>
                        <div className="font-medium text-sm">{image.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(new Date(image.capturedAt || new Date()))}
                        </div>
                      </div>
                    </div>
                    {image.isActive && (
                      <span className="text-xs bg-secondary/20 text-secondary px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                ))}
                {droneImages.length > 2 && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/')}>
                    View All ({droneImages.length})
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Cloud className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No drone imagery added yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Offline Maps Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Download className="h-5 w-5 mr-2 text-primary" />
              Offline Map Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isOfflineLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : offlineMaps && offlineMaps.length > 0 ? (
              <div className="space-y-3">
                {offlineMaps.slice(0, 2).map(map => (
                  <div key={map.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded bg-gray-700 mr-3 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-white/60" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{map.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {map.sizeInMB} MB • Downloaded {formatDate(new Date(map.downloadedAt || new Date()))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {offlineMaps.length > 2 && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/')}>
                    View All ({offlineMaps.length})
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <Download className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No offline maps downloaded</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logout Button */}
        <Button 
          variant="outline" 
          className="w-full h-12 text-destructive border-destructive hover:bg-destructive/10 active:scale-95 transition-transform"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isLoggingOut ? 'Logging out...' : 'Log out'}
        </Button>
      </div>
    </div>
  );
};

export default Profile;
