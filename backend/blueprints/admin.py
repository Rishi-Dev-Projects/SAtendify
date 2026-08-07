import datetime
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
            
        doc_ref.set({
            "name": name,
            "code": code,
            "department": dept,
            "semester": int(semester),
            "facultyId": data.get('facultyId', None)
        })
        return jsonify({"success": True, "data": dict(data, id=sub_id)}), 201
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
                
            doc_ref.update({
                "name": data.get('name'),
                "code": data.get('code'),
                "department": data.get('department'),
                "semester": int(data.get('semester')),
                "facultyId": data.get('facultyId')
            })
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
                "phone": data.get('phone', ''),
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
            if 'phone' in data:
                update_payload['phone'] = data['phone']
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
                    # Check 1: Teacher Conflict
                    if s.get('facultyId') == faculty_id:
                        return jsonify({
                            "success": False, 
                            "error": f"Conflict: Assigned professor is already scheduled to teach in this slot (overlapping Period {s_start} to {s_start + s_dur - 1})."
                        }), 409
                        
                    # Check 2: Room Conflict
                    if s.get('room') == room:
                        return jsonify({
                            "success": False, 
                            "error": f"Conflict: Room {room} is already booked in this slot (overlapping Period {s_start} to {s_start + s_dur - 1})."
                        }), 409
                        
                    # Check 3: Class/Division Conflict
                    if s.get('department') == dept and s.get('semester') == sem:
                        is_cand_lecture = (slot_type == 'lecture')
                        is_exist_lecture = (s.get('type', 'lecture') == 'lecture')
                        if is_cand_lecture or is_exist_lecture or s.get('division') == div:
                            return jsonify({
                                "success": False, 
                                "error": f"Conflict: Selected stream semester is already scheduled for a class/lecture in this slot (overlapping Period {s_start} to {s_start + s_dur - 1})."
                            }), 409

            # Determine target batches for this semester
            target_batches = [div]
            if slot_type == 'lecture':
                # Fetch semester batch configuration if present
                cfg_snap = db.collection('configs').document('semester_batches').get()
                cfg = cfg_snap.to_dict() if cfg_snap.exists else {}
                max_batches = int(cfg.get(str(sem), 2))
                
                enrollment_year = 2026 - (sem - 1) // 2
                year_suffix = str(enrollment_year % 100).zfill(2)
                computed_batches = [f"{year_suffix}{i}" for i in range(1, max_batches + 1)]
                for b in computed_batches:
                    if b not in target_batches:
                        target_batches.append(b)

            saved_slots = []
            for b in target_batches:
                new_id = f"tt-slot-{dept.lower()}-{sem}-{b.lower()}-{day.lower()[:3]}-{period}"
                doc_ref = db.collection('timetables').document(new_id)
                slot_payload = {
                    "department": dept,
                    "semester": sem,
                    "division": b,
                    "day": day,
                    "period": period,
                    "type": slot_type,
                    "duration": duration,
                    "subjectId": subject_id,
                    "facultyId": faculty_id,
                    "room": room
                }
                doc_ref.set(slot_payload)
                saved_slots.append(dict(slot_payload, id=new_id))

            primary_id = f"tt-slot-{dept.lower()}-{sem}-{div.lower()}-{day.lower()[:3]}-{period}"
            saved_data = dict(data, id=primary_id, type=slot_type, duration=duration)
            return jsonify({"success": True, "data": saved_data, "all_synced": saved_slots}), 201
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
        # 1. Total students
        students_snap = db.collection('users').where('role', '==', 'student').get()
        total_students = len(students_snap)
        
        # 2. Total faculty (faculty + HOD)
        faculty_snap = db.collection('users').where('role', 'in', ['faculty', 'hod']).get()
        total_faculty = len(faculty_snap)
        
        # 3. Total subjects
        subjects_snap = db.collection('subjects').get()
        total_subjects = len(subjects_snap)
        
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
        
        attendance_snap = db.collection('attendance').get()
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
            
        return jsonify({
            "success": True,
            "data": {
                "totalStudents": total_students,
                "totalFaculty": total_faculty,
                "totalSubjects": total_subjects,
                "averageAttendanceToday": average_attendance_today,
                "deptBreakdown": dept_breakdown
            }
        }), 200
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
