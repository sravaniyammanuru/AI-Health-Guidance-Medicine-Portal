'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function DoctorRegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    licenseNumber: '',
    specialization: '',
    hospitalAffiliation: '',
    phone: '',
    yearsOfExperience: '',
  });
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
        return;
      }
      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a PDF or image file (JPG, PNG)');
        return;
      }
      setLicenseFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!licenseFile) {
      toast.error('Please upload your medical license certificate');
      return;
    }

    if (!formData.licenseNumber.trim()) {
      toast.error('Please enter your medical license number');
      return;
    }

    setIsLoading(true);

    try {
      // Store only file reference, not the actual file content
      const registrationData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        licenseNumber: formData.licenseNumber,
        specialization: formData.specialization,
        hospitalAffiliation: formData.hospitalAffiliation,
        phone: formData.phone,
        yearsOfExperience: parseInt(formData.yearsOfExperience) || 0,
        licenseCertificate: 'placeholder',  // File selected but not uploaded
        licenseFileName: licenseFile.name,
        status: 'pending', // Will be reviewed by admin
      };

      const result = await api.registerDoctor(registrationData);
      
      if (result.success) {
        toast.success('Registration submitted successfully! Please wait for admin approval.');
        setTimeout(() => {
          router.push('/login/doctor');
        }, 2000);
      } else {
        toast.error(result.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to submit registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link href="/login/doctor" className="inline-flex items-center space-x-2 mb-6 text-muted-foreground hover:text-foreground">
            <span>←</span>
            <span className="text-sm">Back to login</span>
          </Link>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <span className="text-4xl">🏥</span>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              HealthCare AI
            </h1>
          </div>
          <p className="text-muted-foreground">Doctor Registration</p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Register as a Doctor</CardTitle>
            <CardDescription>
              Submit your credentials and medical license for verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Dr. John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="doctor@hospital.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">Medical License Number *</Label>
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    placeholder="e.g., MCI-12345"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization *</Label>
                  <Input
                    id="specialization"
                    name="specialization"
                    placeholder="e.g., Cardiology"
                    value={formData.specialization}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yearsOfExperience">Years of Experience *</Label>
                  <Input
                    id="yearsOfExperience"
                    name="yearsOfExperience"
                    type="number"
                    min="0"
                    placeholder="5"
                    value={formData.yearsOfExperience}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hospitalAffiliation">Hospital/Clinic Affiliation</Label>
                <Input
                  id="hospitalAffiliation"
                  name="hospitalAffiliation"
                  placeholder="e.g., City Hospital"
                  value={formData.hospitalAffiliation}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="licenseFile">Upload Medical License Certificate *</Label>
                <Input
                  id="licenseFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  required
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Accepted formats: PDF, JPG, PNG (Max 5MB)
                </p>
                {licenseFile && (
                  <p className="text-xs text-green-600">
                    ✓ {licenseFile.name} selected
                  </p>
                )}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Your registration will be reviewed by our admin team. 
                  You will receive an email once your account is verified and approved.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Submitting...' : 'Submit Registration'}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login/doctor" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
