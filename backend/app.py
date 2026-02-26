import os
import sys
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from dotenv import load_dotenv
from datetime import datetime
import json
import base64
from io import BytesIO

# MongoDB Database
from database import (
    db,
    get_user_by_email,
    create_user,
    get_user_by_id,
    create_order,
    get_orders_by_user,
    get_order_by_id,
    update_order,
    create_consultation,
    get_consultations_by_user,
    get_pending_consultations,
    get_consultation_by_id,
    update_consultation,
    create_prescription,
    get_prescriptions_by_user,
    get_prescription_by_id,
    initialize_demo_users,
    create_notification,
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read,
    get_unread_count,
    notify_doctors
)

# Fix Windows console encoding for Unicode characters
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Tesseract OCR imports
try:
    import pytesseract
    from PIL import Image, ImageEnhance, ImageFilter
    TESSERACT_AVAILABLE = True
    # Configure Tesseract path for Windows
    if os.name == 'nt':  # Windows
        tesseract_paths = [
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
            r'C:\Tesseract-OCR\tesseract.exe',
        ]
        for path in tesseract_paths:
            if os.path.exists(path):
                pytesseract.pytesseract.tesseract_cmd = path
                break
    print("✓ Tesseract OCR loaded successfully")
except ImportError:
    TESSERACT_AVAILABLE = False
    print("⚠ Tesseract OCR not available - install pytesseract and Tesseract-OCR")

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}}, supports_credentials=True)

# SMS Configuration - Using Twilio
# Sign up at https://www.twilio.com/try-twilio (Free $15 credit)
SMS_ENABLED = os.getenv('SMS_ENABLED', 'false').lower() == 'true'
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER', '')

# Initialize Twilio client if SMS is enabled
twilio_client = None
if SMS_ENABLED:
    try:
        from twilio.rest import Client
        if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
            twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            print(f"✓ Twilio SMS configured (from: {TWILIO_PHONE_NUMBER})")
        else:
            print("⚠ SMS_ENABLED=true but Twilio credentials not configured")
            print("  Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env")
    except ImportError:
        print("⚠ Twilio package not installed. Install with: pip install twilio")
        SMS_ENABLED = False

def send_sms(phone_number, message):
    """Send SMS using Twilio"""
    if not SMS_ENABLED or not twilio_client:
        print(f"📱 SMS disabled - Would send to {phone_number}: {message}")
        return False
    
    try:
        # Clean phone number
        phone = phone_number.strip().replace(' ', '').replace('-', '')
        
        # Ensure phone has country code
        if phone.startswith('+91'):
            phone = phone  # Keep as is
        elif phone.startswith('91') and len(phone) == 12:
            phone = '+' + phone
        elif len(phone) == 10:
            phone = '+91' + phone  # Assume Indian number
        
        print(f"📱 Sending SMS via Twilio to {phone}...")
        
        message_obj = twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=phone
        )
        
        print(f"✓ SMS sent successfully to {phone}")
        print(f"  Message SID: {message_obj.sid}")
        print(f"  Status: {message_obj.status}")
        return True
            
    except Exception as e:
        print(f"✗ SMS error: {e}")
        return False

def notify_doctors_with_sms(notification_data, message_text=None):
    """Send notification to all doctors via app and SMS"""
    # Send in-app notifications
    notifications = notify_doctors(notification_data)
    
    # Send SMS to doctors with phone numbers
    if SMS_ENABLED and twilio_client:
        doctors = list(db.db.users.find({"type": "doctor"}))
        sms_message = message_text or notification_data.get('message', 'New notification from HealthCare App')
        
        for doctor in doctors:
            phone = doctor.get('phone') or doctor.get('phoneNumber')
            if phone:
                # Twilio supports up to 1600 chars, but keep it short for readability
                short_message = sms_message[:300] + '...' if len(sms_message) > 300 else sms_message
                send_sms(phone, short_message)
    
    return notifications

# Connect to MongoDB
print("\n" + "="*50)
print("🔌 Connecting to MongoDB...")
print("="*50)
db.connect()
if db.is_connected():
    print("✓ Initializing demo users...")
    initialize_demo_users()
print("="*50 + "\n")

# Configure Gemini AI - Using REST API directly (more reliable than SDK)
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in environment")
else:
    print(f"✓ Gemini API Key loaded: {GEMINI_API_KEY[:10]}...")

# Gemini API endpoint - Using stable models (Jan 2026)
# Fallback models in order of preference
MODELS_TO_TRY = [
    "gemini-2.0-flash",      # Latest stable flash model
    "gemini-2.5-flash",      # Newer flash model
    "gemini-2.0-flash-lite", # Lite version (faster)
    "gemma-3-4b-it",         # Gemma model fallback
]
PRIMARY_MODEL = "gemini-2.0-flash"  # Most reliable current model

