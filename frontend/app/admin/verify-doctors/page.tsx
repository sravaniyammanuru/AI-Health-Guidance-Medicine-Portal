'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface DoctorRegistration {
  id: number;
  name: string;
  email: string;
  licenseNumber: string;
  specialization: string;
  hospitalAffiliation?: string;
  phone: string;
  yearsOfExperience: number;
  licenseCertificate: string;
  licenseFileName: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export default function VerifyDoctorsPage() {
  const [registrations, setRegistrations] = useState<DoctorRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRegistration | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Simple admin authentication (demo purposes)
  const ADMIN_PASSWORD = 'admin123';

  useEffect(() => {
    if (isAuthenticated) {
      loadRegistrations();
    }
  }, [isAuthenticated]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      toast.success('Admin authenticated');
    } else {
      toast.error('Invalid admin password');
    }
  };

  const loadRegistrations = async () => {
    setIsLoading(true);
    try {
      const result = await api.getDoctorRegistrations();
      setRegistrations(result.registrations || []);
    } catch (error) {
      console.error('Failed to load registrations:', error);
      toast.error('Failed to load doctor registrations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (doctor: DoctorRegistration) => {
    setSelectedDoctor(doctor);
    setReviewNotes(doctor.reviewNotes || '');
    setIsDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedDoctor) return;
    
    setIsProcessing(true);
    try {
      await api.reviewDoctorRegistration(selectedDoctor.id, {
        status: 'approved',
        reviewNotes: reviewNotes.trim(),
      });
      
      toast.success('Doctor registration approved successfully');
      setIsDialogOpen(false);
      setSelectedDoctor(null);
      setReviewNotes('');
      loadRegistrations();
    } catch (error) {
      console.error('Failed to approve registration:', error);
      toast.error('Failed to approve registration');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDoctor) return;
    
    if (!reviewNotes.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    setIsProcessing(true);
    try {
      await api.reviewDoctorRegistration(selectedDoctor.id, {
        status: 'rejected',
        reviewNotes: reviewNotes.trim(),
      });
      
      toast.success('Doctor registration rejected');
      setIsDialogOpen(false);
      setSelectedDoctor(null);
      setReviewNotes('');
      loadRegistrations();
    } catch (error) {
      console.error('Failed to reject registration:', error);
      toast.error('Failed to reject registration');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Authentication</CardTitle>
            <CardDescription>Enter admin password to access doctor verification</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminPassword">Admin Password</Label>
                <input
                  id="adminPassword"
                  type="password"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter admin password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Authenticate
              </Button>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Demo Admin Password: admin123</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingRegistrations = registrations.filter(r => r.status === 'pending');
  const approvedRegistrations = registrations.filter(r => r.status === 'approved');
  const rejectedRegistrations = registrations.filter(r => r.status === 'rejected');

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Admin - Doctor Verification</h1>
            <Link href="/login">
              <Button variant="outline" size="sm">Logout</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingRegistrations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{approvedRegistrations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{rejectedRegistrations.length}</div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading registrations...</p>
          </div>
        ) : registrations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No doctor registrations found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {pendingRegistrations.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Pending Registrations</h2>
                <div className="grid gap-4">
                  {pendingRegistrations.map((doctor) => (
                    <Card key={doctor.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{doctor.name}</h3>
                              <Badge variant="outline">Pending</Badge>
                            </div>
                            <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                              <p><span className="text-muted-foreground">Email:</span> {doctor.email}</p>
                              <p><span className="text-muted-foreground">License:</span> {doctor.licenseNumber}</p>
                              <p><span className="text-muted-foreground">Specialization:</span> {doctor.specialization}</p>
                              <p><span className="text-muted-foreground">Experience:</span> {doctor.yearsOfExperience} years</p>
                              <p><span className="text-muted-foreground">Phone:</span> {doctor.phone}</p>
                              {doctor.hospitalAffiliation && (
                                <p><span className="text-muted-foreground">Hospital:</span> {doctor.hospitalAffiliation}</p>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Submitted: {new Date(doctor.submittedAt).toLocaleString()}
                            </p>
                          </div>
                          <Button onClick={() => handleViewDetails(doctor)} size="sm">
                            Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {approvedRegistrations.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Approved Doctors</h2>
                <div className="grid gap-4">
                  {approvedRegistrations.map((doctor) => (
                    <Card key={doctor.id} className="border-green-200 dark:border-green-800">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{doctor.name}</h3>
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Approved</Badge>
                            </div>
                            <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                              <p><span className="text-muted-foreground">Email:</span> {doctor.email}</p>
                              <p><span className="text-muted-foreground">License:</span> {doctor.licenseNumber}</p>
                              <p><span className="text-muted-foreground">Specialization:</span> {doctor.specialization}</p>
                            </div>
                            {doctor.reviewNotes && (
                              <p className="text-xs text-muted-foreground italic">Note: {doctor.reviewNotes}</p>
                            )}
                          </div>
                          <Button onClick={() => handleViewDetails(doctor)} variant="outline" size="sm">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {rejectedRegistrations.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Rejected Registrations</h2>
                <div className="grid gap-4">
                  {rejectedRegistrations.map((doctor) => (
                    <Card key={doctor.id} className="border-red-200 dark:border-red-800">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{doctor.name}</h3>
                              <Badge variant="destructive">Rejected</Badge>
                            </div>
                            <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                              <p><span className="text-muted-foreground">Email:</span> {doctor.email}</p>
                              <p><span className="text-muted-foreground">License:</span> {doctor.licenseNumber}</p>
                            </div>
                            {doctor.reviewNotes && (
                              <p className="text-sm text-red-600 dark:text-red-400">Reason: {doctor.reviewNotes}</p>
                            )}
                          </div>
                          <Button onClick={() => handleViewDetails(doctor)} variant="outline" size="sm">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Doctor Registration</DialogTitle>
            <DialogDescription>
              Verify the doctor&apos;s credentials and license certificate
            </DialogDescription>
          </DialogHeader>

          {selectedDoctor && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Full Name</Label>
                  <p className="font-medium">{selectedDoctor.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedDoctor.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">License Number</Label>
                  <p className="font-medium">{selectedDoctor.licenseNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Specialization</Label>
                  <p className="font-medium">{selectedDoctor.specialization}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedDoctor.phone}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Experience</Label>
                  <p className="font-medium">{selectedDoctor.yearsOfExperience} years</p>
                </div>
                {selectedDoctor.hospitalAffiliation && (
                  <div className="md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Hospital/Clinic</Label>
                    <p className="font-medium">{selectedDoctor.hospitalAffiliation}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>License Certificate</Label>
                <div className="border rounded-lg p-4 bg-muted">
                  <p className="text-sm mb-2">{selectedDoctor.licenseFileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Note: File was selected during registration but not uploaded to server
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reviewNotes">
                  Review Notes {selectedDoctor.status === 'pending' ? '(Optional for approval, required for rejection)' : ''}
                </Label>
                <Textarea
                  id="reviewNotes"
                  placeholder="Add notes about this verification..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  disabled={selectedDoctor.status !== 'pending'}
                />
              </div>

              {selectedDoctor.status !== 'pending' && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm">
                    <span className="font-semibold">Status:</span>{' '}
                    <Badge variant={selectedDoctor.status === 'approved' ? 'default' : 'destructive'}>
                      {selectedDoctor.status}
                    </Badge>
                  </p>
                  {selectedDoctor.reviewedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reviewed on: {new Date(selectedDoctor.reviewedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedDoctor?.status === 'pending' ? (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Rejecting...' : 'Reject'}
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Approving...' : 'Approve'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
