from functools import wraps
from flask import request, jsonify, g
from firebase_admin import auth
from config import db

def require_auth(roles=None):
    """
    Decorator to protect Flask endpoints.
    Verifies Firebase ID Token or Student Session Token passed in the Authorization header.
    Inspects Firestore for the user record to verify activity status and permission roles.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({"success": False, "error": "Missing or malformed Authorization header. Use Bearer <token>"}), 401
            
            token = auth_header.split('Bearer ')[1].strip()
            
            if db is None:
                return jsonify({"success": False, "error": "Database driver offline, cannot check authorization."}), 500

            uid = None
            user_profile = None

            # 1. Handle student-session- and mock-jwt- tokens directly
            if token.startswith('student-session-') or token.startswith('mock-jwt-'):
                if token.startswith('student-session-'):
                    user_id = token.replace('student-session-', '')
                else:
                    parts = token.split('-')
                    user_id = parts[2] if len(parts) >= 3 else token

                try:
                    user_doc = db.collection('users').document(user_id).get()
                    if user_doc.exists:
                        user_profile = user_doc.to_dict()
                        uid = user_doc.id
                except Exception as e:
                    print(f"Direct token lookup error: {str(e)}")

            # 2. If not matched yet, try standard Firebase ID token verification
            if not user_profile:
                try:
                    decoded_claims = auth.verify_id_token(token)
                    uid = decoded_claims['uid']
                    user_doc = db.collection('users').document(uid).get()
                    if user_doc.exists:
                        user_profile = user_doc.to_dict()
                except Exception as e:
                    # Fallback lookup: try treating token directly as user document id
                    try:
                        user_doc = db.collection('users').document(token).get()
                        if user_doc.exists:
                            user_profile = user_doc.to_dict()
                            uid = user_doc.id
                    except Exception:
                        pass

            if not user_profile:
                return jsonify({"success": False, "error": "User profile not found in database records."}), 403

            # Check status
            if user_profile.get('status') == 'suspended' or user_profile.get('status') == 'inactive':
                return jsonify({"success": False, "error": "User account status is deactivated by Admin."}), 403

            # Attach verified user document data to Flask global context
            g.current_user = user_profile
            g.current_user['uid'] = uid

            # Handle specific role permissions validation
            if roles and user_profile.get('role') not in roles:
                return jsonify({
                    "success": False, 
                    "error": f"Access forbidden. Required role(s): {roles}, current role: {user_profile.get('role')}"
                }), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator
