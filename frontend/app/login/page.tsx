'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <span className="text-5xl">🏥</span>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              HealthCare AI
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Your Personal Health Assistant
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Choose your portal to continue
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Patient Login */}
          <Card className="border-border hover:border-primary transition-colors cursor-pointer group">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  🧑‍🦱
                </div>
              </div>
              <CardTitle className="text-center">Patient Portal</CardTitle>
              <CardDescription className="text-center">
                Access your health records and consultations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login/patient">
                <Button className="w-full" variant="default">
                  Login as Patient
                </Button>
              </Link>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  AI Health Consultation
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Order Medicines
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Manage Prescriptions
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Track Medication Reminders
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Doctor Login */}
          <Card className="border-border hover:border-primary transition-colors cursor-pointer group">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                  👨‍⚕️
                </div>
              </div>
              <CardTitle className="text-center">Doctor Portal</CardTitle>
              <CardDescription className="text-center">
                Manage patient consultations and prescriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/login/doctor">
                <Button className="w-full" variant="default">
                  Login as Doctor
                </Button>
              </Link>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  View Pending Consultations
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Manage Patient Records
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Prescribe Medicines
                </p>
                <p className="flex items-center">
                  <span className="mr-2">✓</span>
                  Call Logs & Notes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Need help?{' '}
            <Link href="/support" className="text-primary hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