def call_gemini_api(prompt):
    """Call Gemini API using REST endpoint directly"""
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY not configured")
    
    last_error = None
    
    # Try each model until one works
    for model_name in [PRIMARY_MODEL] + MODELS_TO_TRY:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "topP": 0.95,
                "topK": 40,
                "maxOutputTokens": 2048,
            }
        }
        
        headers = {
            "Content-Type": "application/json"
        }
        
        print(f"Calling Gemini API ({model_name})...")
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            
            print(f"API Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract text from response
                if 'candidates' in data and len(data['candidates']) > 0:
                    candidate = data['candidates'][0]
                    if 'content' in candidate and 'parts' in candidate['content']:
                        parts = candidate['content']['parts']
                        if len(parts) > 0 and 'text' in parts[0]:
                            print(f"SUCCESS with {model_name}!")
                            return parts[0]['text']
            
            # If we got here, try next model
            error_data = response.json() if response.text else {}
            last_error = error_data.get('error', {}).get('message', f"Status {response.status_code}")
            print(f"Model {model_name} failed: {last_error[:100]}...")
            
        except Exception as e:
            last_error = str(e)
            print(f"Model {model_name} error: {e}")
            continue
    
    raise Exception(f"All models failed. Last error: {last_error}")

def call_gemini_vision_api(prompt, image_base64, mime_type="image/jpeg"):
    """Call Gemini Vision API to analyze images"""
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY not configured")
    
    # Vision-capable models - verified available models (Jan 2026)
    vision_models = [
        "gemini-2.0-flash",           # Stable multimodal model
        "gemini-2.5-flash",           # Latest flash with vision
        "gemini-2.0-flash-exp",       # Experimental version
        "gemini-2.0-flash-lite",      # Lite version
    ]
    last_error = None
    
    for model_name in vision_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_base64
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.3,
                "topP": 0.95,
                "topK": 40,
                "maxOutputTokens": 1024,
            }
        }
        
        headers = {"Content-Type": "application/json"}
        
        print(f"Calling Gemini Vision API ({model_name})...")
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            print(f"Vision API Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if 'candidates' in data and len(data['candidates']) > 0:
                    candidate = data['candidates'][0]
                    if 'content' in candidate and 'parts' in candidate['content']:
                        parts = candidate['content']['parts']
                        if len(parts) > 0 and 'text' in parts[0]:
                            print(f"Vision SUCCESS with {model_name}!")
                            return parts[0]['text']
            
            error_data = response.json() if response.text else {}
            last_error = error_data.get('error', {}).get('message', f"Status {response.status_code}")
            print(f"Vision model {model_name} failed: {last_error[:100]}...")
            
        except Exception as e:
            last_error = str(e)
            print(f"Vision model {model_name} error: {e}")
            continue
    
    raise Exception(f"All vision models failed. Last error: {last_error}")

print(f"✓ Gemini REST API configured (primary model: {PRIMARY_MODEL})")

# Load medicine dataset
MEDICINE_DATA = None
try:
    MEDICINE_DATA = pd.read_csv('medicines.csv')
    print(f"✓ Loaded {len(MEDICINE_DATA)} medicines from dataset")
    print(f"  Columns: {MEDICINE_DATA.columns.tolist()}")
except Exception as e:
    print(f"✗ Error loading medicine dataset: {e}")

# ==================== HELPER FUNCTIONS ====================

def translate_medical_response(response_dict, target_language):
    """Translate medical response fields to target language using Gemini"""
    try:
        # Build translation prompt
        translate_prompt = f"""Translate the following medical text from English to {target_language}.
Keep the translation natural, clear, and medically accurate.

IMPORTANT: Return ONLY valid JSON with translated text. Medicine names should remain in English.

English JSON:
{json.dumps(response_dict, ensure_ascii=False, indent=2)}

Translate these fields to {target_language}:
- followUpQuestions (array of questions)
- analysis (medical explanation)
- recommendations (array of recommendations)

Keep these fields unchanged:
- severity
- suggestedMedicines (medicine names stay in English)
- doctorConsultation
- urgencyLevel

Return the complete JSON with translated fields in {target_language}."""

        translated_text = call_gemini_api(translate_prompt)
        
        # Extract JSON from response
        translated_text = translated_text.strip()
        if '```' in translated_text:
            translated_text = translated_text.replace('```json', '').replace('```', '').strip()
        
        first_brace = translated_text.find('{')
        last_brace = translated_text.rfind('}')
        if first_brace != -1 and last_brace != -1:
            translated_text = translated_text[first_brace:last_brace + 1]
        
        translated_result = json.loads(translated_text)
        print(f"✓ Successfully translated to {target_language}")
        return translated_result
        
    except Exception as e:
        print(f"Translation error: {e}")
        # Return original if translation fails
        return response_dict

def search_medicines(query, limit=10):
    """Search medicines from dataset"""
    if MEDICINE_DATA is None:
        return []
    
    query_lower = query.lower()
    
    # Search in medicine name and generic name
    results = MEDICINE_DATA[
        MEDICINE_DATA['med_name'].str.lower().str.contains(query_lower, na=False) |
        MEDICINE_DATA['generic_name'].str.lower().str.contains(query_lower, na=False) |
        MEDICINE_DATA['disease_name'].str.lower().str.contains(query_lower, na=False)
    ].head(limit)
    
    medicines = []
    for idx, row in results.iterrows():
        # Parse price from string like '₹335.68'
        price_str = str(row['final_price']) if pd.notna(row['final_price']) else '₹50.0'
        try:
            price = float(price_str.replace('₹', '').replace(',', '').strip())
        except:
            price = 50.0
        
        # Clean manufacturer string
        manufacturer = str(row['drug_manufacturer']) if pd.notna(row['drug_manufacturer']) else 'Unknown'
        manufacturer = manufacturer.replace('* Mkt:', '').strip()
        
        medicines.append({
            'id': idx,
            'name': str(row['med_name']) if pd.notna(row['med_name']) else '',
            'generic_name': str(row['generic_name']) if pd.notna(row['generic_name']) else '',
            'disease': str(row['disease_name']) if pd.notna(row['disease_name']) else '',
            'composition': str(row['generic_name']) if pd.notna(row['generic_name']) else '',
            'uses': str(row['disease_name']) if pd.notna(row['disease_name']) else 'General use medicine',
            'sideEffects': 'Consult doctor for side effects information',
            'manufacturer': manufacturer,
            'prescription_required': str(row['prescription_required']) == 'Rx required' if pd.notna(row['prescription_required']) else False,
            'available': True,
            'price': price,
            'image_url': str(row['img_urls']).split(',')[0] if pd.notna(row['img_urls']) else ''
        })
    
    return medicines

def get_medicine_by_id(medicine_id):
    """Get medicine details by ID (using DataFrame index)"""
    if MEDICINE_DATA is None:
        return None
    
    # Find by index
    try:
        if medicine_id < 0 or medicine_id >= len(MEDICINE_DATA):
            return None
        row = MEDICINE_DATA.iloc[medicine_id]
    except:
        return None
    
    # Parse price from string like '₹335.68'
    price_str = str(row['final_price']) if pd.notna(row['final_price']) else '₹50.0'
    try:
        price = float(price_str.replace('₹', '').replace(',', '').strip())
    except:
        price = 50.0
    
    # Clean manufacturer string
    manufacturer = str(row['drug_manufacturer']) if pd.notna(row['drug_manufacturer']) else 'Unknown'
    manufacturer = manufacturer.replace('* Mkt:', '').strip()
    
    # Get drug content for detailed info (truncated)
    drug_content = str(row['drug_content']) if pd.notna(row['drug_content']) else ''
    if len(drug_content) > 500:
        drug_content = drug_content[:500] + '...'
    
    return {
        'id': medicine_id,
        'name': str(row['med_name']) if pd.notna(row['med_name']) else '',
        'generic_name': str(row['generic_name']) if pd.notna(row['generic_name']) else '',
        'disease': str(row['disease_name']) if pd.notna(row['disease_name']) else '',
        'composition': str(row['generic_name']) if pd.notna(row['generic_name']) else '',
        'uses': str(row['disease_name']) if pd.notna(row['disease_name']) else 'General use medicine',
        'description': drug_content,
        'sideEffects': 'Consult doctor for side effects information',
        'manufacturer': manufacturer,
        'prescription_required': str(row['prescription_required']) == 'Rx required' if pd.notna(row['prescription_required']) else False,
        'available': True,
        'price': price,
        'image_url': str(row['img_urls']).split(',')[0] if pd.notna(row['img_urls']) else '',
        'drug_variant': str(row['drug_varient']) if pd.notna(row['drug_varient']) else ''
    }

def analyze_symptoms_with_ai(symptoms, follow_up_answers=None, language='English'):
    """Use Gemini AI to analyze symptoms via REST API"""
    try:
        # ALWAYS get response in English first for reliable JSON parsing
        prompt = f"""You are a professional medical AI assistant helping patients understand their health issues. 

PATIENT'S INPUT: {symptoms}

{f"PATIENT'S PREVIOUS ANSWERS: {follow_up_answers}" if follow_up_answers else ""}

YOUR TASK - FOLLOW THIS SEQUENCE STRICTLY:

**STEP 1: VALIDATE IF THIS IS A VALID HEALTH QUERY**
- Check if the query is related to health, symptoms, medical conditions, or wellness
- Invalid queries include: greetings only, random questions, non-health topics, jokes, etc.
- Set "isValidHealthQuery" to true ONLY if it's a genuine health-related concern

**STEP 2: IF NOT A VALID HEALTH QUERY (isValidHealthQuery = false)**
- DO NOT provide any medical analysis, recommendations, or medicines
- Set "needsClarification" to true
- Ask the patient to describe their health symptoms or concerns
- Explain that you can only help with health-related questions
- Set all other fields to empty/null

**STEP 3: IF VALID BUT UNCLEAR (isValidHealthQuery = true but insufficient information)**
- Set "needsClarification" to true
- Ask 1-2 specific follow-up questions to understand better (MAXIMUM 2 questions only)
- Questions should help determine: duration, severity, additional symptoms, triggers, etc.
- DO NOT provide recommendations or medicines yet - wait for more information
- Provide a brief acknowledgment but no diagnosis

**STEP 4: ONLY IF VALID AND CLEAR (isValidHealthQuery = true AND sufficient information)**
- Set "needsClarification" to false
- Proceed with full analysis, severity assessment, and recommendations
- Suggest appropriate medicines ONLY if symptoms are clear and well-understood

**SEVERITY LEVELS:**
- **mild**: Common, not serious (e.g., common cold, minor headache)
- **moderate**: Needs attention but not urgent (e.g., persistent cough, moderate fever)
- **severe**: Requires immediate medical attention (e.g., high fever, chest pain, difficulty breathing)

**MEDICINE SUGGESTIONS:**
- **CRITICAL**: Medicine names MUST be in ENGLISH ONLY (generic names like Paracetamol, Ibuprofen, Cetirizine)
- Only suggest safe, common OTC medicines when symptoms are CLEAR
- For severe cases, DO NOT suggest medicines - only recommend doctor consultation
- If unsure or unclear symptoms, DO NOT suggest medicines

**IMPORTANT GUIDELINES:**
- Be cautious and conservative - when in doubt, ask more questions
- Never suggest medicines for unclear or poorly described symptoms
- If symptoms indicate serious conditions, mark as SEVERE and strongly recommend immediate medical attention
- Be empathetic and professional

**CRITICAL**: Your response MUST be ONLY valid JSON - nothing before or after the JSON object.

RESPONSE FORMAT (JSON):
{{
  "isValidHealthQuery": true,
  "needsClarification": false,
  "followUpQuestions": ["Question 1?", "Question 2?"],
  "analysis": "Clear explanation (only if needsClarification is false)",
  "severity": "mild",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "suggestedMedicines": ["Paracetamol"],
  "doctorConsultation": "recommended",
  "urgencyLevel": "if symptoms worsen"
}}

EXAMPLES:

Example 1 - Invalid Query:
Input: "Hello"
Output: {{"isValidHealthQuery": false, "needsClarification": true, "followUpQuestions": ["Hello! I'm here to help with your health concerns. What symptoms are you experiencing?", "Are you feeling unwell? Please describe your symptoms."], "analysis": "", "severity": null, "recommendations": [], "suggestedMedicines": [], "doctorConsultation": null, "urgencyLevel": null}}

Example 2 - Valid but Unclear:
Input: "I don't feel good"
Output: {{"isValidHealthQuery": true, "needsClarification": true, "followUpQuestions": ["Can you describe specifically what symptoms you're experiencing?", "How long have you been feeling this way?"], "analysis": "I understand you're not feeling well. To help you better, I need more specific information about your symptoms.", "severity": null, "recommendations": [], "suggestedMedicines": [], "doctorConsultation": null, "urgencyLevel": null}}

Example 3 - Valid and Clear:
Input: "I have a headache and fever for 2 days, temperature is 101°F"
Output: {{"isValidHealthQuery": true, "needsClarification": false, "followUpQuestions": [], "analysis": "You appear to have symptoms consistent with a viral infection or flu...", "severity": "moderate", "recommendations": ["Rest and stay hydrated", "Monitor temperature"], "suggestedMedicines": ["Paracetamol"], "doctorConsultation": "recommended", "urgencyLevel": "if symptoms worsen"}}

IMPORTANT: 
- Return ONLY the JSON object above
- No explanatory text before or after
- No markdown formatting
- No code blocks
- Just pure JSON starting with {{ and ending with }}"""
        
        # Call Gemini REST API directly
        response_text = call_gemini_api(prompt)
        
        print("="*80)
        print("GEMINI API RESPONSE:")
        print("="*80)
        print(response_text)
        print("="*80)
        
        # Clean up response text - multiple aggressive strategies
        original_response = response_text
        response_text = response_text.strip()
        
        # Strategy 1: Remove markdown code blocks if present
        if '```' in response_text:
            # Remove all markdown code block markers
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            print("Removed markdown code blocks")
        
        # Strategy 2: Find the JSON object boundaries
        # Look for the first { and last }
        first_brace = response_text.find('{')
        last_brace = response_text.rfind('}')
        
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            extracted_json = response_text[first_brace:last_brace + 1]
            print(f"Extracted JSON from position {first_brace} to {last_brace}")
            print(f"Extracted JSON (first 200 chars): {extracted_json[:200]}")
            response_text = extracted_json
        
        # Strategy 3: Clean up any remaining issues
        response_text = response_text.strip()
        
        # Strategy 4: Try to parse and if it fails, try to fix common issues
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                result = json.loads(response_text)
                print(f"✓ Successfully parsed JSON on attempt {attempt + 1}")
                break
            except json.JSONDecodeError as e:
                print(f"Attempt {attempt + 1} - JSON Parse Error at position {e.pos}: {e.msg}")
                
                if attempt < max_attempts - 1:
                    # Try to fix common issues
                    # Fix 1: Remove any text before first {
                    if not response_text.startswith('{'):
                        idx = response_text.find('{')
                        if idx > 0:
                            response_text = response_text[idx:]
                            print(f"  Fixed: Removed {idx} characters before first brace")
                            continue
                    
                    # Fix 2: Remove any text after last }
                    if not response_text.endswith('}'):
                        idx = response_text.rfind('}')
                        if idx > 0:
                            response_text = response_text[:idx + 1]
                            print(f"  Fixed: Removed text after last brace")
                            continue
                
                # If all attempts failed, create default response
                if attempt == max_attempts - 1:
                    print("All JSON parsing attempts failed, using default response")
                    result = None
        
        # If parsing succeeded, validate and set defaults
        if result and isinstance(result, dict):
            print("✓ JSON parsed successfully, validating fields...")
            
            # Check if this is a valid health query
            is_valid = result.get('isValidHealthQuery', True)
            needs_clarification = result.get('needsClarification', False)
            
            print(f"  Valid health query: {is_valid}")
            print(f"  Needs clarification: {needs_clarification}")
            
            # Ensure all required fields exist with defaults
            result.setdefault('isValidHealthQuery', True)
            result.setdefault('needsClarification', False)
            result.setdefault('followUpQuestions', [])
            result.setdefault('severity', None if needs_clarification or not is_valid else 'moderate')
            result.setdefault('recommendations', [])
            result.setdefault('suggestedMedicines', [])
            result.setdefault('doctorConsultation', None if needs_clarification or not is_valid else 'recommended')
            result.setdefault('urgencyLevel', None if needs_clarification or not is_valid else 'if symptoms worsen')
            
            # Ensure analysis exists and is not empty
            if 'analysis' not in result or not result['analysis']:
                if not is_valid:
                    result['analysis'] = 'I can only help with health-related questions. Please describe your health symptoms or concerns.'
                elif needs_clarification:
                    result['analysis'] = 'I need more information to help you better. Please answer the questions below.'
                else:
                    result['analysis'] = 'Please provide more details about your symptoms for better analysis.'
            
            # If it's not a valid health query or needs clarification, clear medicine suggestions
            if not is_valid or needs_clarification:
                result['suggestedMedicines'] = []
                result['recommendations'] = [] if not is_valid else result.get('recommendations', [])
            
            print(f"  Analysis length: {len(result['analysis'])} chars")
            print(f"  Follow-up questions: {len(result.get('followUpQuestions', []))}")
            print(f"  Recommendations: {len(result.get('recommendations', []))}")
            print(f"  Medicines: {len(result.get('suggestedMedicines', []))}")
                
        else:
            # If JSON parsing completely failed, return structured error
            print("❌ Complete JSON parsing failure, returning error response")
            result = {
                'isValidHealthQuery': True,
                'needsClarification': True,
                'analysis': 'I apologize, but I\'m having trouble processing your request properly. Could you please rephrase your symptoms or health concerns?',
                'severity': None,
                'followUpQuestions': ['Could you describe your symptoms in more detail?', 'How long have you been experiencing these symptoms?'],
                'recommendations': [],
                'suggestedMedicines': [],
                'doctorConsultation': None,
                'urgencyLevel': None
            }
        
        # If language is not English, translate the text fields
        if language != 'English' and result:
            print(f"Translating response to {language}...")
            result = translate_medical_response(result, language)
        
        return result
        
    except Exception as e:
        print(f"AI Analysis Error: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            'isValidHealthQuery': True,
            'needsClarification': True,
            'analysis': 'I apologize, but I am unable to process your request at this time. Please describe your health concerns again, or consult a qualified healthcare professional.',
            'severity': None,
            'followUpQuestions': ['Could you describe your symptoms again?', 'What health concerns are you experiencing?'],
            'recommendations': [
                'If experiencing severe symptoms, consult a doctor immediately',
                'Do not self-medicate without professional advice'
            ],
            'suggestedMedicines': [],
            'doctorConsultation': None,
            'urgencyLevel': None
        }

# ==================== AUTH ENDPOINTS ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint"""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    user_type = data.get('type')
    
    # Get user from MongoDB
    user = get_user_by_email(email)
    
    if user:
        # Check if doctor is approved (if user_type is doctor)
        if user_type == 'doctor':
            if user.get('registrationStatus') == 'pending':
                return jsonify({
                    'success': False, 
                    'message': 'Your account is pending admin approval. Please wait for verification.'
                }), 403
            elif user.get('registrationStatus') == 'rejected':
                return jsonify({
                    'success': False,
                    'message': 'Your registration was rejected. Please contact support.'
                }), 403
        
        # In production, use proper password hashing (bcrypt, etc.)
        if user.get('password') == password and user.get('type') == user_type:
            # Return user without password and MongoDB _id
            user_response = {k: v for k, v in user.items() if k not in ['password', '_id']}
            return jsonify({
                'success': True,
                'user': user_response
            })
    
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/auth/register-doctor', methods=['POST'])
def register_doctor():
    """Doctor registration endpoint"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['name', 'email', 'password', 'licenseNumber', 'specialization', 
                          'phone', 'licenseCertificate', 'licenseFileName']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Check if doctor already registered
        existing_user = get_user_by_email(data['email'])
        if existing_user:
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Create doctor registration in MongoDB
        doctor_data = {
            'name': data['name'],
            'email': data['email'],
            'password': data['password'],  # In production, hash this!
            'type': 'doctor',
            'licenseNumber': data['licenseNumber'],
            'specialization': data['specialization'],
            'hospitalAffiliation': data.get('hospitalAffiliation', ''),
            'phone': data['phone'],
            'yearsOfExperience': data.get('yearsOfExperience', 0),
            'licenseCertificate': data['licenseCertificate'],
            'licenseFileName': data['licenseFileName'],
            'registrationStatus': 'pending',  # pending, approved, rejected
            'submittedAt': datetime.now().isoformat(),
            'reviewedAt': None,
            'reviewNotes': None
        }
        
        # Insert into database
        result = db.db.users.insert_one(doctor_data)
        
        return jsonify({
            'success': True,
            'message': 'Registration submitted successfully. Please wait for admin approval.',
            'doctorId': str(result.inserted_id)
        })
        
    except Exception as e:
        print(f"Error in doctor registration: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/auth/register-patient', methods=['POST'])
def register_patient():
    """Patient registration endpoint"""
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['name', 'email', 'password', 'phone']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Check if patient already registered
        existing_user = get_user_by_email(data['email'])
        if existing_user:
            return jsonify({'success': False, 'message': 'Email already registered'}), 400
        
        # Get next user ID
        patient_count = db.db.users.count_documents({'type': 'patient'}) if db.is_connected() else 0
        
        # Create patient in MongoDB
        patient_data = {
            'id': str(patient_count + 100),  # Start from 100 to avoid conflicts with demo users
            'name': data['name'],
            'email': data['email'],
            'password': data['password'],  # In production, hash this!
            'type': 'patient',
            'phone': data['phone'],
            'registeredAt': datetime.now().isoformat()
        }
        
        # Insert into database
        result = db.db.users.insert_one(patient_data)
        
        return jsonify({
            'success': True,
            'message': 'Registration successful! You can now login.',
            'patientId': str(result.inserted_id)
        })
        
    except Exception as e:
        print(f"Error in patient registration: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== ADMIN ENDPOINTS ====================

@app.route('/api/admin/doctor-registrations', methods=['GET'])
def get_doctor_registrations():
    """Get all doctor registrations for admin review"""
    try:
        # Get all doctors with registration status
        doctors = list(db.db.users.find(
            {'type': 'doctor'},
            {'password': 0}  # Don't return passwords
        ))
        
        # Convert ObjectId to string and format response
        formatted_doctors = []
        for idx, doctor in enumerate(doctors):
            formatted_doctor = {
                'id': idx + 1,  # Simple incrementing ID for frontend
                '_mongoId': str(doctor.get('_id', '')),
                'name': doctor.get('name', ''),
                'email': doctor.get('email', ''),
                'licenseNumber': doctor.get('licenseNumber', ''),
                'specialization': doctor.get('specialization', ''),
                'hospitalAffiliation': doctor.get('hospitalAffiliation', ''),
                'phone': doctor.get('phone', ''),
                'yearsOfExperience': doctor.get('yearsOfExperience', 0),
                'licenseCertificate': doctor.get('licenseCertificate', ''),
                'licenseFileName': doctor.get('licenseFileName', ''),
                'status': doctor.get('registrationStatus', 'approved'),  # Default to approved for legacy
                'submittedAt': doctor.get('submittedAt', datetime.now().isoformat()),
                'reviewedAt': doctor.get('reviewedAt'),
                'reviewNotes': doctor.get('reviewNotes', '')
            }
            formatted_doctors.append(formatted_doctor)
        
        return jsonify({'success': True, 'registrations': formatted_doctors})
        
    except Exception as e:
        print(f"Error getting doctor registrations: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/doctor-registrations/<int:doctor_id>/review', methods=['PUT'])
def review_doctor_registration(doctor_id):
    """Admin endpoint to approve or reject doctor registration"""
    try:
        data = request.json
        status = data.get('status')  # 'approved' or 'rejected'
        review_notes = data.get('reviewNotes', '')
        
        if status not in ['approved', 'rejected']:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400
        
        # Get all doctors and find by index (since we use incrementing IDs)
        doctors = list(db.db.users.find({'type': 'doctor'}))
        
        if doctor_id < 1 or doctor_id > len(doctors):
            return jsonify({'success': False, 'message': 'Doctor not found'}), 404
        
        doctor = doctors[doctor_id - 1]  # Convert 1-based ID to 0-based index
        
        # Update registration status using MongoDB _id
        update_result = db.db.users.update_one(
            {'_id': doctor['_id']},
            {
                '$set': {
                    'registrationStatus': status,
                    'reviewedAt': datetime.now().isoformat(),
                    'reviewNotes': review_notes
                }
            }
        )
        
        if update_result.modified_count > 0:
            return jsonify({
                'success': True,
                'message': f'Doctor registration {status} successfully'
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to update registration'}), 500
            
    except Exception as e:
        print(f"Error reviewing doctor registration: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== MEDICINE ENDPOINTS ====================

@app.route('/api/medicines/search', methods=['GET'])
def search_medicines_endpoint():
    """Search medicines"""
    query = request.args.get('q', '')
    limit = int(request.args.get('limit', 10))
    
    if not query:
        return jsonify({'medicines': []})
    
    medicines = search_medicines(query, limit)
    return jsonify({'medicines': medicines})

@app.route('/api/medicines/<int:medicine_id>', methods=['GET'])
def get_medicine(medicine_id):
    """Get medicine details"""
    medicine = get_medicine_by_id(medicine_id)
    if medicine:
        return jsonify({'medicine': medicine})
    return jsonify({'error': 'Medicine not found'}), 404

@app.route('/api/medicines/all', methods=['GET'])
def get_all_medicines():
    """Get all medicines with pagination"""
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    search = request.args.get('search', '').lower()
    
    if MEDICINE_DATA is None:
        return jsonify({'medicines': [], 'total': 0, 'pages': 0})
    
    # Filter by search query if provided
    if search:
        filtered_data = MEDICINE_DATA[
            MEDICINE_DATA['med_name'].str.lower().str.contains(search, na=False) |
            MEDICINE_DATA['generic_name'].str.lower().str.contains(search, na=False) |
            MEDICINE_DATA['disease_name'].str.lower().str.contains(search, na=False)
        ]
    else:
        filtered_data = MEDICINE_DATA
    
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    
    total = len(filtered_data)
    medicines_page = filtered_data.iloc[start_idx:end_idx]
    
    medicines = []
    for idx, row in medicines_page.iterrows():
        # Parse price from string like '₹335.68'
        price_str = str(row['final_price']) if pd.notna(row['final_price']) else '₹50.0'
        try:
            price = float(price_str.replace('₹', '').replace(',', '').strip())
        except:
            price = 50.0
        
        # Clean manufacturer string
        manufacturer = str(row['drug_manufacturer']) if pd.notna(row['drug_manufacturer']) else 'Unknown'
        manufacturer = manufacturer.replace('* Mkt:', '').strip()
        
        medicines.append({
            'id': idx,
            'name': str(row['med_name']) if pd.notna(row['med_name']) else '',
            'generic_name': str(row['generic_name']) if pd.notna(row['generic_name']) else '',
            'disease': str(row['disease_name']) if pd.notna(row['disease_name']) else '',
            'composition': str(row['generic_name']) if pd.notna(row['generic_name']) else '',
            'uses': str(row['disease_name']) if pd.notna(row['disease_name']) else 'General use',
            'manufacturer': manufacturer,
            'prescription_required': str(row['prescription_required']) == 'Rx required' if pd.notna(row['prescription_required']) else False,
            'available': True,
            'price': price,
            'image_url': str(row['img_urls']).split(',')[0] if pd.notna(row['img_urls']) else ''
        })
    
    return jsonify({
        'medicines': medicines,
        'total': total,
        'page': page,
        'pages': (total + per_page - 1) // per_page
    })

# ==================== MEDICINE DETAILS WITH AI ====================

@app.route('/api/medicines/<int:medicine_id>/usages', methods=['GET'])
def get_medicine_usages(medicine_id):
    """Get detailed medical usages for a medicine using Gemini AI"""
    medicine = get_medicine_by_id(medicine_id)
    if not medicine:
        return jsonify({'error': 'Medicine not found'}), 404
    
    # Get language from query parameter (default to English)
    language = request.args.get('language', 'English')
    
    try:
        prompt = f"""You are a medical information assistant. Provide detailed, accurate medical information about the following medicine.

MEDICINE DETAILS:
- Name: {medicine['name']}
- Generic Name: {medicine.get('generic_name', 'N/A')}
- Composition: {medicine.get('composition', 'N/A')}
- Disease/Condition: {medicine.get('disease', 'N/A')}

Please provide the following information in a structured JSON format:

1. **Medical Uses**: List all medical conditions and diseases this medicine is used to treat
2. **How It Works**: Explain the mechanism of action in simple terms
3. **Dosage Guidelines**: General dosage information (note that actual dosage should be determined by a doctor)
4. **Side Effects**: Common and serious side effects to watch for
5. **Precautions**: Important warnings and who should avoid this medicine
6. **Drug Interactions**: Medicines or substances that may interact with this drug
7. **Storage Instructions**: How to properly store the medicine

IMPORTANT: 
- Provide accurate, medically-sound information
- Use simple language that patients can understand
- Always remind users to consult a healthcare professional

Respond ONLY with valid JSON in this format:
{{
    "medicalUses": ["Use 1", "Use 2", "Use 3"],
    "howItWorks": "Explanation of mechanism of action",
    "dosageGuidelines": "General dosage information",
    "commonSideEffects": ["Side effect 1", "Side effect 2"],
    "seriousSideEffects": ["Serious effect 1", "Serious effect 2"],
    "precautions": ["Precaution 1", "Precaution 2"],
    "drugInteractions": ["Interaction 1", "Interaction 2"],
    "storageInstructions": "Storage information",
    "disclaimer": "Always consult a healthcare professional before taking any medication."
}}"""

        response_text = call_gemini_api(prompt)
        
        # Clean and parse the response
        response_text = response_text.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        usages_data = json.loads(response_text)
        
        # Translate if not English
        if language != 'English':
            print(f"Translating medicine info to {language}...")
            usages_data = translate_medical_response(usages_data, language)
        
        return jsonify({
            'success': True,
            'medicine': medicine['name'],
            'usages': usages_data
        })
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        # Return basic info if AI fails
        return jsonify({
            'success': True,
            'medicine': medicine['name'],
            'usages': {
                'medicalUses': [medicine.get('disease', 'General medical use')],
                'howItWorks': 'Please consult a healthcare professional for detailed information.',
                'dosageGuidelines': 'Follow your doctor\'s prescription.',
                'commonSideEffects': ['Consult your doctor for side effects information'],
                'seriousSideEffects': ['Seek immediate medical attention if you experience severe reactions'],
                'precautions': ['Always consult your doctor before taking any medication'],
                'drugInteractions': ['Inform your doctor about all medications you are taking'],
                'storageInstructions': 'Store as directed on the package',
                'disclaimer': 'Always consult a healthcare professional before taking any medication.'
            }
        })
    except Exception as e:
        print(f"Error getting medicine usages: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/medicines/usages-by-name', methods=['POST'])
def get_medicine_usages_by_name():
    """Get detailed medical usages for a medicine by name using Gemini AI"""
    data = request.json
    medicine_name = data.get('medicineName', '')
    generic_name = data.get('genericName', '')
    dosage = data.get('dosage', '')
    language = data.get('language', 'English')  # Default to English
    
    if not medicine_name:
        return jsonify({'error': 'Medicine name is required'}), 400
    
    try:
        # ALWAYS get medicine info in English first
        prompt = f"""You are a medical information assistant. Provide detailed, accurate medical information about the following medicine.

MEDICINE DETAILS:
- Name: {medicine_name}
- Generic Name: {generic_name if generic_name else 'Not specified'}
- Dosage: {dosage if dosage else 'Not specified'}

Please provide the following information in a structured JSON format:

1. **Medical Uses**: List all medical conditions and diseases this medicine is used to treat
2. **How It Works**: Explain the mechanism of action in simple terms
3. **Dosage Guidelines**: General dosage information (note that actual dosage should be determined by a doctor)
4. **Side Effects**: Common and serious side effects to watch for
5. **Precautions**: Important warnings and who should avoid this medicine
6. **Drug Interactions**: Medicines or substances that may interact with this drug
7. **Storage Instructions**: How to properly store the medicine

IMPORTANT: 
- Provide accurate, medically-sound information
- Use simple language that patients can understand
- Always remind users to consult a healthcare professional
- If the medicine name seems misspelled, try to identify the correct medicine

Respond ONLY with valid JSON in this format:
{{
    "medicalUses": ["Use 1", "Use 2", "Use 3"],
    "howItWorks": "Explanation of mechanism of action",
    "dosageGuidelines": "General dosage information",
    "commonSideEffects": ["Side effect 1", "Side effect 2"],
    "seriousSideEffects": ["Serious effect 1", "Serious effect 2"],
    "precautions": ["Precaution 1", "Precaution 2"],
    "drugInteractions": ["Interaction 1", "Interaction 2"],
    "storageInstructions": "Storage information",
    "disclaimer": "Always consult a healthcare professional before taking any medication."
}}"""

        response_text = call_gemini_api(prompt)
        
        # Clean and parse the response
        response_text = response_text.strip()
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        usages_data = json.loads(response_text)
        
        return jsonify({
            'success': True,
            'medicine': medicine_name,
            'usages': usages_data
        })
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return jsonify({
            'success': True,
            'medicine': medicine_name,
            'usages': {
                'medicalUses': ['General medical use - please consult a healthcare professional'],
                'howItWorks': 'Please consult a healthcare professional for detailed information.',
                'dosageGuidelines': 'Follow your doctor\'s prescription.',
                'commonSideEffects': ['Consult your doctor for side effects information'],
                'seriousSideEffects': ['Seek immediate medical attention if you experience severe reactions'],
                'precautions': ['Always consult your doctor before taking any medication'],
                'drugInteractions': ['Inform your doctor about all medications you are taking'],
                'storageInstructions': 'Store as directed on the package',
                'disclaimer': 'Always consult a healthcare professional before taking any medication.'
            }
        })
    except Exception as e:
        print(f"Error getting medicine usages by name: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ==================== AI HEALTH CHAT ENDPOINTS ====================

@app.route('/api/chat/analyze', methods=['POST'])
def analyze_symptoms():
    """Analyze symptoms using AI"""
    data = request.json
    symptoms = data.get('symptoms', '')
    follow_up_answers = data.get('followUpAnswers')
    language = data.get('language', 'English')  # Default to English
    
    if not symptoms:
        return jsonify({'error': 'Symptoms are required'}), 400
    
    analysis = analyze_symptoms_with_ai(symptoms, follow_up_answers, language)
    
    print(f"AI Analysis complete. Suggested medicines: {analysis.get('suggestedMedicines', [])}")
    print(f"Is valid health query: {analysis.get('isValidHealthQuery', True)}")
    print(f"Needs clarification: {analysis.get('needsClarification', False)}")
    
    # Only search for medicines if the query is valid and doesn't need clarification
    suggested_medicines_data = []
    if analysis.get('isValidHealthQuery') and not analysis.get('needsClarification'):
        for medicine_name in analysis.get('suggestedMedicines', []):
            print(f"Searching for medicine: {medicine_name}")
            # Try to find medicine by name
            found = search_medicines(medicine_name, limit=3)
            if found:
                print(f"  Found {len(found)} matches for '{medicine_name}'")
                suggested_medicines_data.append(found[0])
            else:
                # Try searching by generic name or common variations
                # Remove parentheses and try again
                clean_name = medicine_name.replace('(', '').replace(')', '').strip()
                print(f"  Trying clean name: {clean_name}")
                found = search_medicines(clean_name, limit=3)
                if found:
                    print(f"  Found {len(found)} matches for '{clean_name}'")
                    suggested_medicines_data.append(found[0])
                else:
                    print(f"  No matches found for '{medicine_name}'")
        
        # Remove duplicates based on medicine ID
        seen_ids = set()
        unique_medicines = []
        for med in suggested_medicines_data:
            if med['id'] not in seen_ids:
                seen_ids.add(med['id'])
                unique_medicines.append(med)
        
        print(f"Found {len(unique_medicines)} medicines for suggestions")
    else:
        unique_medicines = []
        print("Skipping medicine search - query needs validation or clarification")
    
    return jsonify({
        'isValidHealthQuery': analysis.get('isValidHealthQuery', True),
        'needsClarification': analysis.get('needsClarification', False),
        'analysis': analysis['analysis'],
        'severity': analysis.get('severity'),
        'followUpQuestions': analysis.get('followUpQuestions', []),
        'recommendations': analysis.get('recommendations', []),
        'suggestedMedicines': unique_medicines,
        'doctorConsultation': analysis.get('doctorConsultation'),
        'urgencyLevel': analysis.get('urgencyLevel')
    })

# ==================== ORDER ENDPOINTS ====================

@app.route('/api/orders', methods=['POST'])
def create_order_endpoint():
    """Create new order"""
    data = request.json
    
    # Generate order ID
    order_count = db.db.orders.count_documents({}) if db.is_connected() else 0
    
    order_data = {
        'id': f"ORD-{datetime.now().strftime('%Y%m%d')}-{order_count + 1:03d}",
        'userId': data.get('userId'),
        'medicines': data.get('medicines', []),
        'shop': data.get('shop'),
        'address': data.get('address'),
        'phone': data.get('phone'),
        'total': data.get('total'),
        'status': 'pending',
        'doctorConsulted': False
    }
    
    # Save to MongoDB
    order = create_order(order_data)
    
    # Create consultation entry
    consultation_count = db.db.consultations.count_documents({}) if db.is_connected() else 0
    consultation_data = {
        'id': consultation_count + 1,
        'orderId': order_data['id'],
        'userId': data.get('userId'),
        'status': 'pending',
        'symptoms': data.get('symptoms', '')
    }
    
    consultation = create_consultation(consultation_data)
    
    # Send notification to all doctors (in-app + SMS)
    symptoms_preview = data.get('symptoms', '')[:50]
    notify_doctors_with_sms(
        {
            'type': 'new_consultation',
            'title': 'New Consultation Request',
            'message': f'A new consultation request has been submitted for symptoms: {symptoms_preview}...',
            'consultationId': consultation_data['id'],
            'orderId': order_data['id']
        },
        message_text=f'HealthCare: New patient consultation request. Symptoms: {symptoms_preview}... Login to respond.'
    )
    
    return jsonify({'success': True, 'order': order, 'consultation': consultation})

@app.route('/api/orders/<user_id>', methods=['GET'])
def get_user_orders_endpoint(user_id):
    """Get user orders"""
    user_orders = get_orders_by_user(user_id)
    return jsonify({'orders': user_orders})

# ==================== CONSULTATION ENDPOINTS ====================

@app.route('/api/consultations/<user_id>', methods=['GET'])
def get_user_consultations_endpoint(user_id):
    """Get user consultations"""
    user_consultations = get_consultations_by_user(user_id)
    return jsonify({'consultations': user_consultations})

@app.route('/api/consultations/pending', methods=['GET'])
def get_pending_consultations_endpoint():
    """Get all pending consultations (for doctors)"""
    pending = get_pending_consultations()
    return jsonify({'consultations': pending})

@app.route('/api/consultations/<int:consultation_id>', methods=['PUT'])
def update_consultation_endpoint(consultation_id):
    """Update consultation (for doctors)"""
    data = request.json
    
    update_data = {
        'status': data.get('status'),
        'diagnosis': data.get('diagnosis'),
        'medicines': data.get('medicines', []),
        'dosageInstructions': data.get('dosageInstructions'),
        'notes': data.get('notes')
    }
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    consultation = update_consultation(consultation_id, update_data)
    
    if consultation:
        # Send in-app notification to patient
        patient_id = consultation.get('userId')
        if patient_id:
            create_notification({
                'userId': patient_id,
                'type': 'consultation_completed',
                'title': 'Consultation Completed',
                'message': f'Your consultation has been completed. Diagnosis: {data.get("diagnosis", "See details")}',
                'consultationId': consultation_id
            })
            
            # Send SMS to patient if they have a phone number
            if SMS_ENABLED and twilio_client:
                patient = get_user_by_id(patient_id)
                if patient:
                    patient_phone = patient.get('phone') or patient.get('phoneNumber')
                    if patient_phone:
                        # Get doctor name
                        doctor_id = consultation.get('doctorId')
                        doctor = get_user_by_id(doctor_id) if doctor_id else None
                        doctor_name = doctor.get('name', 'Your doctor') if doctor else 'Your doctor'
                        
                        # Create SMS message
                        diagnosis = data.get('diagnosis', 'completed')[:80]
                        sms_message = f'HealthCare: Dr. {doctor_name} completed your consultation. Diagnosis: {diagnosis}. Login to view prescription & details.'
                        send_sms(patient_phone, sms_message)
        
        return jsonify({'success': True, 'consultation': consultation})
    
    return jsonify({'error': 'Consultation not found'}), 404

# ==================== NOTIFICATION ENDPOINTS ====================

@app.route('/api/notifications/<user_id>', methods=['GET'])
def get_notifications_endpoint(user_id):
    """Get notifications for a user"""
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    limit = int(request.args.get('limit', 50))
    
    notifications = get_user_notifications(user_id, limit=limit, unread_only=unread_only)
    unread_count = get_unread_count(user_id)
    
    return jsonify({
        'notifications': notifications,
        'unreadCount': unread_count
    })

@app.route('/api/notifications/<notification_id>/read', methods=['PUT'])
def mark_notification_read_endpoint(notification_id):
    """Mark a notification as read"""
    notification = mark_notification_read(notification_id)
    
    if notification:
        return jsonify({'success': True, 'notification': notification})
    
    return jsonify({'error': 'Notification not found'}), 404

@app.route('/api/notifications/<user_id>/mark-all-read', methods=['PUT'])
def mark_all_notifications_read_endpoint(user_id):
    """Mark all notifications as read for a user"""
    success = mark_all_notifications_read(user_id)
    
    if success:
        return jsonify({'success': True})
    
    return jsonify({'error': 'Failed to mark notifications as read'}), 500

# ==================== PRESCRIPTION ENDPOINTS ====================

@app.route('/api/prescriptions', methods=['POST'])
def create_prescription_endpoint():
    """Create prescription"""
    data = request.json
    
    prescription_count = db.db.prescriptions.count_documents({}) if db.is_connected() else 0
    prescription_data = {
        'id': prescription_count + 1,
        'userId': data.get('userId'),
        'doctor': data.get('doctor'),
        'medicines': data.get('medicines', []),
        'status': 'active'
    }
    
    prescription = create_prescription(prescription_data)
    return jsonify({'success': True, 'prescription': prescription})

@app.route('/api/prescriptions/<user_id>', methods=['GET'])
def get_user_prescriptions_endpoint(user_id):
    """Get user prescriptions"""
    user_prescriptions = get_prescriptions_by_user(user_id)
    return jsonify({'prescriptions': user_prescriptions})

# ==================== MEDICAL SHOPS ENDPOINT ====================

@app.route('/api/shops/nearby', methods=['GET'])
def get_nearby_shops():
    """Get nearby medical shops"""
    # Mock data - in production, use real location API
    shops = [
        {
            'id': 1,
            'name': 'Apollo Pharmacy',
            'distance': '0.5 km',
            'rating': 4.5,
            'address': '123 Main Street, City Center',
            'phone': '+91 98765 43210',
            'openNow': True,
            'deliveryTime': '20-30 mins'
        },
        {
            'id': 2,
            'name': 'MedPlus',
            'distance': '1.2 km',
            'rating': 4.3,
            'address': '456 Park Avenue, Downtown',
            'phone': '+91 98765 43211',
            'openNow': True,
            'deliveryTime': '30-40 mins'
        },
        {
            'id': 3,
            'name': 'Wellness Forever',
            'distance': '2.1 km',
            'rating': 4.7,
            'address': '789 Health Road, Medical District',
            'phone': '+91 98765 43212',
            'openNow': True,
            'deliveryTime': '40-50 mins'
        }
    ]
    return jsonify({'shops': shops})

# ==================== HEALTH CHECK ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'medicinesLoaded': MEDICINE_DATA is not None,
        'totalMedicines': len(MEDICINE_DATA) if MEDICINE_DATA is not None else 0,
        'mongodbConnected': db.is_connected()
    })

# ==================== IMAGE OCR FOR MEDICINE ====================

def preprocess_image_for_ocr(image, is_prescription=False):
    """Preprocess image to improve OCR accuracy"""
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Convert to grayscale
    image = image.convert('L')
    
    # Resize if too small (OCR works better with larger images)
    width, height = image.size
    if width < 1500:
        ratio = 1500 / width
        image = image.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)
    
    if is_prescription:
        # For prescriptions: lighter preprocessing to preserve handwriting
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        
        # Light sharpening
        image = image.filter(ImageFilter.SHARPEN)
        
        # Adaptive threshold for handwriting
        # Don't apply hard threshold for prescriptions
    else:
        # For medicine labels: moderate preprocessing to preserve text
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.8)
        
        # Sharpen the image moderately
        image = image.filter(ImageFilter.SHARPEN)
        
        # Apply adaptive threshold (less aggressive to preserve colored text)
        # Only binarize if really needed - many medicine labels have colored text
        threshold = 120  # Lower threshold to capture more text
        image = image.point(lambda p: 255 if p > threshold else 0)
    
    return image

def extract_text_with_tesseract(image_base64, is_prescription=False):
    """Extract text from image using Tesseract OCR"""
    if not TESSERACT_AVAILABLE:
        raise Exception("Tesseract OCR is not available")
    
    # Decode base64 image
    image_bytes = base64.b64decode(image_base64)
    image = Image.open(BytesIO(image_bytes))
    
    # Preprocess image for better OCR
    processed_image = preprocess_image_for_ocr(image, is_prescription)
    
    # Configure Tesseract
    if is_prescription:
        # For prescriptions: use block mode and allow more characters
        custom_config = r'--oem 3 --psm 4 -l eng'
    else:
        # For medicine labels: use sparse text mode (better for medicine packages)
        custom_config = r'--oem 3 --psm 11 -l eng'
    
    # Extract text
    extracted_text = pytesseract.image_to_string(processed_image, config=custom_config)
    
    print(f"Tesseract extracted text: {extracted_text[:200]}..." if len(extracted_text) > 200 else f"Tesseract extracted: {extracted_text}")
    
    return extracted_text.strip()

def extract_medicine_name_with_gemini(ocr_text, is_prescription=False):
    """Use Gemini to intelligently extract medicine info from OCR text"""
    
    if is_prescription:
        prompt = f"""I have extracted the following text from a medical PRESCRIPTION using OCR. 
The text may have errors due to handwriting recognition.

---
{ocr_text}
---

Please analyze this prescription text and extract ALL medicine names mentioned.
Look for:
- Medicine/drug names (like Paracetamol, Amoxicillin, Crocin, Dolo, etc.)
- Dosage instructions (like 500mg, twice daily, etc.)
- Duration (like 5 days, 1 week, etc.)

Common Indian medicine names: Dolo, Crocin, Calpol, Combiflam, Disprin, Vicks, Betadine, Strepsils, 
Gelusil, Digene, Eno, Hajmola, Zandu, Dabur, Cipla products, etc.

Respond in this exact JSON format:
{{{{
  "medicines": [
    {{{{"name": "Medicine Name 1", "dosage": "dosage if found", "frequency": "how often", "duration": "how long"}}}},
    {{{{"name": "Medicine Name 2", "dosage": "dosage if found", "frequency": "how often", "duration": "how long"}}}}
  ],
  "doctorName": "doctor name if visible",
  "patientName": "patient name if visible",
  "date": "prescription date if visible",
  "confidence": "high/medium/low"
}}}}

Even if text is unclear, try to identify medicine names based on patterns and common drug names."""
    else:
        prompt = f"""I have extracted the following text from a medicine package/label using OCR:

---
{ocr_text}
---

Please analyze this text and extract the MEDICINE NAME (brand name or generic name).
Look for common patterns like:
- Brand names (usually prominent, in capitals)
- Generic/salt names (usually in smaller text)
- Dosage information (mg, ml, etc.)

Respond with ONLY the medicine name in this exact JSON format:
{{{{
  "medicineName": "the main brand/medicine name",
  "genericName": "generic/salt name if found",
  "dosage": "dosage if found (e.g., 500mg)",
  "confidence": "high/medium/low"
}}}}

If you cannot identify a medicine name, use empty strings."""
    
    try:
        result = call_gemini_api(prompt)
        
        # Try to parse as JSON
        result = result.strip()
        if result.startswith('```'):
            result = result.split('\n', 1)[1] if '\n' in result else result[3:]
        if result.endswith('```'):
            result = result[:-3]
        result = result.strip()
        
        # Find JSON in response
        import re
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            return parsed
    except Exception as e:
        print(f"Gemini parsing error: {e}")
    
    # Fallback: return first line as medicine name
    lines = ocr_text.split('\n')
    first_meaningful_line = next((line.strip() for line in lines if line.strip() and len(line.strip()) > 2), '')
    
    if is_prescription:
        return {
            'medicines': [{'name': first_meaningful_line, 'dosage': '', 'frequency': '', 'duration': ''}],
            'doctorName': '',
            'patientName': '',
            'date': '',
            'confidence': 'low'
        }
    else:
        return {
            'medicineName': first_meaningful_line,
            'genericName': '',
            'dosage': '',
            'confidence': 'low'
        }

@app.route('/api/medicines/ocr', methods=['POST'])
def analyze_medicine_image():
    """Analyze medicine image using Gemini Vision API (primary) + Tesseract OCR (fallback)"""
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        image_data = data['image']
        
        # Handle base64 data URL format (data:image/jpeg;base64,...)
        if ',' in image_data:
            base64_data = image_data.split(',', 1)[1]
        else:
            base64_data = image_data
        
        ocr_text = ""
        medicine_info = None
        ocr_method = "none"
        
        # Step 1: Try Gemini Vision API FIRST (most accurate for medicine images)
        if GEMINI_API_KEY:
            try:
                print("Attempting Gemini Vision API (primary method)...")
                # Determine mime type
                if ',' in image_data:
                    header = image_data.split(',')[0]
                    if 'png' in header.lower():
                        mime_type = 'image/png'
                    elif 'gif' in header.lower():
                        mime_type = 'image/gif'
                    else:
                        mime_type = 'image/jpeg'
                else:
                    mime_type = 'image/jpeg'
                
                prompt = """Analyze this medicine/tablet package image carefully and extract the following information:

1. **Medicine Brand Name**: The main product name (usually prominent, like "Dolo-650", "Crocin", "Paracetamol", etc.)
2. **Generic/Salt Name**: The active ingredient (like "Paracetamol", "Ibuprofen", "Amoxicillin", etc.)
3. **Dosage**: The strength/dosage mentioned (like "650mg", "500mg", "250mg", etc.)

Look at ALL text visible on the package - the brand name is usually the largest text.

Respond in this EXACT JSON format:
{
  "medicineName": "Brand name here",
  "genericName": "Generic/salt name here",
  "dosage": "Dosage here",
  "confidence": "high/medium/low"
}

If you can't find a specific field, use empty string ""."""
                
                vision_result = call_gemini_vision_api(prompt, base64_data, mime_type)
                ocr_method = "gemini-vision"
                print(f"✓ Gemini Vision response: {vision_result[:200]}")
                
                # Parse the JSON response
                import re
                vision_result_clean = vision_result.strip()
                if '```' in vision_result_clean:
                    vision_result_clean = vision_result_clean.replace('```json', '').replace('```', '').strip()
                
                json_match = re.search(r'\{.*\}', vision_result_clean, re.DOTALL)
                if json_match:
                    medicine_info = json.loads(json_match.group())
                    ocr_text = f"Brand: {medicine_info.get('medicineName', '')}\nGeneric: {medicine_info.get('genericName', '')}\nDosage: {medicine_info.get('dosage', '')}"
                    print(f"✓ Gemini Vision extracted: {medicine_info}")
                else:
                    # Couldn't parse JSON, use text as-is
                    medicine_info = {
                        'medicineName': vision_result_clean.split('\n')[0].strip()[:100],
                        'genericName': '',
                        'dosage': '',
                        'confidence': 'medium'
                    }
                    ocr_text = vision_result_clean
                    
            except Exception as e:
                print(f"Gemini Vision failed: {e}")
                import traceback
                traceback.print_exc()
        
        # Step 2: Fallback to Tesseract OCR if Gemini Vision failed
        if not medicine_info and TESSERACT_AVAILABLE:
            try:
                print("Falling back to Tesseract OCR...")
                ocr_text = extract_text_with_tesseract(base64_data)
                ocr_method = "tesseract"
                print(f"✓ Tesseract OCR successful, extracted {len(ocr_text)} characters")
                
                # Use Gemini to parse Tesseract output
                if ocr_text and GEMINI_API_KEY:
                    try:
                        print("Using Gemini to analyze Tesseract OCR text...")
                        medicine_info = extract_medicine_name_with_gemini(ocr_text)
                        print(f"✓ Gemini analysis complete: {medicine_info}")
                    except Exception as e:
                        print(f"Gemini analysis failed: {e}")
                        # Fallback: use first line of OCR text
                        lines = [l.strip() for l in ocr_text.split('\n') if l.strip()]
                        medicine_info = {
                            'medicineName': lines[0] if lines else '',
                            'genericName': '',
                            'dosage': '',
                            'confidence': 'low'
                        }
            except Exception as e:
                print(f"Tesseract OCR failed: {e}")
        
        # Step 3: Last resort - basic Gemini Vision without JSON parsing
        if not medicine_info and GEMINI_API_KEY:
            try:
                print("Last resort: Basic Gemini Vision extraction...")
                # Determine mime type
                if ',' in image_data:
                    header = image_data.split(',')[0]
                    if 'png' in header.lower():
                        mime_type = 'image/png'
                    elif 'gif' in header.lower():
                        mime_type = 'image/gif'
                    else:
                        mime_type = 'image/jpeg'
                else:
                    mime_type = 'image/jpeg'
                
                prompt = """What is the medicine name shown in this image? 
Extract the brand name (like Dolo-650, Crocin, etc.) and generic name (like Paracetamol) if visible.
Provide just the medicine name clearly."""
                
                ocr_text = call_gemini_vision_api(prompt, base64_data, mime_type)
                ocr_method = "gemini-vision-simple"
                
                # Clean up
                ocr_text = ocr_text.strip().replace('```', '').strip()
                # Extract first meaningful line as medicine name
                lines = [l.strip() for l in ocr_text.split('\n') if l.strip() and len(l.strip()) > 2]
                medicine_info = {
                    'medicineName': lines[0] if lines else '',
                    'genericName': lines[1] if len(lines) > 1 else '',
                    'dosage': '',
                    'confidence': 'medium'
                }
                print(f"✓ Gemini Vision simple extraction successful")
            except Exception as e:
                print(f"All OCR methods failed: {e}")
        
        if not medicine_info:
            medicine_info = {
                'medicineName': '',
                'genericName': '',
                'dosage': '',
                'confidence': 'none'
            }
        
        medicine_name = medicine_info.get('medicineName', '')
        print(f"Final extracted medicine name: {medicine_name}")
        
        # Search for the medicine in our database
        medicines = []
        if medicine_name:
            medicines = search_medicines(medicine_name, limit=10)
            
            # If no results with full name, try first word
            if not medicines and ' ' in medicine_name:
                first_word = medicine_name.split()[0]
                medicines = search_medicines(first_word, limit=10)
            
            # Also try generic name if available
            if not medicines and medicine_info.get('genericName'):
                medicines = search_medicines(medicine_info['genericName'], limit=10)
        
        return jsonify({
            'success': True,
            'extractedText': ocr_text,
            'ocrMethod': ocr_method,
            'ocrResult': {
                'detected': bool(medicine_name),
                'medicineName': medicine_name,
                'genericName': medicine_info.get('genericName', ''),
                'dosage': medicine_info.get('dosage', ''),
                'confidence': medicine_info.get('confidence', 'medium'),
                'additionalInfo': ''
            },
            'medicines': medicines
        })
        
    except Exception as e:
        print(f"OCR Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'ocrResult': None,
            'medicines': []
        }), 500

