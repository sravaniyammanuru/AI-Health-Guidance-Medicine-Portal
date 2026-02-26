'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { user, userType } = useAuth();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else if (userType === 'patient') {
      router.push('/patient-dashboard');
    } else if (userType === 'doctor') {
      router.push('/doctor-dashboard');
    }
  }, [user, userType, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
