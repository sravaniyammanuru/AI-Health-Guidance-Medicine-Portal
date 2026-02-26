'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

const patientNavItems = [
  { href: '/patient-dashboard', label: 'Health Chat' },
  { href: '/medicine-info', label: 'Medicine Info' },
  { href: '/order', label: 'Order Medicine' },
  { href: '/consultations', label: 'Consultations' },
  { href: '/prescriptions', label: 'Prescriptions' },
];

const doctorNavItems = [
  { href: '/doctor-dashboard', label: 'Dashboard' },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { user, userType, logout, isAuthenticated } = useAuth();

  const navItems = userType === 'doctor' ? doctorNavItems : patientNavItems;

  const handleLogout = () => {
    logout();
    setShowLogoutDialog(false);
    router.push('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 shadow-sm w-full">
        <div className="w-full px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo & Brand */}
            <Link href={userType === 'doctor' ? '/doctor-dashboard' : '/patient-dashboard'} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <span className="text-base font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                HealthCare AI
              </span>
              {userType === 'doctor' && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 ml-2">
                  Doctor
                </Badge>
              )}
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    pathname === item.href
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <span>{item.label}</span>
                  {pathname === item.href && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-2">
              {/* User Menu */}
              <div className="hidden md:flex items-center space-x-2 pl-2 border-l border-border">
                <Avatar className="h-9 w-9 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {user ? getInitials(user.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-medium leading-none text-foreground truncate max-w-[200px]">
                    {user?.name}
                  </p>
                  {user?.specialization && (
                    <p className="text-xs text-muted-foreground leading-none mt-0.5">
                      {user.specialization}
                    </p>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogoutDialog(true)}
                className="h-9 text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                Logout
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="lg:hidden pb-2 pt-1 flex overflow-x-auto space-x-2 scrollbar-hide">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-accent text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout from your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogout}>Logout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
