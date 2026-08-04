import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load environment vars from .env file
load_dotenv()

db = None

def init_firebase():
    global db
    if not firebase_admin._apps:
        project_id = os.getenv("FIREBASE_PROJECT_ID")
        client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
        private_key = os.getenv("FIREBASE_PRIVATE_KEY")
        
        # Check if environment credentials are provided
        if project_id and client_email and private_key:
            # Correct double-escaped newlines in the key string
            formatted_key = private_key.replace('\\n', '\n').strip('"').strip("'")
            cred_dict = {
                "type": "service_account",
                "project_id": project_id,
                "private_key": formatted_key,
                "client_email": client_email,
                "token_uri": "https://oauth2.googleapis.com/token",
            }
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized successfully via Environment Variables.")
        else:
            try:
                # Try initializing with default credentials
                firebase_admin.initialize_app()
                print("Firebase Admin SDK initialized successfully via Application Default Credentials.")
            except Exception as e:
                print(f"CRITICAL ERROR: Firebase Credentials not found: {e}")
                print("Please create a backend/.env file and fill in Firestore database credentials.")
                raise e
    
    db = firestore.client()
    
    # Auto-repair admin role if it was accidentally modified/wiped
    try:
        admin_ref = db.collection('users').document('usr-admin')
        admin_snap = admin_ref.get()
        if admin_snap.exists:
            admin_data = admin_snap.to_dict()
            if admin_data.get('role') != 'admin':
                admin_ref.update({"role": "admin"})
                print("Auto-Repair: Successfully restored admin role for usr-admin in Firestore.")
        else:
            # Check by email in case uid is different
            admin_query = db.collection('users').where('email', '==', 'admin@satendify.edu').stream()
            for doc in admin_query:
                doc_data = doc.to_dict()
                if doc_data.get('role') != 'admin':
                    doc.reference.update({"role": "admin"})
                    print(f"Auto-Repair: Successfully restored admin role for user doc {doc.id} in Firestore.")
    except Exception as err:
        print(f"Warning: Admin role auto-repair migration failed: {err}")
        
    return db

# Execute initialisation
try:
    init_firebase()
except Exception as e:
    print(f"Warning: Firebase startup deferred: {e}")
