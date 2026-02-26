# HealthCare AI Backend

Flask backend with Gemini AI integration and medicine dataset.

## Features
- 🤖 AI-powered symptom analysis using Gemini API
- 💊 Medicine search with real dataset (A-Z Medicines of India)
- 🏥 Consultation management
- 📋 Prescription handling
- 🛒 Order management
- 🔐 Authentication system

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure `.env` file has your Gemini API key

3. Run the server:
```bash
python app.py
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Medicines
- `GET /api/medicines/search?q=query` - Search medicines
- `GET /api/medicines/<id>` - Get medicine details
- `GET /api/medicines/all` - Get all medicines (paginated)

### AI Health Chat
- `POST /api/chat/analyze` - Analyze symptoms with AI

### Orders
- `POST /api/orders` - Create order
- `GET /api/orders/<user_id>` - Get user orders

### Consultations
- `GET /api/consultations/<user_id>` - Get user consultations
- `GET /api/consultations/pending` - Get pending consultations
- `PUT /api/consultations/<id>` - Update consultation

### Prescriptions
- `POST /api/prescriptions` - Create prescription
- `GET /api/prescriptions/<user_id>` - Get user prescriptions

### Shops
- `GET /api/shops/nearby` - Get nearby medical shops

### Health Check
- `GET /api/health` - Check server status

## Demo Credentials
- Patient: `patient@demo.com` / `patient123`
- Doctor: `doctor@demo.com` / `doctor123`
