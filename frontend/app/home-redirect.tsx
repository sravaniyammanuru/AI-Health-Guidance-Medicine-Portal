'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { user, userType, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (userType === 'doctor') {
      router.push('/doctor-dashboard');
    } else if (userType === 'patient') {
      router.push('/patient-dashboard');
    }
  }, [isAuthenticated, userType, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">🏥</div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
