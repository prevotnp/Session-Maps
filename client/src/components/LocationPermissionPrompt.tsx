import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MapPin } from 'lucide-react';

interface LocationPermissionPromptProps {
  isOpen: boolean;
  onRequestPermission: () => void;
  onCancel: () => void;
}

const LocationPermissionPrompt: React.FC<LocationPermissionPromptProps> = ({
  isOpen,
  onRequestPermission,
  onCancel,
}) => {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="flex items-center space-y-3">
          <div className="mx-auto rounded-full bg-primary/10 p-3">
            <MapPin className="h-10 w-10 text-primary" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Enable Location Services
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Session Maps needs your location to show your position on the map and enable real-time tracking.
            Your location data never leaves your device unless you explicitly share it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel onClick={onCancel} className="sm:w-32">
            Not Now
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onRequestPermission} 
            className="bg-primary hover:bg-primary/90 sm:w-32"
          >
            Enable
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LocationPermissionPrompt;