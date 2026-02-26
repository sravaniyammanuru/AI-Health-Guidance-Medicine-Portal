'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { reminders } from '@/lib/dummy-data';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

interface Prescription {
  id: number;
  userId: string;
  doctor: string;
  medicines: string[];
  uploadDate: string;
  status: string;
}

interface ExtractedMedicine {
  prescribedName: string;
  dosage: string;
  frequency: string;
  duration: string;
  matchedMedicines: any[];
}

interface PrescriptionOCRResult {
  medicines: ExtractedMedicine[];
  doctorName: string;
  patientName: string;
  date: string;
  confidence: string;
  rawMedicines: any[];
}

export default function PrescriptionsPage() {
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [medicineReminders, setMedicineReminders] = useState(reminders);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<PrescriptionOCRResult | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (!authLoading && user) {
      loadPrescriptions();
    }
  }, [user, authLoading, router]);

  const loadPrescriptions = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await api.getUserPrescriptions(user.id);
      setPrescriptions(response.prescriptions || []);
    } catch (error) {
      console.error('Failed to load prescriptions:', error);
      toast.error('Failed to load prescriptions');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setUploadedFile(imageData);
        toast.success('Prescription uploaded! Analyzing...');
        
        // Analyze the prescription image
        setIsAnalyzing(true);
        setOcrResult(null);
        setExtractedText('');
        
        try {
          const response = await api.analyzePrescriptionImage(imageData);
          
          if (response.success && response.prescriptionData) {
            setOcrResult(response.prescriptionData);
            setExtractedText(response.extractedText || '');
            
            if (response.prescriptionData.medicines?.length > 0) {
              toast.success(`Found ${response.prescriptionData.medicines.length} medicine(s) in prescription!`);
            } else if (response.prescriptionData.rawMedicines?.length > 0) {
              toast.success(`Extracted ${response.prescriptionData.rawMedicines.length} medicine name(s)`);
            } else {
              toast.info('Could not identify medicines clearly. Please check the extracted text.');
            }
          } else {
            toast.error(response.error || 'Failed to analyze prescription');
          }
        } catch (error) {
          console.error('OCR Error:', error);
          toast.error('Failed to analyze prescription image');
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const savePrescription = async () => {
    if (!user || !ocrResult) return;
    
    const medicineNames = ocrResult.medicines?.map(m => 
      `${m.prescribedName}${m.dosage ? ` (${m.dosage})` : ''}${m.frequency ? ` - ${m.frequency}` : ''}`
    ) || ocrResult.rawMedicines?.map(m => m.name) || [];
    
    try {
      await api.createPrescription({
        userId: user.id,
        doctor: ocrResult.doctorName || 'Unknown Doctor',
        medicines: medicineNames,
      });
      toast.success('Prescription saved!');
      loadPrescriptions();
      setUploadedFile(null);
      setOcrResult(null);
    } catch (error) {
      toast.error('Failed to save prescription');
    }
  };

  const markAsTaken = (reminderId: number) => {
    setMedicineReminders((prev) =>
      prev.map((r) => (r.id === reminderId ? { ...r, taken: true } : r))
    );
    toast.success('Marked as taken!');
  };

  const markAsSkipped = (reminderId: number) => {
    setMedicineReminders((prev) =>
      prev.map((r) => (r.id === reminderId ? { ...r, skipped: true } : r))
    );
    toast.info('Marked as skipped');
  };

  const todayReminders = medicineReminders.filter(
    (r) => r.date.toDateString() === new Date().toDateString()
  );

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            Prescriptions & Reminders
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload prescriptions and manage medication reminders
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Upload & Prescriptions */}
          <div className="md:col-span-2 space-y-4">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload Prescription</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="prescription-upload"
                  />
                  <label htmlFor="prescription-upload" className="cursor-pointer">
                    <div className="text-gray-600 mb-2">
                      <span className="text-4xl">📄</span>
                    </div>
                    <p className="text-sm font-medium">
                      Upload prescription image or PDF
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Click to browse or drag and drop
                    </p>
                  </label>
                  {uploadedFile && (
                    <div className="mt-4">
                      <img
                        src={uploadedFile}
                        alt="Uploaded prescription"
                        className="max-h-40 mx-auto rounded-lg"
                      />
                      
                      {isAnalyzing ? (
                        <div className="mt-3 text-center">
                          <div className="animate-spin inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          <p className="text-sm text-blue-600 mt-2">
                            Analyzing prescription...
                          </p>
                        </div>
                      ) : ocrResult ? (
                        <div className="mt-4 text-left">
                          <p className="text-sm text-green-600 mb-3">
                            ✓ Prescription analyzed successfully
                          </p>
                          
                          {/* Doctor & Date Info */}
                          {(ocrResult.doctorName || ocrResult.date) && (
                            <div className="bg-gray-50 p-3 rounded-lg mb-3">
                              {ocrResult.doctorName && (
                                <p className="text-sm"><span className="font-medium">Doctor:</span> {ocrResult.doctorName}</p>
                              )}
                              {ocrResult.date && (
                                <p className="text-sm"><span className="font-medium">Date:</span> {ocrResult.date}</p>
                              )}
                              {ocrResult.patientName && (
                                <p className="text-sm"><span className="font-medium">Patient:</span> {ocrResult.patientName}</p>
                              )}
                            </div>
                          )}
                          
                          {/* Extracted Medicines */}
                          {ocrResult.medicines?.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Extracted Medicines:</p>
                              {ocrResult.medicines.map((med, idx) => (
                                <div key={idx} className="bg-blue-50 p-3 rounded-lg">
                                  <p className="font-medium text-blue-800">💊 {med.prescribedName}</p>
                                  <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                                    {med.dosage && <p>Dosage: {med.dosage}</p>}
                                    {med.frequency && <p>Frequency: {med.frequency}</p>}
                                    {med.duration && <p>Duration: {med.duration}</p>}
                                  </div>
                                  {med.matchedMedicines?.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-blue-200">
                                      <p className="text-xs text-gray-500">Available in database:</p>
                                      {med.matchedMedicines.slice(0, 2).map((m: any, i: number) => (
                                        <p key={i} className="text-xs text-green-600">✓ {m.name}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : ocrResult.rawMedicines?.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Detected Medicine Names:</p>
                              {ocrResult.rawMedicines.map((med: any, idx: number) => (
                                <div key={idx} className="bg-yellow-50 p-2 rounded text-sm">
                                  💊 {med.name} {med.dosage && `(${med.dosage})`}
                                </div>
                              ))}
                            </div>
                          ) : extractedText ? (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Raw extracted text:</p>
                              <p className="text-xs text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {extractedText}
                              </p>
                            </div>
                          ) : null}
                          
                          {/* Confidence indicator */}
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Confidence:</span>
                            <Badge variant={
                              ocrResult.confidence === 'high' ? 'default' : 
                              ocrResult.confidence === 'medium' ? 'secondary' : 'outline'
                            }>
                              {ocrResult.confidence}
                            </Badge>
                          </div>
                          
                          {/* Save button */}
                          <Button 
                            className="w-full mt-4" 
                            onClick={savePrescription}
                            disabled={!ocrResult.medicines?.length && !ocrResult.rawMedicines?.length}
                          >
                            Save Prescription
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">
                          Processing... Extracting medicine names and timings
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Prescriptions List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">My Prescriptions</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading prescriptions...
                  </div>
                ) : prescriptions.length > 0 ? (
                  <div className="space-y-4">
                    {prescriptions.map((prescription) => (
                      <div
                        key={prescription.id}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-sm">
                              Prescription #{prescription.id}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Dr. {prescription.doctor}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(prescription.uploadDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="default">{prescription.status}</Badge>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 mb-2">Prescribed Medicines:</p>
                          {prescription.medicines.map((medicine, idx) => (
                            <div
                              key={idx}
                              className="bg-gray-50 p-2 rounded-lg text-sm flex items-center"
                            >
                              <span className="mr-2">💊</span>
                              {medicine}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="mb-2">No prescriptions yet</p>
                    <p className="text-xs">
                      Your prescriptions from doctor consultations will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Today's Reminders */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Today's Reminders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {todayReminders.length > 0 ? (
                    todayReminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className={`border rounded-lg p-3 ${
                          reminder.taken
                            ? 'bg-green-50 border-green-200'
                            : reminder.skipped
                            ? 'bg-gray-50 border-gray-200 opacity-50'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {reminder.medicineName}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              🕐 {reminder.time}
                            </p>
                          </div>
                          {reminder.taken && (
                            <Badge variant="default" className="text-xs">
                              ✓ Taken
                            </Badge>
                          )}
                          {reminder.skipped && (
                            <Badge variant="secondary" className="text-xs">
                              Skipped
                            </Badge>
                          )}
                        </div>
                        {!reminder.taken && !reminder.skipped && (
                          <div className="flex space-x-2 mt-2">
                            <Button
                              size="sm"
                              onClick={() => markAsTaken(reminder.id)}
                              className="flex-1 text-xs h-7"
                            >
                              Mark as Taken
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markAsSkipped(reminder.id)}
                              className="flex-1 text-xs h-7"
                            >
                              Skip
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No reminders for today
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Reminder Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reminder Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Push Notifications</p>
                    <p className="text-xs text-gray-600">
                      Get reminded on your device
                    </p>
                  </div>
                  <Badge variant="default">ON</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">SMS Reminders</p>
                    <p className="text-xs text-gray-600">Receive text messages</p>
                  </div>
                  <Badge variant="secondary">OFF</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Advance Notice</p>
                    <p className="text-xs text-gray-600">Remind 15 mins before</p>
                  </div>
                  <Badge variant="default">ON</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
