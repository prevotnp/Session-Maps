import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import MapView from '@/components/MapView';
import BottomNavigation from '@/components/BottomNavigation';
import { MessagesModal } from '@/components/modals/MessagesModal';
import DroneImageryModal from '@/components/modals/DroneImageryModal';
import LayerManagerModal from '@/components/modals/LayerManagerModal';
import RoutesModal from '@/components/modals/RoutesModal';
import { FriendsModal } from '@/components/modals/FriendsModal';
import { FriendProfileModal } from '@/components/modals/FriendProfileModal';
import { useLocation } from 'wouter';
import { Route, DroneImage } from '@shared/schema';

const Home: React.FC = () => {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  
  // Modal states
  const [isMessagesModalOpen, setIsMessagesModalOpen] = useState(false);
  const [isDroneModalOpen, setIsDroneModalOpen] = useState(false);
  const [isLayerModalOpen, setIsLayerModalOpen] = useState(false);
  const [isRoutesModalOpen, setIsRoutesModalOpen] = useState(false);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [isFriendProfileModalOpen, setIsFriendProfileModalOpen] = useState(false);
  const [selectedFriendUsername, setSelectedFriendUsername] = useState<string>('');
  
  // Selected route for display
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  
  // Route being edited
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  
  // All routes to display at once
  const [routesToDisplayAll, setRoutesToDisplayAll] = useState<Route[] | null>(null);
  
  // Activated drone image (for flying to the correct location)
  const [activatedDroneImage, setActivatedDroneImage] = useState<DroneImage | null>(null);
  
  // Handle tab changes from bottom navigation
  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'map':
        // Already on map view
        break;
      case 'layers':
        setIsLayerModalOpen(true);
        break;
      case 'messages':
        setIsMessagesModalOpen(true);
        break;
      case 'routes':
        setIsRoutesModalOpen(true);
        break;
      case 'friends':
        setIsFriendsModalOpen(true);
        break;
      case 'uploadDrone':
        setIsDroneModalOpen(true);
        break;
      case 'profile':
        setLocation('/profile');
        break;
    }
  };

  const handleViewProfile = (username: string) => {
    setSelectedFriendUsername(username);
    setIsFriendProfileModalOpen(true);
  };
  
  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col bg-black" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Main map view */}
      <MapView 
        onOpenOfflineModal={() => {}}
        onOpenDroneModal={() => setIsDroneModalOpen(true)}
        selectedRoute={selectedRoute}
        onRouteDisplayed={() => setSelectedRoute(null)}
        editingRoute={editingRoute}
        onRouteEdited={() => setEditingRoute(null)}
        onSetEditingRoute={setEditingRoute}
        routesToDisplayAll={routesToDisplayAll}
        onAllRoutesDisplayed={() => setRoutesToDisplayAll(null)}
        activatedDroneImage={activatedDroneImage}
        onDroneImageActivated={() => setActivatedDroneImage(null)}
      />
      
      {/* Bottom navigation */}
      <BottomNavigation onTabChange={handleTabChange} />
      
      {/* Modals */}
      <MessagesModal 
        isOpen={isMessagesModalOpen} 
        onClose={() => setIsMessagesModalOpen(false)}
        onViewProfile={handleViewProfile}
      />
      
      <DroneImageryModal 
        isOpen={isDroneModalOpen} 
        onClose={() => setIsDroneModalOpen(false)}
        onActivateImage={(image) => {
          setActivatedDroneImage(image);
        }}
      />
      
      <LayerManagerModal 
        isOpen={isLayerModalOpen} 
        onClose={() => setIsLayerModalOpen(false)} 
      />
      
      <RoutesModal 
        isOpen={isRoutesModalOpen} 
        onClose={() => setIsRoutesModalOpen(false)}
        onSelectRoute={setSelectedRoute}
        onDisplayAllRoutes={(routes) => setRoutesToDisplayAll(routes)}
      />

      <FriendsModal 
        isOpen={isFriendsModalOpen} 
        onClose={() => setIsFriendsModalOpen(false)}
        onViewProfile={handleViewProfile}
      />

      <FriendProfileModal 
        isOpen={isFriendProfileModalOpen} 
        onClose={() => setIsFriendProfileModalOpen(false)}
        username={selectedFriendUsername}
        onViewRoute={setSelectedRoute}
      />
      
    </div>
  );
};

export default Home;
