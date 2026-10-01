import datetime
import re
from flask import Blueprint, request, jsonify, g
from firebase_admin import auth, firestore
from config import db
from decorators import require_auth

admin_bp = Blueprint('admin', __name__)

# ==========================================
# 1. DEPARTMENTS CRUD
# ==========================================
@admin_bp.route('/departments', methods=['GET'])
@require_auth(['admin'])
def get_departments():
    try:
        depts_ref = db.collection('departments').stream()
        depts = [dict(d.to_dict(), id=d.id) for d in depts_ref]
        return jsonify({"success": True, "data": depts}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/departments', methods=['POST'])
@require_auth(['admin'])
def create_department():
    data = request.get_json() or {}
    name = data.get('name')
    dept_id = data.get('id') or name.upper()  # IT, CE, ME, etc.
    
    if not name:
        return jsonify({"success": False, "error": "Department name is required"}), 400
        
    try:
        doc_ref = db.collection('departments').document(dept_id)
        if doc_ref.get().exists:
            return jsonify({"success": False, "error": "Department code/id already exists"}), 409
            
        doc_ref.set({
            "name": name,
            "hodId": data.get('hodId', None)
        })
        return jsonify({"success": True, "data": {"id": dept_id, "name": name, "hodId": data.get('hodId')}}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/departments/<id>', methods=['PUT', 'DELETE'])
@require_auth(['admin'])
def handle_department_item(id):
    if request.method == 'PUT':
        data = request.get_json() or {}
        try:
            doc_ref = db.collection('departments').document(id)
            if not doc_ref.get().exists:
                return jsonify({"success": False, "error": "Department not found"}), 404
                
            doc_ref.update({
                "name": data.get('name'),
                "hodId": data.get('hodId')
            })
            return jsonify({"success": True, "data": dict(data, id=id)}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
            
    elif request.method == 'DELETE':
        try:
            doc_ref = db.collection('departments').document(id)
            if not doc_ref.get().exists:
                return jsonify({"success": False, "error": "Department not found"}), 404
            doc_ref.delete()
            return jsonify({"success": True, "message": "Department deleted"}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

# ==========================================
# 2. SUBJECTS CRUD
# ==========================================
@admin_bp.route('/subjects', methods=['GET'])
@require_auth(['admin', 'hod', 'faculty', 'student'])
def get_subjects():
    try:
        subs_ref = db.collection('subjects').stream()
        subs = [dict(s.to_dict(), id=s.id) for s in subs_ref]
        return jsonify({"success": True, "data": subs}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/subjects', methods=['POST'])
@require_auth(['admin'])
def create_subject():
    data = request.get_json() or {}
    name = data.get('name')
    code = data.get('code')
    dept = data.get('department')
    semester = data.get('semester')
    
    if not name or not code or not dept or not semester:
        return jsonify({"success": False, "error": "Missing required fields (name, code, department, semester)"}), 400
        
    try:
        sub_id = f"sub-{dept.lower()}{semester}-{code.lower()}"
        doc_ref = db.collection('subjects').document(sub_id)
        if doc_ref.get().exists:
            return jsonify({"success": False, "error": "Subject code already exists"}), 409
            
        new_sub = {
            "name": name,
            "code": code,
            "department": dept,
            "semester": int(semester),
            "facultyId": data.get('facultyId', None)
        }
        for field in ['lectureHours', 'labHours', 'tutorialHours', 'credits']:
            if field in data and data[field] is not None:
                try: new_sub[field] = int(data[field])
                except (ValueError, TypeError): pass

        doc_ref.set(new_sub)
        return jsonify({"success": True, "data": dict(new_sub, id=sub_id)}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/subjects/<id>', methods=['PUT', 'DELETE'])
@require_auth(['admin'])
def handle_subject_item(id):
    if request.method == 'PUT':
        data = request.get_json() or {}
        try:
            doc_ref = db.collection('subjects').document(id)
            if not doc_ref.get().exists:
                return jsonify({"success": False, "error": "Subject not found"}), 404
                
            update_data = {
                "name": data.get('name'),
                "code": data.get('code'),
                "department": data.get('department'),
                "semester": int(data.get('semester')),
                "facultyId": data.get('facultyId')
            }
            if 'lectureHours' in data and data['lectureHours'] is not None:
                try: update_data['lectureHours'] = int(data['lectureHours'])
                except (ValueError, TypeError): pass
            if 'labHours' in data and data['labHours'] is not None:
                try: update_data['labHours'] = int(data['labHours'])
                except (ValueError, TypeError): pass
            if 'tutorialHours' in data and data['tutorialHours'] is not None:
                try: update_data['tutorialHours'] = int(data['tutorialHours'])
                except (ValueError, TypeError): pass
            if 'credits' in data and data['credits'] is not None:
                try: update_data['credits'] = int(data['credits'])
                except (ValueError, TypeError): pass

            doc_ref.update(update_data)
            return jsonify({"success": True, "data": dict(data, id=id)}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
            
    elif request.method == 'DELETE':
        try:
            doc_ref = db.collection('subjects').document(id)
            if not doc_ref.get().exists:
                return jsonify({"success": False, "error": "Subject not found"}), 404
            doc_ref.delete()
            return jsonify({"success": True, "message": "Subject deleted"}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

# ==========================================
# 3. USERS CRUD & SECTIONS PROMOTIONS
# ==========================================
@admin_bp.route('/users', methods=['GET'])
@require_auth(['admin', 'hod', 'faculty'])
def get_users():
    try:
        current_role = g.current_user.get('role')
        user_dept = g.current_user.get('department')
        
        users_ref = db.collection('users').stream()
        users = []
        for u in users_ref:
            d = u.to_dict()
            d['id'] = u.id
            
            if current_role == 'admin':
                users.append(d)
            elif current_role in ['hod', 'faculty']:
                # HOD and Faculty can see staff and students in their department
                if d.get('department') == user_dept:
                    users.append(d)
                    
        return jsonify({"success": True, "data": users}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/users', methods=['POST'])
@require_auth(['admin', 'hod', 'faculty'])
def create_user():
    data = request.get_json() or {}
    name = data.get('name')
    role = data.get('role')
    dept = data.get('department')
    
    current_role = g.current_user.get('role')
    if current_role in ['hod', 'faculty']:
        if role != 'student':
            return jsonify({"success": False, "error": "Forbidden: HODs and Faculty can only register student accounts."}), 403
        dept = g.current_user.get('department')  # Enforce department match

    if not name or not role:
        return jsonify({"success": False, "error": "Missing required fields (name, role)"}), 400
        
    try:
        if role == 'student':
            roll_no = (data.get('rollNumber') or '').strip().upper()
            dob = (data.get('dob') or '').strip().replace('-', '').replace('/', '')
            if not roll_no or not dob:
                return jsonify({"success": False, "error": "Missing required student fields (rollNumber, dob)"}), 400

            uid = f"student-{roll_no.lower()}"
            doc_ref = db.collection('users').document(uid)

            user_doc_payload = {
                "name": name,
                "role": "student",
                "department": dept,
                "semester": int(data.get('semester', 4)),
                "division": data.get('division', 'A'),
                "rollNumber": roll_no,
                "dob": dob,
                "mobile": data.get('mobile') or data.get('phone') or '',
                "status": "active",
                "createdAt": firestore.SERVER_TIMESTAMP
            }
            doc_ref.set(user_doc_payload)
            user_doc_payload['id'] = uid
            user_doc_payload['createdAt'] = datetime.datetime.utcnow().isoformat() + 'Z'
            return jsonify({"success": True, "data": user_doc_payload}), 201
        else:
            email = data.get('email')
            password = data.get('password') or 'password123'
            if not email:
                return jsonify({"success": False, "error": "Email is required for staff accounts"}), 400

            try:
                fb_user = auth.get_user_by_email(email)
                uid = fb_user.uid
            except auth.UserNotFoundError:
                fb_user = auth.create_user(email=email, password=password, display_name=name)
                uid = fb_user.uid

            doc_ref = db.collection('users').document(uid)
            user_doc_payload = {
                "email": email,
                "name": name,
                "role": role,
                "department": dept,
                "mobile": data.get('mobile') or data.get('phone') or '',
                "phone": data.get('mobile') or data.get('phone') or '',
                "status": "active",
                "assignedSubjects": data.get('assignedSubjects', []),
                "createdAt": firestore.SERVER_TIMESTAMP
            }
            doc_ref.set(user_doc_payload)
            user_doc_payload['id'] = uid
            user_doc_payload['createdAt'] = datetime.datetime.utcnow().isoformat() + 'Z'
            return jsonify({"success": True, "data": user_doc_payload}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/users/<id>', methods=['PUT', 'DELETE'])
@require_auth(['admin', 'hod', 'faculty'])
def handle_user_item(id):
    current_role = g.current_user.get('role')
    doc_ref = db.collection('users').document(id)
    user_snap = doc_ref.get()
    if not user_snap.exists:
        return jsonify({"success": False, "error": "User code not found"}), 404
    current_user_profile = user_snap.to_dict()

    if current_role == 'faculty':
        if current_user_profile.get('role') != 'student' or current_user_profile.get('department') != g.current_user.get('department'):
            return jsonify({"success": False, "error": "Forbidden: Faculty can only manage students in their department."}), 403
    elif current_role == 'hod':
        if current_user_profile.get('department') != g.current_user.get('department'):
            return jsonify({"success": False, "error": "Forbidden: Cannot modify profiles outside your department."}), 403

    if request.method == 'PUT':
        data = request.get_json() or {}
        try:
            update_payload = {}
            if 'name' in data:
                update_payload['name'] = data['name']
            if 'email' in data and current_user_profile.get('role') != 'student':
                email = data['email']
                current_email = current_user_profile.get('email')
                if email != current_email:
                    try:
                        auth.update_user(id, email=email)
                    except Exception as auth_err:
                        return jsonify({"success": False, "error": f"Failed to update email in Firebase Authentication: {str(auth_err)}"}), 400
                    update_payload['email'] = email
            if 'password' in data and data['password']:
                try:
                    auth.update_user(id, password=data['password'])
                except Exception as auth_err:
                    return jsonify({"success": False, "error": f"Failed to update password in Firebase Authentication: {str(auth_err)}"}), 400
            if 'role' in data and current_role == 'admin':
                update_payload['role'] = data['role']
            if 'department' in data and current_role == 'admin':
                update_payload['department'] = data['department']
            if 'mobile' in data:
                update_payload['mobile'] = data['mobile']
                update_payload['phone'] = data['mobile']
            if 'phone' in data:
                update_payload['phone'] = data['phone']
                update_payload['mobile'] = data['phone']
            if 'status' in data:
                update_payload['status'] = data['status']
                
            role_to_check = current_user_profile.get('role')
            if role_to_check == 'student':
                if 'semester' in data:
                    update_payload["semester"] = int(data['semester'])
                if 'division' in data:
                    update_payload["division"] = data['division']
                if 'rollNumber' in data:
                    update_payload["rollNumber"] = data['rollNumber']
                if 'dob' in data:
                    update_payload["dob"] = str(data['dob']).strip().replace('-', '').replace('/', '')
            elif role_to_check in ['faculty', 'hod']:
                if 'assignedSubjects' in data:
                    update_payload["assignedSubjects"] = data['assignedSubjects']
                    
            doc_ref.update(update_payload)
            # Fetch updated profile for response
            updated_profile = doc_ref.get().to_dict()
            updated_profile['id'] = id
            return jsonify({"success": True, "data": updated_profile}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
            
    elif request.method == 'DELETE':
        try:
            if current_role in ['hod', 'faculty'] and current_user_profile.get('role') != 'student':
                return jsonify({"success": False, "error": "Forbidden: HOD and Faculty can only delete student accounts."}), 403
            # Delete Firestore user profile
            db.collection('users').document(id).delete()
            # Disable Firebase credentials
            try:
                auth.delete_user(id)
            except Exception:
                pass
            return jsonify({"success": True, "message": "User credentials deleted successful"}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/promote-hod', methods=['POST'])
@require_auth(['admin'])
def promote_hod():
    data = request.get_json() or {}
    faculty_id = data.get('facultyId')
    department = data.get('department')
    
    if not faculty_id or not department:
        return jsonify({"success": False, "error": "facultyId and department parameters are required"}), 400
        
    try:
        # 1. Query any active HODs in the targeted department
        active_hods_ref = db.collection('users').where('role', '==', 'hod').where('department', '==', department).stream()
        batch = db.batch()
        
        for doc in active_hods_ref:
            # Demote existing HOD to faculty role
            batch.update(doc.reference, {"role": "faculty"})
            
        # 2. Promote target faculty to HOD role
        target_ref = db.collection('users').document(faculty_id)
        target_profile = target_ref.get()
        if not target_profile.exists:
            return jsonify({"success": False, "error": "Target faculty profile not found"}), 404
            
        batch.update(target_ref, {"role": "hod", "department": department})
        
        # 3. Update HOD reference in department collection
        dept_ref = db.collection('departments').document(department)
        batch.update(dept_ref, {"hodId": faculty_id})
        
        batch.commit()
        return jsonify({"success": True, "message": f"Successfully promoted user to HOD of {department} department."}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==========================================
# 4. TIMETABLE BUILDER GRID
# ==========================================
@admin_bp.route('/timetable', methods=['GET', 'POST'])
@require_auth(['admin', 'hod', 'faculty', 'student'])
def process_timetable():
    if request.method == 'GET':
        try:
            # Fetch all timetable entries
            tt_ref = db.collection('timetables').stream()
            timeline = [dict(t.to_dict(), id=t.id) for t in tt_ref]
            return jsonify({"success": True, "data": timeline}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
            
    elif request.method == 'POST':
        # Admin / HOD role checks
        if g.current_user.get('role') not in ['admin', 'hod']:
            return jsonify({"success": False, "error": "Forbidden: Timetable modifications restricted to Admins/HODs."}), 403
            
        data = request.get_json() or {}
        dept = data.get('department')
        sem = int(data.get('semester'))
        div = data.get('division')
        day = data.get('day')
        period = int(data.get('period'))
        subject_id = data.get('subjectId')
        faculty_id = data.get('facultyId')
        room = data.get('room')
        
        slot_type = data.get('type', 'lecture')
        duration = int(data.get('duration', 1))
        
        # Scope-checks for HOD
        if g.current_user.get('role') == 'hod' and g.current_user.get('department') != dept:
            return jsonify({"success": False, "error": "Access forbidden: cannot edit timetables for other departments."}), 403
            
        if not all([dept, sem, div, day, period, subject_id, faculty_id, room]):
            return jsonify({"success": False, "error": "Missing slot configuration parameters."}), 400
            
        if period + duration - 1 > 7:
            return jsonify({"success": False, "error": f"Conflict: Session duration ({duration} periods) exceeds daily periods limit (7)."}), 400
            
        try:
            # Fetch all scheduled slots for the target day to perform overlap checks
            day_slots = db.collection('timetables').where('day', '==', day).stream()
            day_slots_list = [dict(s.to_dict(), id=s.id) for s in day_slots]
            
            # Overlap check candidate periods
            candidate_periods = set(range(period, period + duration))
            
            for s in day_slots_list:
                s_start = s.get('period')
                s_dur = int(s.get('duration', 1))
                s_periods = set(range(s_start, s_start + s_dur))
                
                # If they overlap
                if candidate_periods.intersection(s_periods):
                    cand_is_lab = (slot_type != 'lecture')
                    exist_is_lab = (s.get('type', 'lecture') != 'lecture')

                    # Check 1: Teacher Conflict
                    if s.get('facultyId') == faculty_id:
                        # Allow same professor for multi-batch labs in shared location
                        if cand_is_lab and exist_is_lab and s.get('division') != div:
                            pass
                        else:
                            return jsonify({
                                "success": False, 
                                "error": f"Conflict: Assigned professor is already scheduled to teach in this slot (overlapping Period {s_start} to {s_start + s_dur - 1})."
                            }), 409
                        
                    # Check 2: Room Conflict
                    if s.get('room') == room:
                        # Allow same room/location for labs across different batches
                        if cand_is_lab and exist_is_lab and s.get('division') != div:
                            pass
                        else:
                            return jsonify({
                                "success": False, 
                                "error": f"Conflict: Room {room} is already booked in this slot (overlapping Period {s_start} to {s_start + s_dur - 1})."
                            }), 409
                        
                    # Check 3: Class/Division Conflict
                    if s.get('department') == dept and s.get('semester') == sem:
                        is_cand_lecture = (slot_type == 'lecture')
                        is_exist_lecture = (s.get('type', 'lecture') == 'lecture')
                        exist_div = s.get('division')
                        if is_cand_lecture or is_exist_lecture or exist_div == div or exist_div == 'ALL':
                            return jsonify({
                                "success": False, 
                                "error": f"Conflict: Selected stream division is already scheduled for a class/lecture in this slot (overlapping Period {s_start} to {s_start + s_dur - 1})."
                            }), 409

            if slot_type == 'lecture':
                new_id = f"tt-slot-{dept.lower()}-{sem}-all-{day.lower()[:3]}-{period}"
                doc_ref = db.collection('timetables').document(new_id)
                slot_payload = {
                    "department": dept,
                    "semester": sem,
                    "division": "ALL",
                    "day": day,
                    "period": period,
                    "type": "lecture",
                    "duration": duration,
                    "subjectId": subject_id,
                    "facultyId": faculty_id,
                    "room": room
                }
                doc_ref.set(slot_payload)
                return jsonify({"success": True, "data": dict(slot_payload, id=new_id)}), 201
            else:
                new_id = f"tt-slot-{dept.lower()}-{sem}-{div.lower()}-{day.lower()[:3]}-{period}"
                doc_ref = db.collection('timetables').document(new_id)
                slot_payload = {
                    "department": dept,
                    "semester": sem,
                    "division": div,
                    "day": day,
                    "period": period,
                    "type": slot_type,
                    "duration": duration,
                    "subjectId": subject_id,
                    "facultyId": faculty_id,
                    "room": room
                }
                doc_ref.set(slot_payload)
                return jsonify({"success": True, "data": dict(slot_payload, id=new_id)}), 201
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/timetable/<id>', methods=['DELETE'])
@require_auth(['admin', 'hod'])
def delete_timetable_slot(id):
    try:
        doc_ref = db.collection('timetables').document(id)
        snap = doc_ref.get()
        if not snap.exists:
            return jsonify({"success": False, "error": "Timetable slot not found"}), 404
            
        slot_data = snap.to_dict()
        # Scope filters details
        if g.current_user.get('role') == 'hod' and g.current_user.get('department') != slot_data.get('department'):
            return jsonify({"success": False, "error": "Forbidden: cannot delete slots from outside department."}), 403

        slot_type = slot_data.get('type', 'lecture')
        dept_val = slot_data.get('department')
        sem_val = slot_data.get('semester')
        day_val = slot_data.get('day')
        period_val = slot_data.get('period')

        if slot_type == 'lecture':
            # Delete corresponding lecture slot across all batches of this semester
            all_slots = db.collection('timetables')\
                          .where('department', '==', dept_val)\
                          .where('semester', '==', sem_val)\
                          .where('day', '==', day_val)\
                          .where('period', '==', period_val).stream()
            for s_doc in all_slots:
                if s_doc.to_dict().get('type', 'lecture') == 'lecture':
                    s_doc.reference.delete()
        else:
            doc_ref.delete()

        return jsonify({"success": True, "message": "Timetable lecture slot removed"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/timetable/bulk-apply', methods=['POST'])
@require_auth(['admin', 'hod'])
def bulk_apply_timetable():
    """
    Applies a generated timetable schedule for a stream and semester in one bulk operation.
    Cleans up old slots for this stream/semester and writes all generated slots.
    """
    data = request.get_json() or {}
    dept = data.get('department')
    sem = data.get('semester')
    slots = data.get('slots', [])

    if not dept or sem is None or not slots:
        return jsonify({"success": False, "error": "Department, semester, and slots are required."}), 400

    # Role checks: HOD cannot modify other departments
    if g.current_user.get('role') == 'hod' and g.current_user.get('department') != dept:
        return jsonify({"success": False, "error": "Forbidden: cannot edit timetables for other departments."}), 403

    try:
        sem_int = int(sem)
        # 1. Fetch and delete existing slots for this department and semester
        existing_slots = db.collection('timetables')\
                           .where('department', '==', dept)\
                           .where('semester', '==', sem_int).stream()

        batch = db.batch()
        del_count = 0
        for s_doc in existing_slots:
            batch.delete(s_doc.reference)
            del_count += 1
            if del_count % 400 == 0:
                batch.commit()
                batch = db.batch()

        # 2. Add new generated slots
        saved_slots = []
        for s in slots:
            slot_type = s.get('type', 'lecture')
            slot_div = "ALL" if (slot_type == 'lecture' or s.get('division') == 'ALL') else str(s.get('division', '241'))
            day = s.get('day')
            period = int(s.get('period'))
            duration = int(s.get('duration', 2 if slot_type in ['lab', 'tutorial'] else 1))

            new_id = f"tt-slot-{dept.lower()}-{sem_int}-{slot_div.lower()}-{day.lower()[:3]}-{period}"
            doc_ref = db.collection('timetables').document(new_id)

            payload = {
                "department": dept,
                "semester": sem_int,
                "division": slot_div,
                "day": day,
                "period": period,
                "type": slot_type,
                "duration": duration,
                "subjectId": s.get('subjectId'),
                "facultyId": s.get('facultyId'),
                "room": s.get('room', 'N/A')
            }
            batch.set(doc_ref, payload)
            saved_slots.append(dict(payload, id=new_id))

        batch.commit()
        return jsonify({
            "success": True,
            "message": f"Successfully applied {len(saved_slots)} generated timetable slots.",
            "data": saved_slots
        }), 201

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/timetable/parse-syllabus', methods=['POST'])
@require_auth(['admin', 'hod'])
def parse_syllabus_endpoint():
    """
    Parses uploaded GTU syllabus document(s) (PDF, Excel, CSV, Text) and extracts GTU course codes,
    titles, lecture hours (L), lab hours (P), tutorial hours (T), and credits (C).
    Supports single file or multiple file uploads at once.
    """
    try:
        try:
            from syllabus_parser import parse_syllabus_file
        except ImportError:
            from backend.syllabus_parser import parse_syllabus_file

        dept = request.form.get('department') or (request.get_json() or {}).get('department') or g.current_user.get('department', 'IT')
        sem_val = request.form.get('semester') or (request.get_json() or {}).get('semester')
        try:
            sem = int(sem_val) if sem_val is not None else None
        except (ValueError, TypeError):
            sem = None

        all_subjects = []
        seen_codes = set()
        last_detected_sem = sem
        last_detected_dept = dept
        file_names = []

        # Check for multi-file upload or single file upload
        uploaded_files = request.files.getlist('files') or request.files.getlist('file')

        if uploaded_files and len(uploaded_files) > 0 and uploaded_files[0].filename:
            for f in uploaded_files:
                if not f or not f.filename:
                    continue
                file_names.append(f.filename)
                f_bytes = f.read()
                d_sem, d_dept, subs = parse_syllabus_file(
                    f_bytes, f.filename, default_sem=sem, default_dept=dept
                )
                if d_sem:
                    last_detected_sem = d_sem
                if d_dept:
                    last_detected_dept = d_dept

                for s in subs:
                    code_up = str(s.get('code', '')).upper()
                    if code_up and code_up not in seen_codes:
                        seen_codes.add(code_up)
                        all_subjects.append(s)
        else:
            json_data = request.get_json() or {}
            if 'content' in json_data:
                import base64
                content = json_data['content']
                filename = json_data.get('fileName', 'uploaded_syllabus.pdf')
                file_names.append(filename)
                try:
                    file_bytes = base64.b64decode(content)
                except Exception:
                    file_bytes = content.encode('utf-8')
                d_sem, d_dept, subs = parse_syllabus_file(
                    file_bytes, filename, default_sem=sem, default_dept=dept
                )
                if d_sem: last_detected_sem = d_sem
                if d_dept: last_detected_dept = d_dept
                all_subjects.extend(subs)
            elif 'text' in json_data:
                filename = json_data.get('fileName', 'syllabus_text.txt')
                file_names.append(filename)
                file_bytes = json_data['text'].encode('utf-8')
                d_sem, d_dept, subs = parse_syllabus_file(
                    file_bytes, filename, default_sem=sem, default_dept=dept
                )
                if d_sem: last_detected_sem = d_sem
                if d_dept: last_detected_dept = d_dept
                all_subjects.extend(subs)

        if not all_subjects:
            return jsonify({
                "success": False,
                "error": "No GTU teaching scheme could be identified in the uploaded file(s). Please verify the document is an official GTU syllabus or teaching scheme."
            }), 400

        return jsonify({
            "success": True,
            "fileName": ", ".join(file_names) if file_names else "syllabus.pdf",
            "detectedSemester": last_detected_sem or sem or 5,
            "detectedDepartment": last_detected_dept or dept or "IT",
            "totalSubjects": len(all_subjects),
            "subjects": all_subjects
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to parse syllabus file: {str(e)}"}), 500

@admin_bp.route('/timetable/import-syllabus-subjects', methods=['POST'])
@require_auth(['admin', 'hod'])
def import_syllabus_subjects():
    """
    Saves/imports confirmed syllabus subjects into Firestore subjects collection
    and associates assigned teachers.
    """
    data = request.get_json() or {}
    subjects_to_import = data.get('subjects', [])
    dept = data.get('department') or g.current_user.get('department', 'IT')
    sem_val = data.get('semester')

    if not subjects_to_import:
        return jsonify({"success": False, "error": "No subjects provided to import"}), 400

    try:
        saved_subjects = []
        batch = db.batch()
        batch_count = 0

        def to_int(val, default=0):
            try:
                return int(val)
            except (ValueError, TypeError):
                m = re.search(r'\d+', str(val or ''))
                return int(m.group(0)) if m else default

        for s in subjects_to_import:
            code = str(s.get('code', '')).strip().upper()
            name = str(s.get('name', '')).strip()
            if not code or not name:
                continue

            s_sem = to_int(s.get('semester') or sem_val, 5)
            s_dept = str(s.get('department') or dept).strip().upper()
            clean_code = re.sub(r'[^a-zA-Z0-9]', '', code).lower()
            sub_id = f"sub-{s_dept.lower()}{s_sem}-{clean_code}"
            doc_ref = db.collection('subjects').document(sub_id)

            lec_h = to_int(s.get('lectureHours') if s.get('lectureHours') is not None else s.get('lectures'), 3)
            lab_h = to_int(s.get('labHours') if s.get('labHours') is not None else s.get('practicals'), 2 if s.get('hasLab') else 0)
            tut_h = to_int(s.get('tutorialHours') if s.get('tutorialHours') is not None else s.get('tutorials'), 0)
            cred = to_int(s.get('credits'), lec_h + (lab_h // 2))

            payload = {
                "id": sub_id,
                "code": code,
                "name": name,
                "department": s_dept,
                "semester": s_sem,
                "lectureHours": lec_h,
                "labHours": lab_h,
                "tutorialHours": tut_h,
                "credits": cred,
                "facultyId": s.get('facultyId') or None
            }
            batch.set(doc_ref, payload, merge=True)
            saved_subjects.append(payload)
            batch_count += 1

            # Update assignedSubjects for faculty if assigned
            fac_id = s.get('facultyId')
            if fac_id:
                try:
                    f_ref = db.collection('users').document(fac_id)
                    f_doc = f_ref.get()
                    if f_doc.exists:
                        assigned = f_doc.to_dict().get('assignedSubjects', [])
                        if sub_id not in assigned:
                            assigned.append(sub_id)
                            f_ref.update({"assignedSubjects": assigned})
                except Exception as fe:
                    print(f"Error mapping faculty {fac_id}: {fe}")

            if batch_count % 400 == 0:
                batch.commit()
                batch = db.batch()

        if batch_count > 0:
            batch.commit()

        return jsonify({
            "success": True,
            "message": f"Successfully imported {len(saved_subjects)} subjects.",
            "totalImported": len(saved_subjects),
            "subjects": saved_subjects
        }), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ==========================================
# 5. AGGREGATE REPORTS
# ==========================================
@admin_bp.route('/reports/attendance', methods=['GET'])
@require_auth(['admin'])
def get_aggregate_reports():
    """
    Returns global statistics report breakdown.
    """
    try:
        att_logs_ref = db.collection('attendance').stream()
        total_p = 0
        total_rec = 0
        
        dept_stats = {}
        
        for doc in att_logs_ref:
            log_data = doc.to_dict()
            dept = log_data.get('department', 'GEN')
            records = log_data.get('records', [])
            
            if dept not in dept_stats:
                dept_stats[dept] = {"present": 0, "total": 0}
                
            for r in records:
                total_rec += 1
                dept_stats[dept]["total"] += 1
                if r.get('status') == 'present':
                    total_p += 1
                    dept_stats[dept]["present"] += 1
                    
        global_percentage = round((total_p / total_rec * 100), 1) if total_rec > 0 else 100.0
        
        dept_reports = []
        for d_key, metrics in dept_stats.items():
            perc = round((metrics["present"] / metrics["total"] * 100), 1) if metrics["total"] > 0 else 100.0
            dept_reports.append({
                "department": d_key,
                "percentage": perc,
                "totalRecords": metrics["total"]
            })
            
        return jsonify({
            "success": True,
            "data": {
                "overallAttendance": global_percentage,
                "departmentBreakdown": dept_reports
            }
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/analytics', methods=['GET'])
@require_auth(['admin'])
def get_admin_analytics():
    try:
        from cache_service import get_cached, set_cached, get_cached_subjects
        
        cached_analytics = get_cached('admin_analytics_summary', ttl=20)
        if cached_analytics is not None:
            return jsonify({"success": True, "data": cached_analytics}), 200

        # 1. Total students & department breakdown (project only department field)
        students_snap = list(db.collection('users').where('role', '==', 'student').select(['department']).stream())
        total_students = len(students_snap)
        
        # 2. Total faculty (faculty + HOD)
        faculty_snap = list(db.collection('users').where('role', 'in', ['faculty', 'hod']).select(['department']).stream())
        total_faculty = len(faculty_snap)
        
        # 3. Total subjects from cache
        subs_map = get_cached_subjects(db)
        total_subjects = len(subs_map)
        
        # 4. Stream-wise / Department breakdowns and global stats
        depts = ['IT', 'CE', 'ME', 'CH', 'EE']
        
        dept_student_counts = {d: 0 for d in depts}
        for doc in students_snap:
            s_data = doc.to_dict()
            d = s_data.get('department')
            if d in dept_student_counts:
                dept_student_counts[d] += 1
                
        global_present = 0
        global_total = 0
        
        dept_present = {d: 0 for d in depts}
        dept_total = {d: 0 for d in depts}
        
        # Retrieve today's attendance logs (or fallback to recent sessions if none taken today yet)
        now_ist = datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)
        today_date_str = now_ist.strftime("%Y-%m-%d")
        
        attendance_snap = list(db.collection('attendance').where('date', '==', today_date_str).stream())
        if not attendance_snap:
            attendance_snap = list(db.collection('attendance').limit(15).stream())

        for doc in attendance_snap:
            att = doc.to_dict()
            d = att.get('department')
            records = att.get('records', [])
            
            for r in records:
                status = r.get('status')
                if status in ['present', 'absent', 'leave']:
                    global_total += 1
                    if d in depts:
                        dept_total[d] += 1
                    if status == 'present':
                        global_present += 1
                        if d in depts:
                            dept_present[d] += 1
                            
        average_attendance_today = round((global_present / global_total * 100), 1) if global_total > 0 else 100.0
        
        dept_breakdown = []
        for d in depts:
            dept_avg = round((dept_present[d] / dept_total[d] * 100), 1) if dept_total[d] > 0 else 100.0
            dept_breakdown.append({
                "department": d,
                "studentCount": dept_student_counts[d],
                "averageAttendance": dept_avg
            })
            
        data_result = {
            "totalStudents": total_students,
            "totalFaculty": total_faculty,
            "totalSubjects": total_subjects,
            "averageAttendanceToday": average_attendance_today,
            "deptBreakdown": dept_breakdown
        }
        set_cached('admin_analytics_summary', data_result)
        return jsonify({"success": True, "data": data_result}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/attendance-logs', methods=['GET'])
@require_auth(['admin'])
def get_admin_attendance_logs():
    """
    Returns all attendance logs.
    """
    try:
        logs_ref = db.collection('attendance').stream()
        
        results = []
        for doc in logs_ref:
            log = doc.to_dict()
            sub_id = log.get('subjectId')
            faculty_id = log.get('facultyId')
            
            # Get Subject Metadata details
            sub_snap = db.collection('subjects').document(sub_id).get()
            sub_info = sub_snap.to_dict() if sub_snap.exists else {"name": "Unknown", "code": ""}
            
            # Get Faculty Metadata details
            fac_snap = db.collection('users').document(faculty_id).get()
            fac_info = fac_snap.to_dict() if fac_snap.exists else {"name": "Unknown"}
            
            records = log.get('records', [])
            total_count = len(records)
            present_count = len([r for r in records if r.get('status') == 'present'])
            
            # Reconstruct roster dict map
            roster_map = {r.get('studentId'): r.get('status') for r in records}
            
            results.append({
                "id": doc.id,
                "timetableId": log.get('timetableId'),
                "date": log.get('date'),
                "period": log.get('period'),
                "semester": log.get('semester'),
                "division": log.get('division'),
                "subjectName": sub_info.get('name'),
                "subjectCode": sub_info.get('code'),
                "facultyName": fac_info.get('name'),
                "department": log.get('department', 'GEN'),
                "presentCount": present_count,
                "totalCount": total_count,
                "canEdit": True,
                "roster": roster_map
            })
            
        # Sort logs by descending date
        results.sort(key=lambda x: x.get('date', ''), reverse=True)
        return jsonify({"success": True, "data": results}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@admin_bp.route('/semester-config', methods=['GET', 'POST'])
@require_auth(['admin', 'hod', 'faculty', 'student'])
def process_semester_config():
    if request.method == 'GET':
        try:
            configs_ref = db.collection('semester_config').stream()
            configs = {doc.id: doc.to_dict().get('batches', 2) for doc in configs_ref}
            # Fill defaults if empty
            for i in range(1, 7):
                if str(i) not in configs:
                    configs[str(i)] = 2
            return jsonify({"success": True, "data": configs}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
            
    elif request.method == 'POST':
        if g.current_user.get('role') not in ['admin', 'hod']:
            return jsonify({"success": False, "error": "Forbidden"}), 403
            
        data = request.get_json() or {}
        sem = str(data.get('semester'))
        batches = int(data.get('batches', 2))
        
        try:
            db.collection('semester_config').document(sem).set({"batches": batches})
            return jsonify({"success": True, "message": "Updated semester config successfully"}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
