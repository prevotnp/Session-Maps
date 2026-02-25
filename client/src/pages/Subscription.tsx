import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChevronLeft,
  Check,
  Mountain,
  Cloud,
  Download,
  Share2,
  CreditCard
} from 'lucide-react';

const Subscription: React.FC = () => {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Redirect if not logged in
  React.useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSubscribe = async (planType: 'monthly' | 'yearly') => {
    if (!user) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest('POST', '/api/subscription/purchase', { planType });
      
      toast({
        title: "Subscription Successful",
        description: `You're now subscribed to Session Maps Premium!`,
        variant: "default",
      });
      
      // Refresh the page to update user state
      window.location.href = '/profile';
    } catch (error) {
      toast({
        title: "Subscription Failed",
        description: error instanceof Error ? error.message : "Failed to process subscription",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-background">
      {/* iOS Status Bar - Just for design purposes */}
      <div className="ios-status-bar bg-black flex items-center justify-between px-4 pt-2">
        <div className="text-sm">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="flex items-center space-x-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        </div>
      </div>

      {/* Subscription Header */}
      <div className="relative">
        <div className="flex justify-between items-center p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-semibold">Premium Subscription</h1>
          <div className="w-10"></div> {/* For balance */}
        </div>
      </div>

      {/* Subscription Content */}
      <div className="px-4 py-2 space-y-6">
        {/* Hero section */}
        <div className="text-center py-6">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 bg-primary/20 rounded-full flex items-center justify-center">
              <Mountain className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Unlock Full Access</h2>
          <p className="text-muted-foreground">
            Experience the most detailed mapping application with premium features
          </p>
        </div>

        {/* Features list */}
        <div className="space-y-3">
          <div className="flex items-start">
            <div className="bg-primary/20 p-2 rounded-full mr-3">
              <Cloud className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">High-Resolution Drone Imagery</h3>
              <p className="text-sm text-muted-foreground">
                Access to all drone imagery overlays with up to 1cm/pixel resolution
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-primary/20 p-2 rounded-full mr-3">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Offline Map Downloads</h3>
              <p className="text-sm text-muted-foreground">
                Download unlimited map areas for offline use with all layers included
              </p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-primary/20 p-2 rounded-full mr-3">
              <Share2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">Real-time Location Sharing</h3>
              <p className="text-sm text-muted-foreground">
                Share your location with other users in real-time for coordinated exploration
              </p>
            </div>
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Choose Your Plan</h3>
          
          {/* Monthly Plan */}
          <Card className="relative border-primary">
            <div className="absolute top-0 right-0 bg-primary text-white text-xs px-2 py-0.5 rounded-bl-md rounded-tr-md">
              MOST POPULAR
            </div>
            <CardHeader className="pb-2">
              <CardTitle>Monthly Premium</CardTitle>
              <CardDescription>Unlimited access with monthly billing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <span className="text-3xl font-bold">$12</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-sm">All premium features</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-sm">Cancel anytime</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-sm">Regular updates</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full"
                onClick={() => handleSubscribe('monthly')}
                disabled={isLoading || (user.isSubscribed ?? false)}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : user.isSubscribed ? (
                  "Current Plan"
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Subscribe Now
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
          
          {/* Yearly Plan */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Yearly Premium</CardTitle>
              <CardDescription>Save 20% with annual subscription</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <span className="text-3xl font-bold">$115</span>
                <span className="text-muted-foreground">/year</span>
                <span className="ml-2 bg-green-500/20 text-green-600 text-xs px-2 py-0.5 rounded-full">
                  SAVE 20%
                </span>
              </div>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-sm">All premium features</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-sm">Priority support</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-2" />
                  <span className="text-sm">Early access to new features</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full"
                variant="outline"
                onClick={() => handleSubscribe('yearly')}
                disabled={isLoading || (user.isSubscribed ?? false)}
              >
                {isLoading ? "Processing..." : "Subscribe Yearly"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Additional Information */}
        <div className="text-center text-sm text-muted-foreground">
          <p>By subscribing, you agree to our Terms of Service and Privacy Policy.</p>
          <p className="mt-1">You can cancel your subscription anytime from your profile.</p>
        </div>
      </div>

      {/* iOS Home Indicator */}
      <div className="ios-home-indicator fixed bottom-0 left-0 right-0 flex justify-center items-center h-8 bg-background">
        <div className="w-32 h-1 bg-white/30 rounded-full"></div>
      </div>
    </div>
  );
};

export default Subscription;
