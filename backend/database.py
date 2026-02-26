"""
MongoDB Database Configuration and Models
"""
import os
from datetime import datetime
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from bson.objectid import ObjectId
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB Configuration
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/healthcare_db')

class Database:
    """MongoDB Database Manager"""
    
    def __init__(self):
        self.client = None
        self.db = None
        self.connected = False
        
    def connect(self):
        """Connect to MongoDB"""
        try:
            print(f"Connecting to MongoDB: {MONGODB_URI.split('@')[-1] if '@' in MONGODB_URI else MONGODB_URI}")
            self.client = MongoClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                socketTimeoutMS=5000
            )
            
            # Test connection
            self.client.admin.command('ping')
            
            # Get database name from URI or use default
            if '/' in MONGODB_URI.split('://')[-1]:
                db_name = MONGODB_URI.split('/')[-1].split('?')[0]
            else:
                db_name = 'healthcare_db'
            
            self.db = self.client[db_name]
            self.connected = True
            
            # Create indexes
            self._create_indexes()
            
            print(f"✓ MongoDB connected successfully to database: {db_name}")
            return True
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"✗ MongoDB connection failed: {e}")
            print("  Make sure MongoDB is running on your system.")
            print("  To install MongoDB:")
            print("    - Windows: Download from https://www.mongodb.com/try/download/community")
            print("    - Mac: brew install mongodb-community")
            print("    - Linux: sudo apt-get install mongodb")
            self.connected = False
            return False
        except Exception as e:
            print(f"✗ Unexpected MongoDB error: {e}")
            self.connected = False
            return False
    
    def _create_indexes(self):
        """Create database indexes for better performance"""
        try:
            # Users collection indexes
            self.db.users.create_index([("email", ASCENDING)], unique=True)
            self.db.users.create_index([("type", ASCENDING)])
            
            # Orders collection indexes
            self.db.orders.create_index([("userId", ASCENDING)])
            self.db.orders.create_index([("status", ASCENDING)])
            self.db.orders.create_index([("createdAt", DESCENDING)])
            
            # Consultations collection indexes
            self.db.consultations.create_index([("userId", ASCENDING)])
            self.db.consultations.create_index([("status", ASCENDING)])
            self.db.consultations.create_index([("createdAt", DESCENDING)])
            self.db.consultations.create_index([("orderId", ASCENDING)])
            
            # Prescriptions collection indexes
            self.db.prescriptions.create_index([("userId", ASCENDING)])
            self.db.prescriptions.create_index([("uploadDate", DESCENDING)])
            
            # Notifications collection indexes
            self.db.notifications.create_index([("userId", ASCENDING)])
            self.db.notifications.create_index([("read", ASCENDING)])
            self.db.notifications.create_index([("createdAt", DESCENDING)])
            
            print("✓ Database indexes created")
        except Exception as e:
            print(f"Warning: Could not create indexes: {e}")
    
    def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            self.connected = False
            print("MongoDB connection closed")
    
    def is_connected(self):
        """Check if database is connected"""
        return self.connected

# Global database instance
db = Database()

# Collection helper functions

def get_user_by_email(email):
    """Get user by email"""
    if not db.connected:
        return None
    return db.db.users.find_one({"email": email})

def create_user(user_data):
    """Create a new user"""
    if not db.connected:
        return None
    
    user_data['createdAt'] = datetime.utcnow()
    user_data['updatedAt'] = datetime.utcnow()
    
    result = db.db.users.insert_one(user_data)
    user_data['_id'] = str(result.inserted_id)
    return user_data

def get_user_by_id(user_id):
    """Get user by ID"""
    if not db.connected:
        return None
    
    try:
        if isinstance(user_id, str) and ObjectId.is_valid(user_id):
            return db.db.users.find_one({"_id": ObjectId(user_id)})
        else:
            return db.db.users.find_one({"id": user_id})
    except:
        return None

# Orders collection functions

def create_order(order_data):
    """Create a new order"""
    if not db.connected:
        return None
    
    order_data['createdAt'] = datetime.utcnow()
    order_data['updatedAt'] = datetime.utcnow()
    
    result = db.db.orders.insert_one(order_data)
    order_data['_id'] = str(result.inserted_id)
    return order_data

def get_orders_by_user(user_id, limit=50):
    """Get orders by user ID"""
    if not db.connected:
        return []
    
    orders = list(db.db.orders.find(
        {"userId": user_id}
    ).sort("createdAt", DESCENDING).limit(limit))
    
    # Convert ObjectId to string
    for order in orders:
        order['_id'] = str(order['_id'])
    
    return orders

