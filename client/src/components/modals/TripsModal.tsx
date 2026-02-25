import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, Plus, Edit, Trash2, Clock, Users } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Trip, CalendarEvent } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import TripForm from '../forms/TripForm';
import CalendarEventForm from '../forms/CalendarEventForm';

interface TripsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TripsModal: React.FC<TripsModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [showTripForm, setShowTripForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  // Fetch user's trips
  const { data: trips = [], isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ['/api/trips'],
    enabled: isOpen
  });

  // Fetch user's calendar events
  const { data: events = [], isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/calendar-events'],
    enabled: isOpen
  });

  // Delete trip mutation
  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      await apiRequest('DELETE', `/api/trips/${tripId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      toast({ title: "Trip deleted", description: "Trip and all events deleted successfully." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting trip",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await apiRequest('DELETE', `/api/calendar-events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      toast({ title: "Event deleted", description: "Calendar event deleted successfully." });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getEventsByTrip = (tripId: number) => {
    return events.filter(event => event.tripId === tripId);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'accommodation': return 'bg-blue-100 text-blue-800';
      case 'transport': return 'bg-green-100 text-green-800';
      case 'meal': return 'bg-orange-100 text-orange-800';
      case 'meeting': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEditTrip = (trip: Trip) => {
    setEditingTrip(trip);
    setShowTripForm(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };

  const handleAddEvent = (tripId: number) => {
    setSelectedTripId(tripId);
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const handleFormClose = () => {
    setShowTripForm(false);
    setShowEventForm(false);
    setEditingTrip(null);
    setEditingEvent(null);
    setSelectedTripId(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Trips & Calendar
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="trips" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="trips">My Trips</TabsTrigger>
              <TabsTrigger value="events">All Events</TabsTrigger>
            </TabsList>

            <TabsContent value="trips" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Your Trips</h3>
                <Button onClick={() => setShowTripForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Trip
                </Button>
              </div>

              {tripsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading trips...</div>
              ) : trips.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No trips created yet</p>
                  <Button onClick={() => setShowTripForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Trip
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {trips.map((trip) => {
                    const tripEvents = getEventsByTrip(trip.id);
                    return (
                      <Card key={trip.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                {trip.name}
                                {trip.isPublic && <Badge variant="secondary">Public</Badge>}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-4 mt-2">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                                </span>
                                {trip.destination && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {trip.destination}
                                  </span>
                                )}
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditTrip(trip)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteTripMutation.mutate(trip.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {trip.description && (
                            <p className="text-sm text-muted-foreground mb-4">{trip.description}</p>
                          )}
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              {tripEvents.length} events scheduled
                            </span>
                            <Button
                              size="sm"
                              onClick={() => handleAddEvent(trip.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Event
                            </Button>
                          </div>

                          {tripEvents.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <h4 className="font-medium text-sm">Recent Events:</h4>
                              {tripEvents.slice(0, 3).map((event) => (
                                <div key={event.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={getEventTypeColor(event.eventType)}>
                                      {event.eventType}
                                    </Badge>
                                    <span>{event.title}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">
                                      {formatDateTime(event.startTime)}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditEvent(event)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">All Calendar Events</h3>
                <div className="text-sm text-muted-foreground">
                  {events.length} events total
                </div>
              </div>

              {eventsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading events...</div>
              ) : events.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No events scheduled yet</p>
                  <p className="text-sm text-muted-foreground">Create a trip first, then add events to it</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => {
                    const trip = trips.find(t => t.id === event.tripId);
                    return (
                      <Card key={event.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getEventTypeColor(event.eventType)}>
                                  {event.eventType}
                                </Badge>
                                <h4 className="font-semibold">{event.title}</h4>
                                {event.priority === 3 && <Badge variant="destructive">High Priority</Badge>}
                              </div>
                              
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {formatDateTime(event.startTime)} - {formatDateTime(event.endTime)}
                                </div>
                                {event.location && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {event.location}
                                  </div>
                                )}
                                {trip && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {trip.name}
                                  </div>
                                )}
                              </div>
                              
                              {event.description && (
                                <p className="mt-2 text-sm">{event.description}</p>
                              )}
                            </div>
                            
                            <div className="flex gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditEvent(event)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteEventMutation.mutate(event.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Trip Form Modal */}
      {showTripForm && (
        <TripForm
          isOpen={showTripForm}
          onClose={handleFormClose}
          trip={editingTrip}
        />
      )}

      {/* Calendar Event Form Modal */}
      {showEventForm && (
        <CalendarEventForm
          isOpen={showEventForm}
          onClose={handleFormClose}
          event={editingEvent}
          tripId={selectedTripId}
          trips={trips}
        />
      )}
    </>
  );
};

export default TripsModal;