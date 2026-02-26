'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type UserType = 'patient' | 'doctor' | null;

interface User {
  id: string;
  name: string;
  email: string;
  type: UserType;
  specialization?: string; // for doctors
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  userType: UserType;
  login: (email: string, password: string, type: UserType) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users
const DEMO_PATIENTS = [
  { id: '1', name: 'John Doe', email: 'patient@demo.com', password: 'patient123', phone: '+91 98765 43210' },
  { id: '2', name: 'Sarah Smith', email: 'sarah@demo.com', password: 'demo123', phone: '+91 98765 43211' },
];

const DEMO_DOCTORS = [
  { id: '1', name: 'Dr. Ramesh Kumar', email: 'doctor@demo.com', password: 'doctor123', specialization: 'General Physician' },
  { id: '2', name: 'Dr. Priya Sharma', email: 'drpriya@demo.com', password: 'demo123', specialization: 'Dermatologist' },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved session
    const savedUser = localStorage.getItem('user');
    const savedType = localStorage.getItem('userType');
    if (savedUser && savedType) {
      setUser(JSON.parse(savedUser));
      setUserType(savedType as UserType);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, type: UserType): Promise<boolean> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    if (type === 'patient') {
      const patient = DEMO_PATIENTS.find(p => p.email === email && p.password === password);
      if (patient) {
        const userData: User = {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          type: 'patient',
          phone: patient.phone,
        };
        setUser(userData);
        setUserType('patient');
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userType', 'patient');
        return true;
      }
    } else if (type === 'doctor') {
      const doctor = DEMO_DOCTORS.find(d => d.email === email && d.password === password);
      if (doctor) {
        const userData: User = {
          id: doctor.id,
          name: doctor.name,
          email: doctor.email,
          type: 'doctor',
          specialization: doctor.specialization,
        };
        setUser(userData);
        setUserType('doctor');
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('userType', 'doctor');
        return true;
      }
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setUserType(null);
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userType,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
