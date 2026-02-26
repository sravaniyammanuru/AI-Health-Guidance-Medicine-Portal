'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
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
  orderId?: string;
}

export default function DoctorDashboardPage() {
  const { user, userType, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Form state
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState('');
  const [dosageInstructions, setDosageInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Wait for auth to load before checking
    if (authLoading) return;
    
    if (!user || userType !== 'doctor') {
      router.push('/login/doctor');
    } else {
      loadConsultations();
      loadNotifications();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(() => {
        loadNotifications();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user, userType, authLoading, router]);

  const loadConsultations = async () => {
    setIsLoading(true);
    try {
      const response = await api.getPendingConsultations();
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
      // Reload consultations to show the new one
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

  const handleStartConsultation = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
    setDiagnosis('');
    setMedicines('');
    setDosageInstructions('');
    setNotes('');
    setIsDialogOpen(true);
  };

  const handleSubmitConsultation = async () => {
    if (!selectedConsultation) return;
    
    if (!diagnosis.trim()) {
      toast.error('Please provide a diagnosis');
      return;
    }

    setIsSubmitting(true);
    try {
      const medicineArray = medicines
        .split('\n')
        .map(m => m.trim())
        .filter(m => m.length > 0);

      await api.updateConsultation(selectedConsultation.id, {
        status: 'completed',
        diagnosis: diagnosis.trim(),
        medicines: medicineArray,
        dosageInstructions: dosageInstructions.trim(),
        notes: notes.trim(),
      });

      toast.success('Consultation completed successfully');
      setIsDialogOpen(false);
      setSelectedConsultation(null);
      loadConsultations(); // Reload the list
    } catch (error) {
      console.error('Failed to update consultation:', error);
      toast.error('Failed to complete consultation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || userType !== 'doctor') {
    return null;
  }

  const pendingConsultations = consultations.filter(c => c.status === 'pending');
  const todayConsultations = consultations.filter(c => {
    const consultDate = new Date(c.createdAt);
    const today = new Date();
    return consultDate.toDateString() === today.toDateString();
  });

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              Welcome back, {user.name || 'Doctor'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user.specialization || 'General Practitioner'}
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Consultations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {pendingConsultations.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Require immediate attention
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today&apos;s Consultations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {todayConsultations.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Scheduled for today
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Consultations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {consultations.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                All time
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                Active
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ready to consult
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Consultations */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending Consultations</CardTitle>
              <Badge variant="destructive">{pendingConsultations.length} Pending</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading consultations...
              </div>
            ) : pendingConsultations.length > 0 ? (
              <div className="space-y-4">
                {pendingConsultations.map((consultation) => (
                  <div
                    key={consultation.id}
                    className="border border-border rounded-lg p-4 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">
                          Consultation #{consultation.id} - Order #{consultation.orderId}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(consultation.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="secondary">{consultation.status}</Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Symptoms</p>
                        <p className="text-sm text-foreground">{consultation.symptoms}</p>
                      </div>
                      <div className="flex space-x-2 mt-3">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleStartConsultation(consultation)}
                        >
                          Start Consultation
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                No pending consultations
              </p>
            )}
          </CardContent>
        </Card>

        {/* Consultation Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Complete Consultation</DialogTitle>
              <DialogDescription>
                Consultation #{selectedConsultation?.id} - Order #{selectedConsultation?.orderId}
              </DialogDescription>
            </DialogHeader>
            
            {selectedConsultation && (
              <div className="space-y-4 py-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Patient Symptoms</p>
                  <p className="text-sm">{selectedConsultation.symptoms}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Diagnosis <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    placeholder="Enter diagnosis..."
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Prescribed Medicines
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Enter one medicine per line
                  </p>
                  <Textarea
                    placeholder="e.g., Paracetamol 500mg&#10;Amoxicillin 250mg&#10;Cetirizine 10mg"
                    value={medicines}
                    onChange={(e) => setMedicines(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Dosage Instructions
                  </label>
                  <Textarea
                    placeholder="Enter dosage instructions..."
                    value={dosageInstructions}
                    onChange={(e) => setDosageInstructions(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Additional Notes
                  </label>
                  <Textarea
                    placeholder="Any additional notes or recommendations..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitConsultation}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Complete Consultation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}