def get_order_by_id(order_id):
    """Get order by ID"""
    if not db.connected:
        return None
    
    try:
        if ObjectId.is_valid(order_id):
            order = db.db.orders.find_one({"_id": ObjectId(order_id)})
        else:
            order = db.db.orders.find_one({"id": order_id})
        
        if order:
            order['_id'] = str(order['_id'])
        return order
    except:
        return None

def update_order(order_id, update_data):
    """Update an order"""
    if not db.connected:
        return None
    
    update_data['updatedAt'] = datetime.utcnow()
    
    try:
        if ObjectId.is_valid(order_id):
            result = db.db.orders.find_one_and_update(
                {"_id": ObjectId(order_id)},
                {"$set": update_data},
                return_document=True
            )
        else:
            result = db.db.orders.find_one_and_update(
                {"id": order_id},
                {"$set": update_data},
                return_document=True
            )
        
        if result:
            result['_id'] = str(result['_id'])
        return result
    except:
        return None

# Consultations collection functions

def create_consultation(consultation_data):
    """Create a new consultation"""
    if not db.connected:
        return None
    
    consultation_data['createdAt'] = datetime.utcnow()
    consultation_data['updatedAt'] = datetime.utcnow()
    
    result = db.db.consultations.insert_one(consultation_data)
    consultation_data['_id'] = str(result.inserted_id)
    return consultation_data

def get_consultations_by_user(user_id, limit=50):
    """Get consultations by user ID"""
    if not db.connected:
        return []
    
    consultations = list(db.db.consultations.find(
        {"userId": user_id}
    ).sort("createdAt", DESCENDING).limit(limit))
    
    for consultation in consultations:
        consultation['_id'] = str(consultation['_id'])
    
    return consultations

def get_pending_consultations(limit=50):
    """Get all pending consultations"""
    if not db.connected:
        return []
    
    consultations = list(db.db.consultations.find(
        {"status": "pending"}
    ).sort("createdAt", ASCENDING).limit(limit))
    
    for consultation in consultations:
        consultation['_id'] = str(consultation['_id'])
    
    return consultations

def get_consultation_by_id(consultation_id):
    """Get consultation by ID"""
    if not db.connected:
        return None
    
    try:
        if ObjectId.is_valid(consultation_id):
            consultation = db.db.consultations.find_one({"_id": ObjectId(consultation_id)})
        else:
            consultation = db.db.consultations.find_one({"id": consultation_id})
        
        if consultation:
            consultation['_id'] = str(consultation['_id'])
        return consultation
    except:
        return None

def update_consultation(consultation_id, update_data):
    """Update a consultation"""
    if not db.connected:
        return None
    
    update_data['updatedAt'] = datetime.utcnow()
    
    try:
        if ObjectId.is_valid(consultation_id):
            result = db.db.consultations.find_one_and_update(
                {"_id": ObjectId(consultation_id)},
                {"$set": update_data},
                return_document=True
            )
        else:
            result = db.db.consultations.find_one_and_update(
                {"id": consultation_id},
                {"$set": update_data},
                return_document=True
            )
        
        if result:
            result['_id'] = str(result['_id'])
        return result
    except:
        return None

# Prescriptions collection functions

def create_prescription(prescription_data):
    """Create a new prescription"""
    if not db.connected:
        return None
    
    prescription_data['uploadDate'] = datetime.utcnow()
    prescription_data['createdAt'] = datetime.utcnow()
    
    result = db.db.prescriptions.insert_one(prescription_data)
    prescription_data['_id'] = str(result.inserted_id)
    return prescription_data

def get_prescriptions_by_user(user_id, limit=50):
    """Get prescriptions by user ID"""
    if not db.connected:
        return []
    
    prescriptions = list(db.db.prescriptions.find(
        {"userId": user_id}
    ).sort("uploadDate", DESCENDING).limit(limit))
    
    for prescription in prescriptions:
        prescription['_id'] = str(prescription['_id'])
    
    return prescriptions

def get_prescription_by_id(prescription_id):
    """Get prescription by ID"""
    if not db.connected:
        return None
    
    try:
        if ObjectId.is_valid(prescription_id):
            prescription = db.db.prescriptions.find_one({"_id": ObjectId(prescription_id)})
        else:
            prescription = db.db.prescriptions.find_one({"id": prescription_id})
        
        if prescription:
            prescription['_id'] = str(prescription['_id'])
        return prescription
    except:
        return None

