// Configuration data for the healthcare AI application

export const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
];

export const translations = {
  en: {
    appName: 'HealthCare AI',
    healthChat: 'Health Chat',
    medicineInfo: 'Medicine Info',
    orderMedicine: 'Order Medicine',
    consultations: 'Consultations',
    prescriptions: 'Prescriptions',
    selectLanguage: 'Select Language',
    describeSymptoms: 'Describe your symptoms...',
    send: 'Send',
    enterTabletName: 'Enter tablet name',
    uploadImage: 'Upload Image',
    search: 'Search',
    orderNow: 'Order Now',
    mild: 'Mild',
    severe: 'Severe',
    moderate: 'Moderate',
  },
  hi: {
    appName: 'हेल्थकेयर एआई',
    healthChat: 'स्वास्थ्य चैट',
    medicineInfo: 'दवा जानकारी',
    orderMedicine: 'दवा ऑर्डर करें',
    consultations: 'परामर्श',
    prescriptions: 'प्रिस्क्रिप्शन',
    selectLanguage: 'भाषा चुनें',
    describeSymptoms: 'अपने लक्षणों का वर्णन करें...',
    send: 'भेजें',
    enterTabletName: 'टैबलेट का नाम दर्ज करें',
    uploadImage: 'तस्वीर अपलोड करें',
    search: 'खोजें',
    orderNow: 'अभी ऑर्डर करें',
    mild: 'हल्का',
    severe: 'गंभीर',
    moderate: 'मध्यम',
  },
};

// Medical shop data (can be fetched from backend in production)
export const medicalShops = [
  {
    id: 1,
    name: 'Apollo Pharmacy',
    distance: '0.5 km',
    rating: 4.5,
    address: '123 Main Street, City Center',
    phone: '+91 98765 43210',
    openNow: true,
    deliveryTime: '20-30 mins',
  },
  {
    id: 2,
    name: 'MedPlus',
    distance: '1.2 km',
    rating: 4.3,
    address: '456 Park Avenue, Downtown',
    phone: '+91 98765 43211',
    openNow: true,
    deliveryTime: '30-40 mins',
  },
  {
    id: 3,
    name: 'Wellness Forever',
    distance: '2.1 km',
    rating: 4.7,
    address: '789 Health Road, Medical District',
    phone: '+91 98765 43212',
    openNow: true,
    deliveryTime: '40-50 mins',
  },
];

// Empty reminders array - will be populated from backend/prescriptions
export const reminders: Array<{
  id: number;
  prescriptionId: number;
  medicineName: string;
  time: string;
  date: Date;
  taken: boolean;
  skipped: boolean;
}> = [];
