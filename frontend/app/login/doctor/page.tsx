'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function DoctorLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Try backend API first
      const result = await api.login(email, password, 'doctor');
      
      if (result.success && result.user) {
        // Use backend user data directly
        const userData = {
          id: result.user.id || result.user.email,
          name: result.user.name,
          email: result.user.email,
          type: 'doctor' as const,
          specialization: result.user.specialization,
        };
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userType', 'doctor');
        toast.success('Welcome back, Doctor!');
        // Use window.location.href for proper page transition with auth context refresh
        window.location.href = '/doctor-dashboard';
      } else {
        toast.error(result.message || 'Invalid email or password');
      }
    } catch (error) {
      // Fallback to demo mode if backend is not running
      const success = await login(email, password, 'doctor');
      if (success) {
        toast.success('Welcome back, Doctor! (Demo mode)');
        router.push('/doctor-dashboard');
      } else {
        toast.error('Invalid email or password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/login" className="inline-flex items-center space-x-2 mb-6 text-muted-foreground hover:text-foreground">
            <span>←</span>
            <span className="text-sm">Back to login options</span>
          </Link>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <span className="text-4xl">🏥</span>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              HealthCare AI
            </h1>
          </div>
          <p className="text-muted-foreground">Doctor Portal</p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Doctor Login</CardTitle>
            <CardDescription>
              Sign in to manage patient consultations and prescriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="doctor@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Demo Credentials:</p>
              <div className="space-y-1 text-xs">
                <p className="font-mono">Email: doctor@demo.com</p>
                <p className="font-mono">Password: doctor123</p>
              </div>
            </div>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Not registered yet?{' '}
              <Link href="/login/doctor/register" className="text-primary hover:underline">
                Register as Doctor
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
