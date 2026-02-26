const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to handle API requests with proper error handling
async function apiRequest(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('Backend server is not running. Please start the backend server.');
      throw new Error('Unable to connect to the server. Please make sure the backend is running on http://localhost:5000');
    }
    throw error;
  }
}

export const api = {
  // Auth
  login: async (email: string, password: string, type: 'patient' | 'doctor') => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, type }),
    });
    return response.json();
  },

  // Medicines
  searchMedicines: async (query: string, limit = 10) => {
    const response = await fetch(`${API_BASE_URL}/medicines/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.json();
  },

  getMedicine: async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/medicines/${id}`);
    return response.json();
  },

  getMedicineUsages: async (id: number) => {
    const response = await fetch(`${API_BASE_URL}/medicines/${id}/usages`);
    return response.json();
  },

  getMedicineUsagesByName: async (medicineName: string, genericName?: string, dosage?: string, language: string = 'English') => {
    const response = await fetch(`${API_BASE_URL}/medicines/usages-by-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicineName, genericName, dosage, language }),
    });
    return response.json();
  },

  getAllMedicines: async (page = 1, perPage = 20) => {
    const response = await fetch(`${API_BASE_URL}/medicines/all?page=${page}&per_page=${perPage}`);
    return response.json();
  },

  // AI Health Chat
  analyzeSymptoms: async (symptoms: string, followUpAnswers?: any, language: string = 'English') => {
    const response = await fetch(`${API_BASE_URL}/chat/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms, followUpAnswers, language }),
    });
    return response.json();
  },

  // Orders
  createOrder: async (orderData: any) => {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });
    return response.json();
  },

  getUserOrders: async (userId: string) => {
    return apiRequest(`${API_BASE_URL}/orders/${userId}`);
  },

  // Consultations
  getUserConsultations: async (userId: string) => {
    return apiRequest(`${API_BASE_URL}/consultations/${userId}`);
  },

  getPendingConsultations: async () => {
    return apiRequest(`${API_BASE_URL}/consultations/pending`);
  },

  updateConsultation: async (consultationId: number, data: any) => {
    return apiRequest(`${API_BASE_URL}/consultations/${consultationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Prescriptions
  createPrescription: async (prescriptionData: any) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prescriptionData),
    });
    return response.json();
  },

  getUserPrescriptions: async (userId: string) => {
    try {
      return await apiRequest(`${API_BASE_URL}/prescriptions/${userId}`);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      // Return empty prescriptions when backend is unavailable
      return { prescriptions: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  // Shops
  getNearbyShops: async () => {
    return apiRequest(`${API_BASE_URL}/shops/nearby`);
  },

  // Health Check
  healthCheck: async () => {
    return apiRequest(`${API_BASE_URL}/health`);
  },

  // Medicine Image OCR
  analyzeMedicineImage: async (imageBase64: string) => {
    const response = await fetch(`${API_BASE_URL}/medicines/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    });
    return response.json();
  },

  // Prescription Image OCR
  analyzePrescriptionImage: async (imageBase64: string) => {
    const response = await fetch(`${API_BASE_URL}/prescriptions/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64 }),
    });
    return response.json();
  },

  // Doctor Registration
  registerDoctor: async (doctorData: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register-doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doctorData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the server. Please make sure the backend is running on http://localhost:5000');
      }
      throw error;
    }
  },

  // Patient Registration
  registerPatient: async (patientData: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register-patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registration failed' }));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the server. Please make sure the backend is running on http://localhost:5000');
      }
      throw error;
    }
  },

  // Admin - Get Doctor Registrations
  getDoctorRegistrations: async () => {
    return apiRequest(`${API_BASE_URL}/admin/doctor-registrations`);
  },

  // Admin - Review Doctor Registration
  reviewDoctorRegistration: async (doctorId: number, reviewData: any) => {
    return apiRequest(`${API_BASE_URL}/admin/doctor-registrations/${doctorId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData),
    });
  },

  // Notifications
  getNotifications: async (userId: string, unreadOnly: boolean = false, limit: number = 50) => {
    return apiRequest(`${API_BASE_URL}/notifications/${userId}?unread_only=${unreadOnly}&limit=${limit}`);
  },

  markNotificationRead: async (notificationId: string) => {
    return apiRequest(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  },

  markAllNotificationsRead: async (userId: string) => {
    return apiRequest(`${API_BASE_URL}/notifications/${userId}/mark-all-read`, {
      method: 'PUT',
    });
  },
};
