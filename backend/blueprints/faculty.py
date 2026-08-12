import datetime
from flask import Blueprint, request, jsonify, g
from firebase_admin import firestore
from config import db
from decorators import require_auth

faculty_bp = Blueprint('faculty', __name__)

CONFIG_EDIT_WINDOW_HOURS = 48  # Configure default to 48 hours

def get_ist_now():
    """Helper to retrieve current Indian Standard Time (UTC+5:30)"""
    return datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)

# ==========================================
# 1. DAILY SCHEDULE / TIMETABLE
# ==========================================
@faculty_bp.route('/timetable', methods=['GET'])
@require_auth(['faculty', 'hod'])
def get_faculty_today_timetable():
    uid = g.current_user.get('uid')
    now_ist = get_ist_now()
    today_wday = now_ist.strftime("%A")  # Monday, Tuesday, etc.
    today_date_str = now_ist.strftime("%Y-%m-%d")
    
    try:
        # 1. Query regular timetable slots for this teacher
        slots_snap = db.collection('timetables').where('facultyId', '==', uid).get()
        
        # Batch pre-fetch subjects map, today's attendance logs, and active proxies
        subs_dict = {doc.id: doc.to_dict() for doc in db.collection('subjects').stream()}
        atts_today_set = set(doc.id for doc in db.collection('attendance').where('date', '==', today_date_str).stream())
        proxies_today_list = [p.to_dict() for p in db.collection('proxy_assignments').where('date', '==', today_date_str).where('status', 'in', ['active', 'approved']).stream()]

        results = []
        for doc in slots_snap:
            slot = doc.to_dict()
            slot_id = doc.id
            is_today = (slot.get('day') == today_wday)
            
            # Retrieve Subject metadata from pre-fetched map
            sub_id = slot.get('subjectId')
            sub_info = subs_dict.get(sub_id, {"name": "Unknown", "code": ""})
            
            # Check if attendance registry was already submitted today for this slot
            att_id = f"att-{slot_id}-{today_date_str}"
            is_submitted = (att_id in atts_today_set)
            
            # Check if this slot has a proxy assigned for today
            p_match = next((p for p in proxies_today_list if p.get('timetableId') == slot_id), None)
            has_proxy = False
            proxy_info = None
            if p_match:
                has_proxy = True
                proxy_info = {
                    "proxyFacultyId": p_match.get('proxyFacultyId'),
                    "proxyFacultyName": p_match.get('proxyFacultyName'),
                    "reason": p_match.get('reason'),
                    "status": p_match.get('status', 'active')
                }
            
            results.append({
                "id": slot_id,
                "period": slot.get('period'),
                "semester": slot.get('semester'),
                "division": slot.get('division'),
                "room": slot.get('room'),
                "day": slot.get('day'),
                "type": slot.get('type', 'lecture'),
                "duration": slot.get('duration', 1),
                "isToday": is_today,
                "isSubmittedToday": is_submitted,
                "hasProxyAssigned": has_proxy,
                "proxyInfo": proxy_info,
                "subject": {
                    "id": sub_id,
                    "name": sub_info.get('name'),
                    "code": sub_info.get('code')
                }
            })
            
        # 2. Query proxy slots assigned TO this teacher for today
        assigned_proxies = db.collection('proxy_assignments')\
                             .where('proxyFacultyId', '==', uid)\
                             .where('date', '==', today_date_str)\
                             .where('status', 'in', ['active', 'approved']).get()
                             
        for pdoc in assigned_proxies:
            pdata = pdoc.to_dict()
            tt_id = pdata.get('timetableId')
            tt_snap = db.collection('timetables').document(tt_id).get()
            if not tt_snap.exists:
                continue
                
            slot = tt_snap.to_dict()
            sub_id = slot.get('subjectId')
            sub_snap = db.collection('subjects').document(sub_id).get()
            sub_info = sub_snap.to_dict() if sub_snap.exists else {"name": "Unknown", "code": ""}
            
            att_id = f"att-{tt_id}-{today_date_str}"
            att_snap = db.collection('attendance').document(att_id).get()
            is_submitted = att_snap.exists
            
            results.append({
                "id": tt_id,
                "proxyAssignmentId": pdoc.id,
                "period": slot.get('period'),
                "semester": slot.get('semester'),
                "division": slot.get('division'),
                "room": slot.get('room'),
                "day": slot.get('day'),
                "type": slot.get('type', 'lecture'),
                "duration": slot.get('duration', 1),
                "isToday": True,
                "isProxy": True,
                "originalFacultyId": pdata.get('originalFacultyId'),
                "originalFacultyName": pdata.get('originalFacultyName'),
                "reason": pdata.get('reason'),
                "isSubmittedToday": is_submitted,
                "subject": {
                    "id": sub_id,
                    "name": sub_info.get('name'),
                    "code": sub_info.get('code')
                }
            })

        return jsonify({"success": True, "data": results}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==========================================
# 2. CLASS COHORT ROSTER
# ==========================================
@faculty_bp.route('/roster/<timetable_id>', methods=['GET'])
@require_auth(['faculty', 'hod', 'admin'])
def get_timetable_roster(timetable_id):
    try:
        # 1. Fetch timetable details
        tt_snap = db.collection('timetables').document(timetable_id).get()
        if not tt_snap.exists:
            return jsonify({"success": False, "error": "Timetable slot not found"}), 404
            
        tt_data = tt_snap.to_dict()
        faculty_id = tt_data.get('facultyId')
        dept = tt_data.get('department')
        sem = tt_data.get('semester')
        div = tt_data.get('division')
        sub_id = tt_data.get('subjectId')
        
        current_uid = g.current_user.get('uid')
        current_role = g.current_user.get('role')
        
        # Check if user is active proxy for this timetable slot
        is_proxy_user = False
        today_date_str = get_ist_now().strftime("%Y-%m-%d")
        proxy_snap = db.collection('proxy_assignments')\
                       .where('timetableId', '==', timetable_id)\
                       .where('proxyFacultyId', '==', current_uid)\
                       .where('status', '==', 'active').get()
                       
        if len(proxy_snap) > 0:
            is_proxy_user = True

        # Guard - ensure faculty owns this slot or is active proxy or is HOD/Admin
        if current_role == 'faculty' and faculty_id != current_uid and not is_proxy_user:
            return jsonify({"success": False, "error": "Access forbidden: you do not teach this lecture slot."}), 403
            
        if current_role == 'hod' and dept != g.current_user.get('department'):
            return jsonify({"success": False, "error": "Access forbidden: timetable slot belongs to another department."}), 403
            
        # 2. Get subject metadata
        sub_snap = db.collection('subjects').document(sub_id).get()
        sub_data = sub_snap.to_dict() if sub_snap.exists else {"name": "Unknown", "code": ""}
        
        # 3. Query all students enrolled in this department/semester/division
        students_ref = db.collection('users')\
                         .where('role', '==', 'student')\
                         .where('department', '==', dept)\
                         .where('semester', '==', sem)\
                         .where('division', '==', div).stream()
                         
        students_list = []
        for doc in students_ref:
            s_data = doc.to_dict()
            students_list.append({
                "id": doc.id,
                "name": s_data.get('name'),
                "rollNumber": s_data.get('rollNumber'),
                "email": s_data.get('email')
            })
            
        # Sort students alphabetically by roll number
        students_list.sort(key=lambda s: s.get('rollNumber', ''))
        
        data_payload = {
            "timetableCell": {
                "id": timetable_id,
                "semester": sem,
                "division": div,
                "room": tt_data.get('room'),
                "isProxy": is_proxy_user,
                "subject": {
                    "id": sub_id,
                    "name": sub_data.get('name'),
                    "code": sub_data.get('code')
                }
            },
            "roster": students_list
        }
        
        return jsonify({"success": True, "data": data_payload}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==========================================
# 3. RECORD / WRITE ATTENDANCE (Create & Update Handler)
# ==========================================
@faculty_bp.route('/attendance', methods=['POST'])
@require_auth(['faculty', 'hod', 'admin'])
def save_attendance():
    """
    Handles roster marking postings. Reuses validation checks.
    """
    data = request.get_json() or {}
    timetable_id = data.get('timetableId')
    date_str = data.get('date')  # YYYY-MM-DD
    roster = data.get('roster')  # { studentId: status }
    
    if not timetable_id or not date_str or not roster:
        return jsonify({"success": False, "error": "Missing parameters (timetableId, date, roster)"}), 400
        
    try:
        # Check timetable slot validity
        tt_snap = db.collection('timetables').document(timetable_id).get()
        if not tt_snap.exists:
            return jsonify({"success": False, "error": "Invalid timetableSlot ID"}), 400
            
        tt_data = tt_snap.to_dict()
        faculty_id = tt_data.get('facultyId')
        dept = tt_data.get('department')
        sem = tt_data.get('semester')
        div = tt_data.get('division')
        sub_id = tt_data.get('subjectId')
        period = tt_data.get('period')
        
        current_uid = g.current_user.get('uid')
        current_role = g.current_user.get('role')

        # Check if current user is active proxy for this slot on this date
        proxy_snap = db.collection('proxy_assignments')\
                       .where('timetableId', '==', timetable_id)\
                       .where('date', '==', date_str)\
                       .where('proxyFacultyId', '==', current_uid)\
                       .where('status', '==', 'active').get()
        is_proxy = len(proxy_snap) > 0
        
        # Enforce Ownership Constraint
        if current_role == 'faculty' and faculty_id != current_uid and not is_proxy:
            return jsonify({"success": False, "error": "Conflict: Timetable slot not owned by you."}), 403
            
        # Enforce Department Constraint for HOD
        if current_role == 'hod' and faculty_id != current_uid and not is_proxy and dept != g.current_user.get('department'):
            return jsonify({"success": False, "error": "Access forbidden: timetable slot belongs to another department."}), 403
            
        att_id = f"att-{timetable_id}-{date_str}"
        att_ref = db.collection('attendance').document(att_id)
        att_snap = att_ref.get()
        
        now_ist = get_ist_now()
        
        if att_snap.exists:
            written_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            hours_diff = (now_ist - written_date).total_seconds() / 3600
            if hours_diff > CONFIG_EDIT_WINDOW_HOURS and current_role not in ['admin', 'hod']:
                return jsonify({
                    "success": False, 
                    "error": f"Conflict: Access blocked. Registry historical logs lock after {CONFIG_EDIT_WINDOW_HOURS} hours."
                }), 403
                
        records_payload = []
        for std_id, status in roster.items():
            if status not in ['present', 'absent', 'leave']:
                return jsonify({"success": False, "error": f"Malformed status value: '{status}' for student: {std_id}"}), 400
            records_payload.append({
                "studentId": std_id,
                "status": status
            })
            
        payload = {
            "subjectId": sub_id,
            "facultyId": faculty_id,
            "department": dept,
            "semester": sem,
            "division": div,
            "date": date_str,
            "period": period,
            "records": records_payload,
            "timetableId": timetable_id
        }
        if is_proxy:
            payload["conductedByProxyId"] = current_uid
        
        if not att_snap.exists:
            payload["createdBy"] = current_uid
            payload["createdAt"] = firestore.SERVER_TIMESTAMP
        else:
            payload["lastEditedBy"] = g.current_user.get('uid')
            payload["lastEditedAt"] = firestore.SERVER_TIMESTAMP
            
        att_ref.set(payload, merge=True)

        # Fetch subject details for report header
        sub_snap = db.collection('subjects').document(sub_id).get()
        sub_info = sub_snap.to_dict() if sub_snap.exists else {"name": "Unknown", "code": ""}

        # Compile absentee student details for automatic report generation
        absent_students = []
        leave_students = []
        present_count = 0
        absent_count = 0
        leave_count = 0

        for std_id, status in roster.items():
            if status == 'present':
                present_count += 1
            elif status == 'absent':
                absent_count += 1
                std_snap = db.collection('users').document(std_id).get()
                if std_snap.exists:
                    sdata = std_snap.to_dict()
                    absent_students.append({
                        "id": std_id,
                        "rollNumber": sdata.get('rollNumber', 'N/A'),
                        "name": sdata.get('name', 'Student'),
                        "email": sdata.get('email', 'N/A'),
                        "mobile": sdata.get('mobile') or sdata.get('phone') or 'N/A'
                    })
            elif status == 'leave':
                leave_count += 1
                std_snap = db.collection('users').document(std_id).get()
                if std_snap.exists:
                    sdata = std_snap.to_dict()
                    leave_students.append({
                        "id": std_id,
                        "rollNumber": sdata.get('rollNumber', 'N/A'),
                        "name": sdata.get('name', 'Student'),
                        "email": sdata.get('email', 'N/A'),
                        "mobile": sdata.get('mobile') or sdata.get('phone') or 'N/A'
                    })

        report_payload = {
            "attendanceId": att_id,
            "date": date_str,
            "period": period,
            "room": tt_data.get('room', 'N/A'),
            "department": dept,
            "semester": sem,
            "division": div,
            "subjectCode": sub_info.get('code'),
            "subjectName": sub_info.get('name'),
            "totalStudents": len(roster),
            "presentCount": present_count,
            "absentCount": absent_count,
            "leaveCount": leave_count,
            "absentStudents": absent_students,
            "leaveStudents": leave_students,
            "generatedAt": now_ist.strftime("%Y-%m-%d %H:%M:%S IST")
        }

        return jsonify({
            "success": True,
            "message": "Attendance record filed successfully.",
            "report": report_payload
        }), 201
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@faculty_bp.route('/attendance-report/<att_id>', methods=['GET'])
@require_auth(['faculty', 'hod', 'admin'])
def get_attendance_report(att_id):
    try:
        att_ref = db.collection('attendance').document(att_id)
        att_snap = att_ref.get()
        if not att_snap.exists:
            return jsonify({"success": False, "error": "Attendance record not found"}), 404

        att_data = att_snap.to_dict()
        sub_id = att_data.get('subjectId')
        sub_snap = db.collection('subjects').document(sub_id).get()
        sub_info = sub_snap.to_dict() if sub_snap.exists else {"name": "Unknown", "code": ""}

        tt_id = att_data.get('timetableId')
        tt_snap = db.collection('timetables').document(tt_id).get() if tt_id else None
        tt_data = tt_snap.to_dict() if tt_snap and tt_snap.exists else {}

        records = att_data.get('records', [])
        absent_students = []
        leave_students = []
        present_count = 0
        absent_count = 0
        leave_count = 0

        for r in records:
            std_id = r.get('studentId')
            status = r.get('status')
            if status == 'present':
                present_count += 1
            elif status in ['absent', 'leave']:
                std_snap = db.collection('users').document(std_id).get()
                sdata = std_snap.to_dict() if std_snap.exists else {}
                student_item = {
                    "id": std_id,
                    "rollNumber": sdata.get('rollNumber', 'N/A'),
                    "name": sdata.get('name', 'Student'),
                    "email": sdata.get('email', 'N/A'),
                    "mobile": sdata.get('mobile') or sdata.get('phone') or 'N/A'
                }
                if status == 'absent':
                    absent_count += 1
                    absent_students.append(student_item)
                else:
                    leave_count += 1
                    leave_students.append(student_item)

        report = {
            "attendanceId": att_id,
            "date": att_data.get('date'),
            "period": att_data.get('period'),
            "room": tt_data.get('room', 'N/A'),
            "department": att_data.get('department'),
            "semester": att_data.get('semester'),
            "division": att_data.get('division'),
            "subjectCode": sub_info.get('code'),
            "subjectName": sub_info.get('name'),
            "totalStudents": len(records),
            "presentCount": present_count,
            "absentCount": absent_count,
            "leaveCount": leave_count,
            "absentStudents": absent_students,
            "leaveStudents": leave_students,
            "generatedAt": get_ist_now().strftime("%Y-%m-%d %H:%M:%S IST")
        }

        return jsonify({"success": True, "data": report}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ==========================================
# 4. ATTENDANCE HISTORY
# ==========================================
@faculty_bp.route('/history', methods=['GET'])
@require_auth(['faculty', 'hod'])
def get_faculty_history():
    uid = g.current_user.get('uid')
    now_ist = get_ist_now()
    
    try:
        # Fetch entries logged by this user
        logs_snap = db.collection('attendance').where('facultyId', '==', uid).get()
        
        results = []
        for doc in logs_snap:
            log = doc.to_dict()
            sub_id = log.get('subjectId')
            
            # Get Subject Metadata details
            sub_snap = db.collection('subjects').document(sub_id).get()
            sub_info = sub_snap.to_dict() if sub_snap.exists else {"name": "Unknown", "code": ""}
            
            records = log.get('records', [])
            total_count = len(records)
            present_count = len([r for r in records if r.get('status') == 'present'])
            
            # Calculate edit lock window
            date_str = log.get('date')
            written_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            hours_diff = (now_ist - written_date).total_seconds() / 3600
            
            can_edit = (hours_diff <= CONFIG_EDIT_WINDOW_HOURS) or (g.current_user.get('role') in ['admin', 'hod'])
            
            # Reconstruct roster dict map for prefill options
            roster_map = {r.get('studentId'): r.get('status') for r in records}
            
            results.append({
                "id": doc.id,
                "timetableId": log.get('timetableId'),
                "date": date_str,
                "period": log.get('period'),
                "semester": log.get('semester'),
                "division": log.get('division'),
                "subjectName": sub_info.get('name'),
                "subjectCode": sub_info.get('code'),
                "presentCount": present_count,
                "totalCount": total_count,
                "canEdit": can_edit,
                "roster": roster_map
            })
            
        # Sort logs by descending date
        results.sort(key=lambda x: x.get('date', ''), reverse=True)
        return jsonify({"success": True, "data": results}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==========================================
# 5. EDIT LOCK METHOD (PATCH ROUTE)
# ==========================================
@faculty_bp.route('/attendance/<id>', methods=['PATCH'])
@require_auth(['faculty', 'hod', 'admin'])
def edit_faculty_attendance(id):
    """
    PATCH request to update/edit attendance roster listings directly.
    """
    data = request.get_json() or {}
    roster = data.get('roster')  # { studentId: status }
    
    if not roster:
        return jsonify({"success": False, "error": "Roster mapping is required."}), 400
        
    try:
        att_ref = db.collection('attendance').document(id)
        snap = att_ref.get()
        if not snap.exists:
            return jsonify({"success": False, "error": "Attendance record not found"}), 404
            
        log = snap.to_dict()
        faculty_id = log.get('facultyId')
        date_str = log.get('date')
        
        # Enforce Ownership Constraint
        if g.current_user.get('role') == 'faculty' and faculty_id != g.current_user.get('uid'):
            return jsonify({"success": False, "error": "Access forbidden: you do not own this attendance record."}), 403
            
        # Enforce Department Constraint for HOD
        if g.current_user.get('role') == 'hod' and log.get('department') != g.current_user.get('department'):
            return jsonify({"success": False, "error": "Access forbidden: cannot edit attendance of other departments."}), 403
            
        # Verify 48-hour time check
        now_ist = get_ist_now()
        written_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
        hours_diff = (now_ist - written_date).total_seconds() / 3600
        
        if hours_diff > CONFIG_EDIT_WINDOW_HOURS and g.current_user.get('role') not in ['admin', 'hod']:
            return jsonify({
                "success": False, 
                "error": f"Forbidden: Editing logs is locked after {CONFIG_EDIT_WINDOW_HOURS} hours."
            }), 403
            
        # Format records list
        records_payload = []
        for std_id, status in roster.items():
            records_payload.append({
                "studentId": std_id,
                "status": status
            })
            
        att_ref.update({
            "records": records_payload,
            "lastEditedBy": g.current_user.get('uid'),
            "lastEditedAt": firestore.SERVER_TIMESTAMP
        })
        
        return jsonify({"success": True, "message": "Attendance record modifications saved."}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==========================================
# 6. PROXY / SUBSTITUTE LECTURE MANAGEMENT
# ==========================================
@faculty_bp.route('/proxy-assignments', methods=['POST'])
@require_auth(['faculty', 'hod', 'admin'])
def create_proxy_assignment():
    data = request.get_json() or {}
    timetable_id = data.get('timetableId')
    date_str = data.get('date')  # YYYY-MM-DD
    proxy_faculty_id = data.get('proxyFacultyId')
    reason = data.get('reason', 'Leave Coverage')

    if not timetable_id or not date_str or not proxy_faculty_id:
        return jsonify({"success": False, "error": "Missing parameters (timetableId, date, proxyFacultyId)"}), 400

    try:
        current_uid = g.current_user.get('uid')
        current_role = g.current_user.get('role')

        # Fetch timetable slot
        tt_snap = db.collection('timetables').document(timetable_id).get()
        if not tt_snap.exists:
            return jsonify({"success": False, "error": "Timetable slot not found"}), 404

        tt_data = tt_snap.to_dict()
        original_faculty_id = tt_data.get('facultyId')
        dept = tt_data.get('department')

        # Authorization: must be original faculty, HOD, or Admin
        if current_role == 'faculty' and original_faculty_id != current_uid:
            return jsonify({"success": False, "error": "Forbidden: You can only assign proxies for your own lectures."}), 403
        if current_role == 'hod' and dept != g.current_user.get('department'):
            return jsonify({"success": False, "error": "Forbidden: Cannot assign proxy outside your department."}), 403

        # Fetch original faculty user details
        orig_fac_snap = db.collection('users').document(original_faculty_id).get()
        orig_fac_name = orig_fac_snap.to_dict().get('name', 'Faculty') if orig_fac_snap.exists else 'Faculty'

        # Fetch proxy faculty user details
        proxy_fac_snap = db.collection('users').document(proxy_faculty_id).get()
        if not proxy_fac_snap.exists:
            return jsonify({"success": False, "error": "Proxy faculty member not found"}), 404
        proxy_fac_data = proxy_fac_snap.to_dict()
        proxy_fac_name = proxy_fac_data.get('name', 'Proxy Faculty')

        # Fetch subject details
        sub_id = tt_data.get('subjectId')
        sub_snap = db.collection('subjects').document(sub_id).get()
        sub_info = sub_snap.to_dict() if sub_snap.exists else {"name": "Unknown", "code": ""}

        proxy_payload = {
            "timetableId": timetable_id,
            "date": date_str,
            "originalFacultyId": original_faculty_id,
            "originalFacultyName": orig_fac_name,
            "proxyFacultyId": proxy_faculty_id,
            "proxyFacultyName": proxy_fac_name,
            "department": dept,
            "semester": tt_data.get('semester'),
            "division": tt_data.get('division'),
            "subjectId": sub_id,
            "subjectCode": sub_info.get('code'),
            "subjectName": sub_info.get('name'),
            "period": tt_data.get('period'),
            "room": tt_data.get('room'),
            "day": tt_data.get('day'),
            "reason": reason,
            "status": "active" if current_role in ['hod', 'admin'] else "pending",
            "createdBy": current_uid,
            "createdAt": firestore.SERVER_TIMESTAMP
        }

        doc_ref = db.collection('proxy_assignments').document()
        doc_ref.set(proxy_payload)
        proxy_payload['id'] = doc_ref.id
        proxy_payload['createdAt'] = datetime.datetime.utcnow().isoformat() + 'Z'

        return jsonify({"success": True, "data": proxy_payload}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@faculty_bp.route('/proxy-assignments', methods=['GET'])
@require_auth(['faculty', 'hod', 'admin'])
def get_proxy_assignments():
    try:
        current_uid = g.current_user.get('uid')
        current_role = g.current_user.get('role')
        user_dept = g.current_user.get('department')

        proxies = []
        if current_role == 'admin':
            snap = db.collection('proxy_assignments').stream()
            for doc in snap:
                d = doc.to_dict()
                d['id'] = doc.id
                proxies.append(d)
        elif current_role == 'hod':
            snap = db.collection('proxy_assignments').where('department', '==', user_dept).stream()
            for doc in snap:
                d = doc.to_dict()
                d['id'] = doc.id
                proxies.append(d)
        else:
            snap1 = db.collection('proxy_assignments').where('originalFacultyId', '==', current_uid).stream()
            snap2 = db.collection('proxy_assignments').where('proxyFacultyId', '==', current_uid).stream()
            seen_ids = set()
            for doc in snap1:
                d = doc.to_dict()
                d['id'] = doc.id
                seen_ids.add(doc.id)
                proxies.append(d)
            for doc in snap2:
                if doc.id not in seen_ids:
                    d = doc.to_dict()
                    d['id'] = doc.id
                    proxies.append(d)

        proxies.sort(key=lambda p: p.get('date', ''), reverse=True)
        return jsonify({"success": True, "data": proxies}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@faculty_bp.route('/proxy-assignments/<id>/status', methods=['PUT'])
@require_auth(['hod', 'admin'])
def update_proxy_status(id):
    try:
        data = request.get_json() or {}
        new_status = data.get('status')
        if new_status not in ['active', 'approved', 'rejected']:
            return jsonify({"success": False, "error": "Invalid status. Must be 'approved' or 'rejected'."}), 400

        doc_ref = db.collection('proxy_assignments').document(id)
        snap = doc_ref.get()
        if not snap.exists:
            return jsonify({"success": False, "error": "Proxy record not found"}), 404

        proxy_data = snap.to_dict()
        current_role = g.current_user.get('role')
        user_dept = g.current_user.get('department')

        if current_role == 'hod' and proxy_data.get('department') != user_dept:
            return jsonify({"success": False, "error": "Forbidden: Cannot update proxy outside your department."}), 403

        status_to_save = 'active' if new_status in ['active', 'approved'] else 'rejected'
        doc_ref.update({
            "status": status_to_save,
            "approvedBy": g.current_user.get('uid'),
            "updatedAt": firestore.SERVER_TIMESTAMP
        })

        return jsonify({"success": True, "message": f"Proxy assignment status updated to {status_to_save}."}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@faculty_bp.route('/proxy-assignments/<id>', methods=['DELETE'])
@require_auth(['faculty', 'hod', 'admin'])
def delete_proxy_assignment(id):
    try:
        doc_ref = db.collection('proxy_assignments').document(id)
        snap = doc_ref.get()
        if not snap.exists:
            return jsonify({"success": False, "error": "Proxy record not found"}), 404

        data = snap.to_dict()
        current_uid = g.current_user.get('uid')
        current_role = g.current_user.get('role')

        if current_role == 'faculty' and data.get('originalFacultyId') != current_uid and data.get('createdBy') != current_uid:
            return jsonify({"success": False, "error": "Forbidden: Cannot cancel another professor's proxy."}), 403

        doc_ref.delete()
        return jsonify({"success": True, "message": "Proxy assignment revoked successfully."}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