def update_prescription(prescription_id, update_data):
    """Update a prescription"""
    if not db.connected:
        return None
    
    update_data['updatedAt'] = datetime.utcnow()
    
    try:
        if ObjectId.is_valid(prescription_id):
            result = db.db.prescriptions.find_one_and_update(
                {"_id": ObjectId(prescription_id)},
                {"$set": update_data},
                return_document=True
            )
        else:
            result = db.db.prescriptions.find_one_and_update(
                {"id": prescription_id},
                {"$set": update_data},
                return_document=True
            )
        
        if result:
            result['_id'] = str(result['_id'])
        return result
    except:
        return None

# Initialize demo users on first run

# Notifications collection functions

def create_notification(notification_data):
    """Create a new notification"""
    if not db.connected:
        return None
    
    notification_data['createdAt'] = datetime.utcnow()
    notification_data['read'] = False
    
    result = db.db.notifications.insert_one(notification_data)
    notification_data['_id'] = str(result.inserted_id)
    return notification_data

def get_user_notifications(user_id, limit=50, unread_only=False):
    """Get notifications for a user"""
    if not db.connected:
        return []
    
    query = {"userId": user_id}
    if unread_only:
        query["read"] = False
    
    notifications = list(db.db.notifications.find(query).sort("createdAt", DESCENDING).limit(limit))
    
    for notification in notifications:
        notification['_id'] = str(notification['_id'])
    
    return notifications

def mark_notification_read(notification_id):
    """Mark a notification as read"""
    if not db.connected:
        return None
    
    try:
        if ObjectId.is_valid(notification_id):
            result = db.db.notifications.find_one_and_update(
                {"_id": ObjectId(notification_id)},
                {"$set": {"read": True, "readAt": datetime.utcnow()}},
                return_document=True
            )
        else:
            result = db.db.notifications.find_one_and_update(
                {"id": notification_id},
                {"$set": {"read": True, "readAt": datetime.utcnow()}},
                return_document=True
            )
        
        if result:
            result['_id'] = str(result['_id'])
        return result
    except:
        return None

def mark_all_notifications_read(user_id):
    """Mark all notifications as read for a user"""
    if not db.connected:
        return False
    
    try:
        db.db.notifications.update_many(
            {"userId": user_id, "read": False},
            {"$set": {"read": True, "readAt": datetime.utcnow()}}
        )
        return True
    except:
        return False

def get_unread_count(user_id):
    """Get count of unread notifications for a user"""
    if not db.connected:
        return 0
    
    return db.db.notifications.count_documents({"userId": user_id, "read": False})

def notify_doctors(notification_data):
    """Send notification to all doctors"""
    if not db.connected:
        return []
    
    # Find all active doctors
    doctors = list(db.db.users.find({"type": "doctor"}))
    
    created_notifications = []
    for doctor in doctors:
        doctor_notification = notification_data.copy()
        doctor_notification['userId'] = doctor.get('id') or doctor.get('email')
        notification = create_notification(doctor_notification)
        if notification:
            created_notifications.append(notification)
    
    return created_notifications

def initialize_demo_users():
    """Initialize demo users if they don't exist"""
    if not db.connected:
        return
    
    demo_users = [
        {
            'id': '1',
            'name': 'John Doe',
            'email': 'patient@demo.com',
            'password': 'patient123',  # In production, hash this!
            'type': 'patient',
            'phone': '+91 98765 43210'
        },
        {
            'id': '2',
            'name': 'Sarah Smith',
            'email': 'sarah@demo.com',
            'password': 'demo123',
            'type': 'patient',
            'phone': '+91 98765 43211'
        },
        {
            'id': '1',
            'name': 'Dr. Ramesh Kumar',
            'email': 'doctor@demo.com',
            'password': 'doctor123',
            'type': 'doctor',
            'specialization': 'General Physician',
            'phone': '+919876543220'  # Demo phone number for SMS testing
        },
        {
            'id': '2',
            'name': 'Dr. Priya Sharma',
            'email': 'drpriya@demo.com',
            'password': 'demo123',
            'type': 'doctor',
            'specialization': 'Dermatologist',
            'phone': '+919876543221'  # Demo phone number for SMS testing
        }
    ]
    
    for user in demo_users:
        existing = get_user_by_email(user['email'])
        if not existing:
            try:
                create_user(user)
                print(f"✓ Created demo user: {user['email']}")
            except Exception as e:
                print(f"  Note: Demo user {user['email']} may already exist")
