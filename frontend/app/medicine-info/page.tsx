'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface Medicine {
  id: number;
  name: string;
  composition: string;
  uses: string;
  sideEffects: string;
  manufacturer: string;
  price: number;
  available: boolean;
}

interface MedicineUsages {
  medicalUses: string[];
  howItWorks: string;
  dosageGuidelines: string;
  commonSideEffects: string[];
  seriousSideEffects: string[];
  precautions: string[];
  drugInteractions: string[];
  storageInstructions: string;
  disclaimer: string;
}

export default function MedicineInfoPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [medicineUsages, setMedicineUsages] = useState<MedicineUsages | null>(null);
  const [isLoadingUsages, setIsLoadingUsages] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [ocrResult, setOcrResult] = useState<{
    detected: boolean;
    medicineName: string;
    genericName: string;
    dosage: string;
    confidence: string;
    additionalInfo: string;
  } | null>(null);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const fetchMedicineUsages = async (medicineId: number) => {
    setIsLoadingUsages(true);
    setMedicineUsages(null);
    try {
      const response = await api.getMedicineUsages(medicineId);
      if (response.success && response.usages) {
        setMedicineUsages(response.usages);
      } else {
        toast.error('Failed to fetch detailed information');
      }
    } catch (error) {
      console.error('Error fetching medicine usages:', error);
      toast.error('Failed to fetch detailed information');
    } finally {
      setIsLoadingUsages(false);
    }
  };

  const fetchMedicineUsagesByName = async (medicineName: string, genericName?: string, dosage?: string) => {
    setIsLoadingUsages(true);
    setMedicineUsages(null);
    try {
      const response = await api.getMedicineUsagesByName(medicineName, genericName, dosage, selectedLanguage);
      if (response.success && response.usages) {
        setMedicineUsages(response.usages);
        toast.success('Detailed medical info loaded!');
      } else {
        toast.error('Failed to fetch detailed information');
      }
    } catch (error) {
      console.error('Error fetching medicine usages by name:', error);
      toast.error('Failed to fetch detailed information');
    } finally {
      setIsLoadingUsages(false);
    }
  };

  const handleSelectMedicine = (medicine: Medicine) => {
    setSelectedMedicine(medicine);
    setMedicineUsages(null); // Reset usages when selecting a new medicine
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Please enter a medicine name to search');
      return;
    }

    setIsLoading(true);
    setMedicineUsages(null);
    try {
      const response = await api.searchMedicines(searchTerm, 20);
      setMedicines(response.medicines || []);
      if (response.medicines && response.medicines.length > 0) {
        handleSelectMedicine(response.medicines[0]);
        toast.success(`Found ${response.medicines.length} medicines`);
      } else {
        toast.info('No medicines found. Try a different search term.');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search medicines. Make sure backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageData = reader.result as string;
        setImageFile(imageData);
        setOcrResult(null);
        setIsAnalyzingImage(true);
        
        try {
          toast.info('Analyzing image... Please wait.');
          const response = await api.analyzeMedicineImage(imageData);
          
          if (response.success && response.ocrResult) {
            setOcrResult(response.ocrResult);
            
            if (response.ocrResult.detected && response.ocrResult.medicineName) {
              toast.success(`Detected: ${response.ocrResult.medicineName}`);
              
              // Set the medicines from the OCR response
              let detectedMedicine = null;
              if (response.medicines && response.medicines.length > 0) {
                setMedicines(response.medicines);
                handleSelectMedicine(response.medicines[0]);
                detectedMedicine = response.medicines[0];
              } else {
                // If no medicines found in OCR response, search manually
                setSearchTerm(response.ocrResult.medicineName);
                const searchResponse = await api.searchMedicines(response.ocrResult.medicineName, 20);
                if (searchResponse.medicines && searchResponse.medicines.length > 0) {
                  setMedicines(searchResponse.medicines);
                  handleSelectMedicine(searchResponse.medicines[0]);
                  detectedMedicine = searchResponse.medicines[0];
                } else {
                  toast.info('Medicine detected but not found in our database.');
                }
              }
              
              // Automatically fetch AI-powered detailed info
              if (detectedMedicine) {
                setIsLoadingUsages(true);
                try {
                  const usagesResponse = await api.getMedicineUsages(detectedMedicine.id);
                  if (usagesResponse.success && usagesResponse.usages) {
                    setMedicineUsages(usagesResponse.usages);
                    toast.success('Detailed medical info loaded!');
                  }
                } catch (usageError) {
                  console.error('Error fetching medicine usages:', usageError);
                } finally {
                  setIsLoadingUsages(false);
                }
              }
            } else {
              toast.warning('Could not detect medicine name from the image. Try a clearer photo.');
            }
          } else {
            toast.error(response.error || 'Failed to analyze image');
          }
        } catch (error) {
          console.error('Image analysis error:', error);
          toast.error('Failed to analyze image. Make sure backend is running.');
        } finally {
          setIsAnalyzingImage(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              Medicine Information
            </h1>
            <p className="text-sm text-muted-foreground">
              Search by name or upload an image to get detailed medicine information
            </p>
          </div>
          
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">🌍 Language:</span>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-35">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Hindi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="Spanish">Español</SelectItem>
                <SelectItem value="French">Français</SelectItem>
                <SelectItem value="German">Deutsch</SelectItem>
                <SelectItem value="Chinese">中文</SelectItem>
                <SelectItem value="Japanese">日本語</SelectItem>
                <SelectItem value="Arabic">العربية</SelectItem>
                <SelectItem value="Portuguese">Português</SelectItem>
                <SelectItem value="Russian">Русский</SelectItem>
                <SelectItem value="Bengali">বাংলা</SelectItem>
                <SelectItem value="Tamil">தமிழ்</SelectItem>
                <SelectItem value="Telugu">తెలుగు</SelectItem>
                <SelectItem value="Marathi">मराठी</SelectItem>
                <SelectItem value="Gujarati">ગુજરાતી</SelectItem>
                <SelectItem value="Kannada">ಕನ್ನಡ</SelectItem>
                <SelectItem value="Malayalam">മലയാളം</SelectItem>
                <SelectItem value="Punjabi">ਪੰਜਾਬੀ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs 
          defaultValue="search" 
          className="w-full"
          onValueChange={(value) => {
            // Reset state when switching tabs
            setMedicines([]);
            setSelectedMedicine(null);
            setMedicineUsages(null);
            setSearchTerm('');
            if (value === 'search') {
              // Reset image-related state when switching to search
              setImageFile(null);
              setOcrResult(null);
              const fileInput = document.getElementById('image-upload') as HTMLInputElement;
              if (fileInput) fileInput.value = '';
            }
          }}
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="search">Search by Name</TabsTrigger>
            <TabsTrigger value="image">Upload Image</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-4">
            <Card className="mb-4">
              <CardContent className="pt-6">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter medicine name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={isLoading}>
                    {isLoading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
                {medicines.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                    {medicines.map((med) => (
                      <div
                        key={med.id}
                        onClick={() => handleSelectMedicine(med)}
                        className={`p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors ${
                          selectedMedicine?.id === med.id ? 'border-primary bg-muted' : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-foreground">{med.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {med.composition.substring(0, 60)}...
                            </p>
                          </div>
                          <Badge variant={med.available ? 'default' : 'secondary'}>
                            {med.available ? 'Available' : 'Out of Stock'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {searchTerm && medicines.length === 0 && !isLoading && (
                  <p className="text-sm text-muted-foreground mt-4">
                    No medicines found. Try a different search term.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="image" className="mt-4">
            <Card className="mb-4">
              <CardContent className="pt-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                    disabled={isAnalyzingImage}
                  />
                  <label htmlFor="image-upload" className={`cursor-pointer ${isAnalyzingImage ? 'opacity-50' : ''}`}>
                    <div className="text-gray-600 mb-2">
                      <span className="text-4xl">{isAnalyzingImage ? '🔍' : '📸'}</span>
                    </div>
                    <p className="text-sm font-medium">
                      {isAnalyzingImage ? 'Analyzing image...' : 'Upload tablet image'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {isAnalyzingImage ? 'Please wait while AI analyzes the image' : 'Click to browse or drag and drop'}
                    </p>
                  </label>
                  {imageFile && (
                    <div className="mt-4">
                      <div className="relative inline-block">
                        <img
                          src={imageFile}
                          alt="Uploaded"
                          className="max-h-48 mx-auto rounded-lg"
                        />
                        {!isAnalyzingImage && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full shadow-md"
                            onClick={(e) => {
                              e.preventDefault();
                              setImageFile(null);
                              setOcrResult(null);
                              setMedicines([]);
                              setSelectedMedicine(null);
                              setMedicineUsages(null);
                              // Reset the file input
                              const fileInput = document.getElementById('image-upload') as HTMLInputElement;
                              if (fileInput) fileInput.value = '';
                            }}
                            title="Upload new image"
                          >
                            <span className="text-lg">🔄</span>
                          </Button>
                        )}
                      </div>
                      {isAnalyzingImage && (
                        <div className="mt-2 flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <p className="text-sm text-muted-foreground">Analyzing with AI...</p>
                        </div>
                      )}
                      {!isAnalyzingImage && ocrResult && (
                        <div className="mt-4 text-left bg-muted/50 rounded-lg p-4">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <span>🔍</span> OCR Results
                            <Badge variant={ocrResult.confidence === 'high' ? 'default' : ocrResult.confidence === 'medium' ? 'secondary' : 'outline'}>
                              {ocrResult.confidence} confidence
                            </Badge>
                          </h4>
                          {ocrResult.detected ? (
                            <div className="space-y-1 text-sm">
                              <p><span className="text-muted-foreground">Medicine:</span> <span className="font-medium">{ocrResult.medicineName}</span></p>
                              {ocrResult.genericName && (
                                <p><span className="text-muted-foreground">Generic:</span> {ocrResult.genericName}</p>
                              )}
                              {ocrResult.dosage && (
                                <p><span className="text-muted-foreground">Dosage:</span> {ocrResult.dosage}</p>
                              )}
                              {ocrResult.additionalInfo && (
                                <p><span className="text-muted-foreground">Info:</span> {ocrResult.additionalInfo}</p>
                              )}
                              
                              {/* Get Detailed Info Button - Always show if no usages loaded yet */}
                              {!medicineUsages && !isLoadingUsages && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="mt-3 w-full"
                                  onClick={() => {
                                    if (selectedMedicine) {
                                      fetchMedicineUsages(selectedMedicine.id);
                                    } else {
                                      // Use name-based API when medicine not in database
                                      fetchMedicineUsagesByName(
                                        ocrResult.medicineName,
                                        ocrResult.genericName,
                                        ocrResult.dosage
                                      );
                                    }
                                  }}
                                  disabled={isLoadingUsages}
                                >
                                  <span className="mr-2">✨</span>
                                  Get Detailed Medical Info
                                </Button>
                              )}

                              {/* Show loading state for detailed info */}
                              {isLoadingUsages && (
                                <div className="mt-3 bg-muted/30 rounded-lg p-3 text-center">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                  <p className="text-xs text-muted-foreground">Fetching detailed info with AI...</p>
                                </div>
                              )}

                              {/* Show detailed medicine usages inline for image upload */}
                              {medicineUsages && (
                                <div className="mt-4 space-y-3 border-t pt-3">
                                  <h4 className="font-semibold text-sm flex items-center gap-2">
                                    <span>🤖</span> AI-Powered Details
                                  </h4>
                                  
                                  {/* Medical Uses */}
                                  <div>
                                    <p className="font-medium text-xs text-foreground mb-1">💊 Medical Uses:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {medicineUsages.medicalUses.slice(0, 3).map((use, index) => (
                                        <li key={index} className="text-xs text-muted-foreground">{use}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* How It Works */}
                                  <div>
                                    <p className="font-medium text-xs text-foreground mb-1">⚙️ How It Works:</p>
                                    <p className="text-xs text-muted-foreground">{medicineUsages.howItWorks.substring(0, 150)}...</p>
                                  </div>

                                  {/* Common Side Effects */}
                                  <div>
                                    <p className="font-medium text-xs text-foreground mb-1">⚠️ Common Side Effects:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {medicineUsages.commonSideEffects.slice(0, 3).map((effect, index) => (
                                        <li key={index} className="text-xs text-muted-foreground">{effect}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* Disclaimer */}
                                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
                                    <p className="text-xs text-amber-800 dark:text-amber-200">
                                      ⚕️ {medicineUsages.disclaimer}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Could not detect medicine name. Try uploading a clearer image.
                            </p>
                          )}
                        </div>
                      )}
                      {!isAnalyzingImage && !ocrResult && (
                        <p className="text-sm text-green-600 mt-2">
                          ✓ Image uploaded successfully
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {selectedMedicine && (
          <Card className="shadow-lg border-border bg-card">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl text-foreground">{selectedMedicine.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedMedicine.manufacturer}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-primary">
                    ₹{selectedMedicine.price}
                  </p>
                  <Badge
                    variant={selectedMedicine.available ? 'default' : 'secondary'}
                  >
                    {selectedMedicine.available ? 'In Stock' : 'Out of Stock'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-foreground mb-2">
                  Composition
                </h3>
                <p className="text-sm text-muted-foreground">{selectedMedicine.composition}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-foreground mb-2">
                  Uses
                </h3>
                <p className="text-sm text-muted-foreground">{selectedMedicine.uses}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-foreground mb-2">
                  Side Effects
                </h3>
                <p className="text-sm text-muted-foreground">{selectedMedicine.sideEffects || 'No side effects listed'}</p>
              </div>

              {/* AI-Powered Detailed Medicine Info Section */}
              {!medicineUsages && !isLoadingUsages && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => fetchMedicineUsages(selectedMedicine.id)}
                >
                  <span className="mr-2">✨</span>
                  Get AI-Powered Detailed Info
                </Button>
              )}

              {isLoadingUsages && (
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Fetching detailed info with AI...</p>
                </div>
              )}

              {medicineUsages && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                    <span>🤖</span> AI-Powered Medicine Details
                  </h3>

                  {/* Medical Uses */}
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span>💊</span> Medical Uses
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {medicineUsages.medicalUses.map((use, index) => (
                        <li key={index} className="text-sm text-muted-foreground">{use}</li>
                      ))}
                    </ul>
                  </div>

                  {/* How It Works */}
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span>⚙️</span> How It Works
                    </h4>
                    <p className="text-sm text-muted-foreground">{medicineUsages.howItWorks}</p>
                  </div>

                  {/* Dosage Guidelines */}
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span>📋</span> Dosage Guidelines
                    </h4>
                    <p className="text-sm text-muted-foreground">{medicineUsages.dosageGuidelines}</p>
                  </div>

                  {/* Common Side Effects */}
                  <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span>⚠️</span> Common Side Effects
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {medicineUsages.commonSideEffects.map((effect, index) => (
                        <li key={index} className="text-sm text-muted-foreground">{effect}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Serious Side Effects */}
                  {medicineUsages.seriousSideEffects.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                        <span>🚨</span> Serious Side Effects
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {medicineUsages.seriousSideEffects.map((effect, index) => (
                          <li key={index} className="text-sm text-muted-foreground">{effect}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Precautions */}
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span>🛡️</span> Precautions
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {medicineUsages.precautions.map((precaution, index) => (
                        <li key={index} className="text-sm text-muted-foreground">{precaution}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Drug Interactions */}
                  {medicineUsages.drugInteractions.length > 0 && (
                    <div className="bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-800 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                        <span>💊</span> Drug Interactions
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {medicineUsages.drugInteractions.map((interaction, index) => (
                          <li key={index} className="text-sm text-muted-foreground">{interaction}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Storage Instructions */}
                  <div className="bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-foreground mb-2 flex items-center gap-2">
                      <span>📦</span> Storage Instructions
                    </h4>
                    <p className="text-sm text-muted-foreground">{medicineUsages.storageInstructions}</p>
                  </div>
                </div>
              )}

              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <h3 className="font-semibold text-sm text-foreground mb-2 flex items-center">
                  <span className="mr-1">⚠️</span> Important Information
                </h3>
                <p className="text-sm text-muted-foreground">
                  {medicineUsages?.disclaimer || 'Always consult a doctor before taking any medication. Follow prescribed dosage instructions carefully.'}
                </p>
              </div>

              <Button className="w-full mt-4" onClick={() => router.push('/order')}>
                Order Now
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
