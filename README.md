## AI Health Guidance Medicine Portal

Full‑stack project combining a **Flask backend with Gemini AI** and a **Next.js (App Router) frontend** for medicine search, AI health guidance, consultations, prescriptions, and orders.

### 1. Project Structure

- **backend** – Flask API, Gemini AI integration, medicine dataset usage  
- **frontend** – Next.js UI for patients, doctors, and admin flows

For backend‑specific API details, also see `backend/README.md`.

### 2. Prerequisites

- **Python 3.9+**  
- **Node.js 18+** and **npm**  
- A **Gemini API key** (and any other keys you keep in `.env`, like Twilio)

### 3. Backend Setup & Execution

From the `backend` folder:

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The backend will run on `http://localhost:5000`.

#### Environment variables

Create a `.env` file inside the `backend` folder (this file is **not pushed to GitHub**):

```bash
GEMINI_API_KEY=your_key_here
# any other secrets like TWILIO_...
```

### 4. Frontend Setup & Execution

From the `frontend` folder:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000` and is configured to talk to the Flask backend running on `http://localhost:5000`.

### 5. Files Not Included in GitHub (Important)

Because of GitHub file‑size and security limits, a few files are **kept locally** and are **ignored in git**:

- `backend/medicines.csv` – large medicine dataset (A–Z medicines of India)  
- `backend/indian_medicine_data (1).csv` – additional medicine data  
- `backend/.env` – environment variables and API keys  
- Build / cache folders such as `frontend/.next/` and `node_modules/`

To fully run the project after cloning from GitHub:

1. **Obtain the medicine CSV files** (the same ones used during development).  
2. Place them in the `backend` folder with the **exact same filenames** shown above.  
3. Create your own `backend/.env` file with valid keys.  
4. Then follow the backend and frontend execution steps in sections **3** and **4**.

### 6. Demo Login Credentials

If enabled in the backend, you can use these demo accounts:

- Patient: `patient@demo.com` / `patient123`  
- Doctor: `doctor@demo.com` / `doctor123`

> This README focuses on **clean execution steps** so anyone can clone the repo, add the missing local‑only files, and run the full AI Health Guidance Medicine Portal without needing to change any paths or folder structure.

