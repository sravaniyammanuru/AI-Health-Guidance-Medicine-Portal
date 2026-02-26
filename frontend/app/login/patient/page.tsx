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

export default function PatientLoginPage() {
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
      const result = await api.login(email, password, 'patient');
      
      if (result.success && result.user) {
        // Use backend user data directly
        const userData = {
          id: result.user.id || result.user.email,
          name: result.user.name,
          email: result.user.email,
          type: 'patient' as const,
          phone: result.user.phone,
        };
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userType', 'patient');
        toast.success('Welcome back!');
        // Use window.location.href for proper page transition with auth context refresh
        window.location.href = '/patient-dashboard';
      } else {
        toast.error(result.message || 'Invalid email or password');
      }
    } catch (error) {
      // Fallback to demo mode if backend is not running
      console.error('Backend login failed:', error);
      const success = await login(email, password, 'patient');
      if (success) {
        toast.success('Welcome back! (Demo mode)');
        router.push('/patient-dashboard');
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
            <h1 className="text-3xl font-bold bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              HealthCare AI
            </h1>
          </div>
          <p className="text-muted-foreground">Patient Portal</p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Patient Login</CardTitle>
            <CardDescription>
              Sign in to access your health records and consultations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="patient@example.com"
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
                <p className="font-mono">Email: patient@demo.com</p>
                <p className="font-mono">Password: patient123</p>
              </div>
            </div>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/login/patient/register" className="text-primary hover:underline">
                Register
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
