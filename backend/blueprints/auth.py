from flask import Blueprint, request, jsonify, g
from firebase_admin import auth
from config import db
from decorators import require_auth

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/me', methods=['GET'])
@require_auth()
def get_profile():
    """
    Returns the currently logged in user's enriched profile information.
    Resolves role, department, semester, assigned subjects, and stats from Firestore.
    """
    user = g.current_user
    uid = user.get('uid')
    role = user.get('role')
    dept = user.get('department')
    
    user_data = {
        "id": uid,
        "email": user.get('email', 'N/A'),
        "mobile": user.get('mobile', 'N/A'),
        "role": role,
        "name": user.get('name', 'User'),
        "department": dept,
        "status": user.get('status', 'active'),
        "createdAt": user.get('createdAt')
    }

    if role == 'student':
        user_data.update({
            "semester": user.get('semester'),
            "division": user.get('division'),
            "rollNumber": user.get('rollNumber'),
            "dob": user.get('dob')
        })
    elif role in ['faculty', 'hod']:
        assigned_sub_ids = user.get('assignedSubjects', [])
        sub_list = []
        if assigned_sub_ids:
            for s_id in assigned_sub_ids:
                s_snap = db.collection('subjects').document(s_id).get()
                if s_snap.exists:
                    s_dict = s_snap.to_dict()
                    sub_list.append({"id": s_id, "name": s_dict.get('name'), "code": s_dict.get('code')})
        user_data["subjects"] = sub_list

        if role == 'hod' and dept:
            try:
                fac_count = len(db.collection('users').where('role', '==', 'faculty').where('department', '==', dept).get())
                stu_count = len(db.collection('users').where('role', '==', 'student').where('department', '==', dept).get())
                user_data["deptFacultyCount"] = fac_count
                user_data["deptStudentCount"] = stu_count
            except Exception:
                pass

    return jsonify({"success": True, "data": user_data}), 200

@auth_bp.route('/me', methods=['PUT'])
@require_auth(['admin', 'hod', 'faculty'])
def update_my_profile():
    """
    Updates currently logged in staff (HOD / Faculty) or Admin profile details.
    Students are strictly forbidden from modifying official records.
    """
    uid = g.current_user.get('uid')
    data = request.get_json() or {}
    
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    mobile = (data.get('mobile') or '').strip()

    if not name:
        return jsonify({"success": False, "error": "Full Name is required."}), 400

    try:
        user_ref = db.collection('users').document(uid)
        update_data = {"name": name}
        if email:
            update_data["email"] = email
        if mobile:
            update_data["mobile"] = mobile

        user_ref.update(update_data)

        # Clear in-memory auth cache so profile updates reflect immediately
        from decorators import USER_CACHE
        USER_CACHE.clear()

        return jsonify({"success": True, "message": "Profile details updated successfully!"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Alternative payload verification. Receives idToken in body.
    """
    data = request.get_json() or {}
    id_token = data.get('idToken')
    
    if not id_token:
        return jsonify({"success": False, "error": "idToken parameter is required."}), 400
        
    try:
        # Verify Token via Firebase Authentication
        decoded_claims = auth.verify_id_token(id_token)
        uid = decoded_claims['uid']
        
        # Verify user has registered database profile
        user_ref = db.collection('users').document(uid).get()
        if not user_ref.exists:
            return jsonify({"success": False, "error": "This account is authenticated, but no profile details found in database."}), 403
            
        user_profile = user_ref.to_dict()
        if user_profile.get('status') != 'active':
            return jsonify({"success": False, "error": "User account is suspended."}), 403
            
        user_data = {
            "id": uid,
            "email": user_profile.get('email'),
            "role": user_profile.get('role'),
            "name": user_profile.get('name'),
            "department": user_profile.get('department'),
            "semester": user_profile.get('semester'),
            "division": user_profile.get('division'),
            "rollNumber": user_profile.get('rollNumber'),
            "subjects": user_profile.get('assignedSubjects', [])
        }
        
        return jsonify({"success": True, "data": user_data}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Token verification failed: {str(e)}"}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    Stateless logout indicator.
    """
    return jsonify({"success": True, "message": "Sign out session acknowledged."}), 200

@auth_bp.route('/student-login', methods=['POST'])
def student_login():
    """
    Student authentication using Roll Number and DOB (DDMMYYYY).
    """
    data = request.get_json() or {}
    roll_number = (data.get('rollNumber') or '').strip().upper()
    dob = (data.get('dob') or '').strip().replace('-', '').replace('/', '')
    
    if not roll_number or not dob:
        return jsonify({"success": False, "error": "Roll number and Date of Birth (DDMMYYYY) are required."}), 400
        
    try:
        # Query Firestore users collection for matching student
        users_ref = db.collection('users')
        query = users_ref.where('role', '==', 'student').where('rollNumber', '==', roll_number).limit(1).get()
        
        if not query:
            return jsonify({"success": False, "error": "Invalid Roll Number or Date of Birth (DDMMYYYY)."}), 401
            
        student_doc = query[0]
        student_profile = student_doc.to_dict()
        
        # Compare DOB
        user_dob = str(student_profile.get('dob') or '').replace('-', '').replace('/', '').strip()
        if user_dob != dob:
            return jsonify({"success": False, "error": "Invalid Roll Number or Date of Birth (DDMMYYYY)."}), 401
            
        if student_profile.get('status') == 'suspended':
            return jsonify({"success": False, "error": "Student account is suspended."}), 403
            
        user_data = {
            "id": student_doc.id,
            "email": student_profile.get('email'),
            "role": student_profile.get('role', 'student'),
            "name": student_profile.get('name'),
            "department": student_profile.get('department'),
            "semester": student_profile.get('semester'),
            "division": student_profile.get('division'),
            "rollNumber": student_profile.get('rollNumber'),
            "dob": student_profile.get('dob')
        }
        
        return jsonify({"success": True, "token": f"student-session-{student_doc.id}", "data": user_data}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Authentication error: {str(e)}"}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Triggers Firebase Authentication password reset.
    Returns the action reset link.
    """
    data = request.get_json() or {}
    email = data.get('email')
    
    if not email:
        return jsonify({"success": False, "error": "Email address is required."}), 400
        
    try:
        # Generate password reset link via Firebase Admin
        reset_link = auth.generate_password_reset_link(email)
        return jsonify({
            "success": True, 
            "message": "Password reset trigger generated.",
            "data": {
                "resetLink": reset_link
            }
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": f"Password reset failed: {str(e)}"}), 400