@app.route('/api/prescriptions/ocr', methods=['POST'])
def analyze_prescription_image():
    """Analyze prescription image using Tesseract OCR + Gemini AI to extract medicine details"""
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        image_data = data['image']
        
        # Handle base64 data URL format
        if ',' in image_data:
            base64_data = image_data.split(',', 1)[1]
        else:
            base64_data = image_data
        
        ocr_text = ""
        prescription_info = None
        ocr_method = "none"
        
        # Step 1: Try Tesseract OCR for prescription (with prescription-specific settings)
        if TESSERACT_AVAILABLE:
            try:
                print("Attempting Tesseract OCR for prescription...")
                ocr_text = extract_text_with_tesseract(base64_data, is_prescription=True)
                ocr_method = "tesseract"
                print(f"✓ Tesseract OCR successful, extracted {len(ocr_text)} characters")
            except Exception as e:
                print(f"Tesseract OCR failed: {e}")
        
        # Step 2: Use Gemini to extract prescription details
        if ocr_text:
            try:
                print("Using Gemini to analyze prescription text...")
                prescription_info = extract_medicine_name_with_gemini(ocr_text, is_prescription=True)
                print(f"✓ Gemini analysis complete: {prescription_info}")
            except Exception as e:
                print(f"Gemini analysis failed: {e}")
                prescription_info = {
                    'medicines': [],
                    'doctorName': '',
                    'patientName': '',
                    'date': '',
                    'confidence': 'low'
                }
        
        # Step 3: Fallback to Gemini Vision if Tesseract failed
        if not ocr_text and GEMINI_API_KEY:
            try:
                print("Falling back to Gemini Vision API for prescription...")
                if ',' in image_data:
                    header = image_data.split(',')[0]
                    if 'png' in header.lower():
                        mime_type = 'image/png'
                    else:
                        mime_type = 'image/jpeg'
                else:
                    mime_type = 'image/jpeg'
                
                prompt = """This is a medical prescription image. Please extract:
1. ALL medicine names mentioned
2. Dosage for each medicine
3. Frequency (how often to take)
4. Duration (for how many days)
5. Doctor's name if visible
6. Patient's name if visible
7. Date of prescription

Return the information in a structured format."""
                
                ocr_text = call_gemini_vision_api(prompt, base64_data, mime_type)
                ocr_method = "gemini-vision"
                
                # Try to get Gemini to parse it
                prescription_info = extract_medicine_name_with_gemini(ocr_text, is_prescription=True)
                print(f"✓ Gemini Vision successful")
            except Exception as e:
                print(f"Gemini Vision also failed: {e}")
        
        if not prescription_info:
            prescription_info = {
                'medicines': [],
                'doctorName': '',
                'patientName': '',
                'date': '',
                'confidence': 'none'
            }
        
        # Search for medicines in database
        found_medicines = []
        for med in prescription_info.get('medicines', []):
            med_name = med.get('name', '')
            if med_name:
                search_results = search_medicines(med_name, limit=3)
                if search_results:
                    found_medicines.append({
                        'prescribedName': med_name,
                        'dosage': med.get('dosage', ''),
                        'frequency': med.get('frequency', ''),
                        'duration': med.get('duration', ''),
                        'matchedMedicines': search_results
                    })
                else:
                    # Try first word
                    if ' ' in med_name:
                        search_results = search_medicines(med_name.split()[0], limit=3)
                    found_medicines.append({
                        'prescribedName': med_name,
                        'dosage': med.get('dosage', ''),
                        'frequency': med.get('frequency', ''),
                        'duration': med.get('duration', ''),
                        'matchedMedicines': search_results or []
                    })
        
        return jsonify({
            'success': True,
            'extractedText': ocr_text,
            'ocrMethod': ocr_method,
            'prescriptionData': {
                'medicines': found_medicines,
                'doctorName': prescription_info.get('doctorName', ''),
                'patientName': prescription_info.get('patientName', ''),
                'date': prescription_info.get('date', ''),
                'confidence': prescription_info.get('confidence', 'medium'),
                'rawMedicines': prescription_info.get('medicines', [])
            }
        })
        
    except Exception as e:
        print(f"Prescription OCR Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'prescriptionData': None
        }), 500

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500

# ==================== RUN SERVER ====================

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🏥 HealthCare AI Backend Server")
    print("="*50)
    print(f"📊 Medicines in database: {len(MEDICINE_DATA) if MEDICINE_DATA is not None else 0}")
    print(f"🤖 Gemini AI: {'Configured' if os.getenv('GEMINI_API_KEY') else 'Not configured'}")
    print("="*50 + "\n")
    
    app.run(host='0.0.0.0', debug=False, port=5000, threaded=True)
