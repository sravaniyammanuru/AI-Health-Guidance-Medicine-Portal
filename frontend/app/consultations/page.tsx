'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface Consultation {
  id: number;
  orderId: string;
  userId: string;
  status: 'pending' | 'completed';
  symptoms: string;
  createdAt: string;
  diagnosis?: string;
  medicines?: string[];
  dosageInstructions?: string;
  notes?: string;
  updatedAt?: string;
}

interface Notification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  consultationId?: number;
}

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  
  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (!authLoading && user) {
      loadConsultations();
      loadNotifications();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(() => {
        loadNotifications();
        loadConsultations(); // Also refresh consultations to see updates
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user, authLoading, router]);

  const loadConsultations = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await api.getUserConsultations(user.id);
      setConsultations(response.consultations || []);
    } catch (error) {
      console.error('Failed to load consultations:', error);
      toast.error('Failed to load consultations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotifications = async () => {
    if (!user) return;
    
    try {
      const response = await api.getNotifications(user.id || user.email, false, 20);
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    try {
      await api.markNotificationRead(notification._id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
    
    // Navigate if needed
    if (notification.consultationId) {
      await loadConsultations();
      setShowNotifications(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    
    try {
      await api.markAllNotificationsRead(user.id || user.email);
      await loadNotifications();
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

  if (!user) {
    return null;
  }

  const completedConsultations = consultations.filter(c => c.status === 'completed');
  const pendingConsultations = consultations.filter(c => c.status === 'pending');

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              Doctor Consultations
            </h1>
            <p className="text-sm text-muted-foreground">
              View your consultation history and pending appointments
            </p>
          </div>
          
          {/* Notification Bell */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
            
            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-12 w-96 bg-white border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification._id}
                        className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                          !notification.read ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-sm">{notification.title}</p>
                          {!notification.read && (
                            <span className="h-2 w-2 bg-blue-500 rounded-full shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all">
              All ({consultations.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedConsultations.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({pendingConsultations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            <div className="space-y-4">
              {consultations.map((consultation) => (
                <ConsultationCard key={consultation.id} consultation={consultation} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <div className="space-y-4">
              {completedConsultations.map((consultation) => (
                <ConsultationCard key={consultation.id} consultation={consultation} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pending" className="mt-4">
            <div className="space-y-4">
              {pendingConsultations.length > 0 ? (
                pendingConsultations.map((consultation) => (
                  <ConsultationCard
                    key={consultation.id}
                    consultation={consultation}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-gray-500">No pending consultations</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ConsultationCard({
  consultation,
}: {
  consultation: Consultation;
}) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow border-border">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center space-x-2">
              <span className="text-foreground">Consultation #{consultation.id}</span>
              <Badge
                variant={
                  consultation.status === 'completed' ? 'default' : 'secondary'
                }
              >
                {consultation.status}
              </Badge>
            </CardTitle>
            {consultation.symptoms && (
              <p className="text-sm text-muted-foreground mt-1">
                Symptoms: {consultation.symptoms}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Order ID</p>
            <p className="text-sm font-medium text-foreground">{consultation.orderId}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Date & Time</p>
            <p className="text-sm font-medium text-foreground">
              {new Date(consultation.createdAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(consultation.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <Badge variant={consultation.status === 'completed' ? 'default' : 'secondary'}>
              {consultation.status}
            </Badge>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Symptoms Reported</p>
          <p className="text-sm">{consultation.symptoms}</p>
        </div>

        {consultation.diagnosis && consultation.diagnosis !== 'Pending consultation' && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs font-semibold text-blue-900 mb-1">
              Diagnosis
            </p>
            <p className="text-sm text-blue-800">{consultation.diagnosis}</p>
          </div>
        )}

        {consultation.medicines && consultation.medicines.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Prescribed Medicines</p>
            <div className="space-y-1">
              {consultation.medicines.map((medicine, idx) => (
                <div
                  key={idx}
                  className="text-sm bg-gray-50 px-3 py-1.5 rounded flex items-center"
                >
                  <span className="mr-2">💊</span>
                  {medicine}
                </div>
              ))}
            </div>
          </div>
        )}

        {consultation.dosageInstructions && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Dosage Instructions</p>
            <p className="text-sm text-gray-700">
              {consultation.dosageInstructions}
            </p>
          </div>
        )}

        {consultation.notes && (
          <div className="border-t pt-3">
            <p className="text-xs text-gray-500 mb-1">Doctor&apos;s Notes</p>
            <p className="text-sm text-gray-700 italic">{consultation.notes}</p>
          </div>
        )}

        {consultation.status === 'pending' && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
            <p className="text-xs text-yellow-800">
              ⏳ A doctor will contact you shortly to discuss your health condition.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
