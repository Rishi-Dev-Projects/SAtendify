from flask import Blueprint, request, jsonify, g
from firebase_admin import firestore
from config import db
from decorators import require_auth

hod_bp = Blueprint('hod', __name__)

@hod_bp.route('/analytics', methods=['GET'])
@require_auth(['hod'])
def get_hod_analytics():
    """
    Returns analytics summary scoped to HOD's department.
    """
    dept = g.current_user.get('department')
    if not dept:
        return jsonify({"success": False, "error": "Department configuration not mapped to HOD profile"}), 400
        
    try:
        # 1. Total students inside department
        students_ref = db.collection('users')\
                         .where('role', '==', 'student')\
                         .where('department', '==', dept).stream()
        total_students = len(list(students_ref))
        
        # 2. Total faculty teachers in department
        faculty_ref = db.collection('users')\
                        .where('role', 'in', ['faculty', 'hod'])\
                        .where('department', '==', dept).stream()
        total_faculty = len(list(faculty_ref))
        
        # 3. Calculated average department attendance today
        att_logs_ref = db.collection('attendance')\
                         .where('department', '==', dept).stream()
        
        present_count = 0
        total_records = 0
        for doc in att_logs_ref:
            log = doc.to_dict()
            records = log.get('records', [])
            for r in records:
                total_records += 1
                if r.get('status') == 'present':
                    present_count += 1
                    
        avg = round((present_count / total_records * 100), 1) if total_records > 0 else 100.0
        
        return jsonify({
            "success": True,
            "data": {
                "totalStudents": total_students,
                "totalFaculty": total_faculty,
                "averageAttendanceToday": avg
            }
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@hod_bp.route('/faculty-subjects', methods=['POST'])
@require_auth(['hod'])
def allocate_faculty_subject():
    """
    Allocates subject course syllabus to faculty in their department.
    """
    dept = g.current_user.get('department')
    data = request.get_json() or {}
    faculty_id = data.get('facultyId')
    subject_id = data.get('subjectId')
    
    if not faculty_id or not subject_id:
        return jsonify({"success": False, "error": "facultyId and subjectId are required"}), 400
        
    try:
        # Check faculty belongs to department
        fac_ref = db.collection('users').document(faculty_id)
        fac_snap = fac_ref.get()
        if not fac_snap.exists:
            return jsonify({"success": False, "error": "Faculty not found"}), 404
            
        fac_data = fac_snap.to_dict()
        if fac_data.get('department') != dept:
            return jsonify({"success": False, "error": "Forbidden: cannot allocate subjects to faculty outside your department."}), 403
            
        # Check subject belongs to department
        sub_ref = db.collection('subjects').document(subject_id)
        sub_snap = sub_ref.get()
        if not sub_snap.exists:
            return jsonify({"success": False, "error": "Subject not found"}), 404
            
        sub_data = sub_snap.to_dict()
        if sub_data.get('department') != dept:
            return jsonify({"success": False, "error": "Forbidden: cannot allocate subjects outside your department."}), 403

        # Transactional update: add subject to faculty's assigned list, update subject's faculty reference
        batch = db.batch()
        
        assigned_subs = fac_data.get('assignedSubjects', [])
        if subject_id not in assigned_subs:
            assigned_subs.append(subject_id)
            batch.update(fac_ref, {"assignedSubjects": assigned_subs})
            
        batch.update(sub_ref, {"facultyId": faculty_id})
        
        batch.commit()
        return jsonify({"success": True, "message": "Course subject successfully assigned to Professor."}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@hod_bp.route('/attendance-logs', methods=['GET'])
@require_auth(['hod'])
def get_hod_attendance_logs():
    """
    Returns attendance logs scoped to HOD's department.
    """
    dept = g.current_user.get('department')
    if not dept:
        return jsonify({"success": False, "error": "Department configuration not mapped to HOD profile"}), 400
        
    try:
        logs_ref = db.collection('attendance')\
                     .where('department', '==', dept).stream()
        
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
