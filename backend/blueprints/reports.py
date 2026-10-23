import datetime
import calendar
from flask import Blueprint, request, jsonify, g
from firebase_admin import firestore
from config import db
from decorators import require_auth
from cache_service import get_cached_subjects, get_cached_faculty_names

reports_bp = Blueprint('reports', __name__)

def get_ist_now():
    """Helper to return current Indian Standard Time (UTC+5:30)"""
    return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=5, minutes=30)

def safe_int(val, default=None):
    if val is None or val == '':
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default

def safe_float(val, default=75.0):
    if val is None or val == '':
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def check_faculty_student_authorization(faculty_uid, student_data, db_instance):
    """
    Verifies if a faculty member has legitimate academic authority to view a student's dossier.
    Faculty is authorized if they teach the student's department/semester/division or assigned subject.
    """
    s_dept = student_data.get('department')
    s_sem = student_data.get('semester')
    s_div = student_data.get('division')
    
    try:
        sem_int = int(s_sem)
    except (ValueError, TypeError):
        sem_int = s_sem

    # 1. Check faculty's timetable slots
    slots = db_instance.collection('timetables')\
                       .where('facultyId', '==', faculty_uid)\
                       .where('department', '==', s_dept)\
                       .where('semester', '==', sem_int).get()
    for s in slots:
        slot_div = s.to_dict().get('division')
        slot_type = s.to_dict().get('type', 'lecture')
        if slot_type == 'lecture' or slot_div == 'ALL' or str(slot_div) == str(s_div):
            return True

    # 2. Check active proxy assignments for this faculty
    proxies = db_instance.collection('proxy_assignments')\
                         .where('proxyFacultyId', '==', faculty_uid)\
                         .where('department', '==', s_dept)\
                         .where('semester', '==', sem_int)\
                         .where('status', 'in', ['active', 'approved']).get()
    for p in proxies:
        p_div = p.to_dict().get('division')
        p_type = p.to_dict().get('type', 'lecture')
        if p_type == 'lecture' or p_div == 'ALL' or str(p_div) == str(s_div):
            return True

    # 3. Check if faculty directly teaches any subject for student's semester & department
    fac_subs = db_instance.collection('subjects')\
                          .where('facultyId', '==', faculty_uid)\
                          .where('department', '==', s_dept)\
                          .where('semester', '==', sem_int).get()
    if len(fac_subs) > 0:
        return True

    return False


# =========================================================================
# 1. FILTERS METADATA (Scoped by Role)
# =========================================================================
@reports_bp.route('/filters-meta', methods=['GET'])
@require_auth(['admin', 'hod', 'faculty'])
def get_reports_filters_meta():
    """
    Returns accessible departments, semesters, subjects, and divisions
    strictly filtered by the requesting user's role and authorization.
    """
    user_role = g.current_user.get('role')
    user_dept = g.current_user.get('department')
    user_uid = g.current_user.get('uid')

    try:
        subs_dict = get_cached_subjects(db)
        fac_names = get_cached_faculty_names(db)

        # 1. Departments
        if user_role == 'admin':
            # Admin can view all departments in curriculum
            dept_docs = db.collection('departments').stream()
            departments = [d.id for d in dept_docs]
            if not departments:
                departments = ['CE', 'IT', 'CSE', 'EC', 'ME', 'CL']
        else:
            # HOD and Faculty are strictly locked to their own department
            departments = [user_dept] if user_dept else ['CE']

        # 2. Subjects & Semesters
        subjects = []
        accessible_semesters = set()

        if user_role == 'admin':
            for sid, sdata in subs_dict.items():
                s_dept = sdata.get('department')
                s_sem = sdata.get('semester')
                if s_sem:
                    accessible_semesters.add(s_sem)
                subjects.append({
                    "id": sid,
                    "code": sdata.get('code', ''),
                    "name": sdata.get('name', 'Unknown Subject'),
                    "department": s_dept,
                    "semester": s_sem,
                    "facultyId": sdata.get('facultyId'),
                    "facultyName": fac_names.get(sdata.get('facultyId'), 'Assigned Professor')
                })
        elif user_role == 'hod':
            for sid, sdata in subs_dict.items():
                s_dept = sdata.get('department')
                s_sem = sdata.get('semester')
                if s_dept == user_dept:
                    if s_sem:
                        accessible_semesters.add(s_sem)
                    subjects.append({
                        "id": sid,
                        "code": sdata.get('code', ''),
                        "name": sdata.get('name', 'Unknown Subject'),
                        "department": s_dept,
                        "semester": s_sem,
                        "facultyId": sdata.get('facultyId'),
                        "facultyName": fac_names.get(sdata.get('facultyId'), 'Assigned Professor')
                    })
        else:  # Faculty
            # Query timetable slots and subjects assigned to this faculty
            tt_slots = db.collection('timetables').where('facultyId', '==', user_uid).get()
            fac_sub_ids = set()
            for s in tt_slots:
                sd = s.to_dict()
                if sd.get('subjectId'):
                    fac_sub_ids.add(sd.get('subjectId'))
                if sd.get('semester'):
                    accessible_semesters.add(sd.get('semester'))

            # Also check direct facultyId on subjects
            for sid, sdata in subs_dict.items():
                if sdata.get('facultyId') == user_uid or sid in fac_sub_ids:
                    s_sem = sdata.get('semester')
                    if s_sem:
                        accessible_semesters.add(s_sem)
                    subjects.append({
                        "id": sid,
                        "code": sdata.get('code', ''),
                        "name": sdata.get('name', 'Unknown Subject'),
                        "department": sdata.get('department', user_dept),
                        "semester": s_sem,
                        "facultyId": user_uid,
                        "facultyName": g.current_user.get('name', 'Faculty')
                    })

        sem_list = sorted(list(accessible_semesters)) if accessible_semesters else [1, 2, 3, 4, 5, 6]

        # 3. Divisions
        divisions = ['ALL', '241', '242', '251', '252', 'Batch 1', 'Batch 2']

        return jsonify({
            "success": True,
            "data": {
                "userRole": user_role,
                "userDepartment": user_dept,
                "departments": sorted(departments),
                "semesters": sem_list,
                "divisions": divisions,
                "subjects": subjects
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =========================================================================
# 2. DAILY LECTURE-WISE ABSENTEE REPORT
# =========================================================================
@reports_bp.route('/daily-absentee', methods=['GET'])
@require_auth(['admin', 'hod', 'faculty'])
def get_daily_absentee_report():
    """
    Returns lecture-by-lecture absentee breakdown for a specific date,
    including student roster, parent contact info, and pre-formatted WhatsApp notices.
    """
    user_role = g.current_user.get('role')
    user_dept = g.current_user.get('department')
    user_uid = g.current_user.get('uid')

    date_str = request.args.get('date')
    if not date_str:
        date_str = get_ist_now().strftime("%Y-%m-%d")

    req_dept = request.args.get('department')
    req_sem = safe_int(request.args.get('semester'))
    req_div = request.args.get('division')
    req_sub_id = request.args.get('subjectId')

    # Security enforcement
    effective_dept = user_dept if user_role in ['hod', 'faculty'] else (req_dept or None)

    try:
        query = db.collection('attendance').where('date', '==', date_str)
        if effective_dept:
            query = query.where('department', '==', effective_dept)

        att_docs = list(query.stream())

        subs_dict = get_cached_subjects(db)
        fac_names = get_cached_faculty_names(db)

        # Faculty authorization filter: restrict to classes/subjects taught by faculty
        if user_role == 'faculty':
            att_docs = [
                d for d in att_docs 
                if d.to_dict().get('facultyId') == user_uid or d.to_dict().get('conductedByProxyId') == user_uid
            ]

        # In-memory cohort filters
        filtered_docs = []
        for d in att_docs:
            d_dict = d.to_dict()
            if req_sem is not None:
                d_sem = safe_int(d_dict.get('semester'))
                if d_sem != req_sem:
                    continue
            if req_div and req_div != 'ALL':
                d_div = str(d_dict.get('division', 'ALL'))
                if d_div != 'ALL' and d_div != req_div:
                    continue
            if req_sub_id:
                if d_dict.get('subjectId') != req_sub_id:
                    continue
            filtered_docs.append((d.id, d_dict))

        # Collect all student IDs across these sessions for single-batch user lookup
        all_student_ids = set()
        for _, d_dict in filtered_docs:
            for r in d_dict.get('records', []):
                sid = r.get('studentId')
                if sid:
                    all_student_ids.add(sid)

        # Batch fetch student documents (NO N+1 reads)
        std_refs = [db.collection('users').document(s) for s in all_student_ids]
        std_docs_map = {doc.id: doc.to_dict() for doc in db.get_all(std_refs) if doc.exists} if std_refs else {}

        sessions_list = []
        unique_absent_students = set()
        total_session_absences = 0
        total_sessions_conducted = len(filtered_docs)

        # Sort sessions by period
        filtered_docs.sort(key=lambda x: safe_int(x[1].get('period'), 0))

        for doc_id, att_data in filtered_docs:
            sub_id = att_data.get('subjectId')
            sub_info = subs_dict.get(sub_id, {"name": "General Subject", "code": ""})
            faculty_id = att_data.get('conductedByProxyId') or att_data.get('facultyId')
            faculty_name = fac_names.get(faculty_id, "Assigned Professor")

            records = att_data.get('records', [])
            period_num = att_data.get('period', 1)
            slot_type = att_data.get('type', 'lecture')
            div_val = att_data.get('division', 'ALL')
            display_div = "Whole Class" if (slot_type != 'lab' or div_val == 'ALL') else f"Batch {div_val}"

            absent_list = []
            present_count = 0
            leave_count = 0

            for r in records:
                std_id = r.get('studentId')
                status = r.get('status')
                sdata = std_docs_map.get(std_id, {})
                roll = sdata.get('rollNumber', 'N/A')
                name = sdata.get('name', 'Student')
                mobile = sdata.get('mobile') or sdata.get('phone') or sdata.get('parentMobile') or 'N/A'

                if status == 'absent':
                    absent_list.append({
                        "studentId": std_id,
                        "rollNumber": roll,
                        "name": name,
                        "mobile": mobile
                    })
                    unique_absent_students.add(std_id)
                    total_session_absences += 1
                elif status == 'present':
                    present_count += 1
                elif status == 'leave':
                    leave_count += 1

            # Sort absent students by roll number
            absent_list.sort(key=lambda x: str(x['rollNumber']))

            # Generate structured plain-text WhatsApp notice for faculty/HOD
            # Cleanly formatted, no markdown artifacts that break in plain text
            date_formatted = datetime.datetime.strptime(date_str, "%Y-%m-%d").strftime("%d/%m/%Y")
            dept_name = att_data.get('department', 'CE')
            sem_name = att_data.get('semester', '4')

            wa_lines = [
                f"*SAtendify Daily Absentee Alert*",
                f"Date: {date_formatted} | Period: {period_num} ({sub_info.get('code', '')} - {sub_info.get('name', '')})",
                f"Department: {dept_name} | Sem: {sem_name} | Division: {display_div}",
                f"Faculty: {faculty_name}",
                f"----------------------------------------",
                f"Absent Students ({len(absent_list)}):"
            ]
            if absent_list:
                for idx, a in enumerate(absent_list, 1):
                    wa_lines.append(f"{idx}. Roll {a['rollNumber']} - {a['name']} (Ph: {a['mobile']})")
            else:
                wa_lines.append("Nil (100% Attendance)")

            wa_lines.append(f"----------------------------------------")
            wa_lines.append(f"Present: {present_count} | Absent: {len(absent_list)} | Leave: {leave_count}")
            wa_lines.append(f"Please report reason for absence to the department.")
            whatsapp_text = "\n".join(wa_lines)

            sessions_list.append({
                "attendanceId": doc_id,
                "period": period_num,
                "type": slot_type,
                "department": att_data.get('department'),
                "semester": att_data.get('semester'),
                "division": div_val,
                "displayDivision": display_div,
                "subjectId": sub_id,
                "subjectCode": sub_info.get('code', ''),
                "subjectName": sub_info.get('name', 'Unknown Subject'),
                "facultyId": faculty_id,
                "facultyName": faculty_name,
                "totalEnrolled": len(records),
                "presentCount": present_count,
                "absentCount": len(absent_list),
                "leaveCount": leave_count,
                "absentStudents": absent_list,
                "whatsappNotice": whatsapp_text
            })

        return jsonify({
            "success": True,
            "data": {
                "date": date_str,
                "totalSessions": total_sessions_conducted,
                "totalAbsences": total_session_absences,
                "uniqueAbsentCount": len(unique_absent_students),
                "sessions": sessions_list
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =========================================================================
# 3. MONTHLY OVERALL LOW-ATTENDANCE REPORT (< 75%)
# =========================================================================
@reports_bp.route('/monthly-summary', methods=['GET'])
@require_auth(['admin', 'hod', 'faculty'])
def get_monthly_low_attendance_report():
    """
    Calculates monthly or cumulative attendance percentages across a cohort.
    Filters students below minimum threshold (default 75%), sorted lowest first.
    Reuses existing calculation formula: present / (present + absent + leave) * 100.
    """
    user_role = g.current_user.get('role')
    user_dept = g.current_user.get('department')
    user_uid = g.current_user.get('uid')

    month_str = request.args.get('month')  # Format: "YYYY-MM"
    now_ist = get_ist_now()
    if not month_str:
        month_str = now_ist.strftime("%Y-%m")

    req_dept = request.args.get('department')
    req_sem = safe_int(request.args.get('semester'))
    req_div = request.args.get('division')
    threshold = safe_float(request.args.get('threshold'), 75.0)
    mode = request.args.get('mode', 'monthly')  # 'monthly' or 'cumulative'

    # Security enforcement
    effective_dept = user_dept if user_role in ['hod', 'faculty'] else (req_dept or None)
    if not effective_dept:
        return jsonify({"success": False, "error": "Department parameter is required."}), 400

    try:
        # Determine calendar month date bounds
        year, month_num = map(int, month_str.split('-'))
        _, last_day = calendar.monthrange(year, month_num)
        start_date = f"{year:04d}-{month_num:02d}-01"
        end_date = f"{year:04d}-{month_num:02d}-{last_day:02d}"

        # 1. Query attendance sessions for this department
        att_query = db.collection('attendance').where('department', '==', effective_dept)
        if req_sem is not None:
            att_query = att_query.where('semester', '==', req_sem)

        att_docs = list(att_query.stream())

        # Filter by date range
        scoped_att_docs = []
        for doc in att_docs:
            data = doc.to_dict()
            doc_date = data.get('date', '')
            if mode == 'monthly':
                if start_date <= doc_date <= end_date:
                    scoped_att_docs.append(data)
            else:  # cumulative
                if doc_date <= end_date:
                    scoped_att_docs.append(data)

        # Faculty restriction: only sessions taught by this faculty member
        if user_role == 'faculty':
            scoped_att_docs = [
                d for d in scoped_att_docs 
                if d.get('facultyId') == user_uid or d.get('conductedByProxyId') == user_uid
            ]

        # 2. Query students in this cohort
        std_query = db.collection('users')\
                      .where('role', '==', 'student')\
                      .where('department', '==', effective_dept)
        if req_sem is not None:
            std_query = std_query.where('semester', '==', req_sem)
        if req_div and req_div != 'ALL':
            std_query = std_query.where('division', '==', req_div)

        students_docs = list(std_query.stream())
        students_map = {doc.id: doc.to_dict() for doc in students_docs}

        # 3. Accumulate attendance for each student
        # Student stats: {student_id: {"present": 0, "absent": 0, "leave": 0, "total": 0}}
        stats = {sid: {"present": 0, "absent": 0, "leave": 0, "total": 0} for sid in students_map}

        for att in scoped_att_docs:
            records = att.get('records', [])
            for r in records:
                sid = r.get('studentId')
                status = r.get('status')
                if sid in stats and status in ['present', 'absent', 'leave']:
                    stats[sid]["total"] += 1
                    if status == 'present':
                        stats[sid]["present"] += 1
                    elif status == 'absent':
                        stats[sid]["absent"] += 1
                    elif status == 'leave':
                        stats[sid]["leave"] += 1

        # 4. Compute percentages and categorize
        student_results = []
        low_count = 0
        total_p_sum = 0
        total_t_sum = 0

        for sid, sdata in students_map.items():
            st = stats[sid]
            attended = st["present"]
            total = st["total"]
            total_p_sum += attended
            total_t_sum += total

            if total > 0:
                percentage = round((attended / total * 100), 1)
                if percentage < 60.0:
                    cat = "critical"
                elif percentage < threshold:
                    cat = "warning"
                else:
                    cat = "satisfactory"
                is_low = (percentage < threshold)
            else:
                percentage = None
                cat = "no_data"
                is_low = False

            if is_low:
                low_count += 1

            # Format parent contact info
            parent_ph = sdata.get('parentMobile') or sdata.get('mobile') or sdata.get('phone') or 'N/A'

            student_results.append({
                "studentId": sid,
                "rollNumber": sdata.get('rollNumber', 'N/A'),
                "name": sdata.get('name', 'Student'),
                "department": sdata.get('department', effective_dept),
                "semester": sdata.get('semester', req_sem or 'N/A'),
                "division": sdata.get('division', 'N/A'),
                "mobile": sdata.get('mobile') or sdata.get('phone') or 'N/A',
                "parentMobile": parent_ph,
                "present": attended,
                "absent": st["absent"],
                "leave": st["leave"],
                "total": total,
                "percentage": percentage,
                "category": cat,
                "isDeficient": is_low
            })

        # Sort: deficient students first, then lowest percentage, then no data records
        student_results.sort(key=lambda x: (
            0 if (x["percentage"] is not None and x["isDeficient"]) else (1 if x["percentage"] is not None else 2),
            x["percentage"] if x["percentage"] is not None else 999.0,
            str(x["rollNumber"])
        ))

        cohort_avg = round((total_p_sum / total_t_sum * 100), 1) if total_t_sum > 0 else None
        month_label = datetime.datetime.strptime(month_str, "%Y-%m").strftime("%B %Y")
        reporting_period_str = f"{month_label} ({start_date} to {end_date})" if mode == 'monthly' else f"Cumulative to {end_date}"

        return jsonify({
            "success": True,
            "data": {
                "month": month_str,
                "reportingPeriod": reporting_period_str,
                "mode": mode,
                "threshold": threshold,
                "department": effective_dept,
                "semester": req_sem,
                "division": req_div or 'ALL',
                "totalStudentsEvaluated": len(student_results),
                "lowAttendanceCount": low_count,
                "cohortAverage": cohort_avg,
                "totalSessionsScoped": len(scoped_att_docs),
                "students": student_results
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =========================================================================
# 4. SUBJECT-WISE ATTENDANCE DEFICIENCY REPORT
# =========================================================================
@reports_bp.route('/subject-deficiency', methods=['GET'])
@require_auth(['admin', 'hod', 'faculty'])
def get_subject_deficiency_report():
    """
    Returns breakdown across curriculum subjects for a cohort,
    highlighting subjects where individual students fall below the 75% threshold.
    """
    user_role = g.current_user.get('role')
    user_dept = g.current_user.get('department')
    user_uid = g.current_user.get('uid')

    req_dept = request.args.get('department')
    req_sem = safe_int(request.args.get('semester'))
    req_div = request.args.get('division')
    req_sub_id = request.args.get('subjectId')
    threshold = safe_float(request.args.get('threshold'), 75.0)

    effective_dept = user_dept if user_role in ['hod', 'faculty'] else (req_dept or None)
    if not effective_dept:
        return jsonify({"success": False, "error": "Department parameter is required."}), 400

    try:
        subs_dict = get_cached_subjects(db)
        fac_names = get_cached_faculty_names(db)

        # 1. Fetch relevant subjects for this department and semester
        subject_ids = []
        for sid, sdata in subs_dict.items():
            if sdata.get('department') == effective_dept:
                if req_sem is not None and safe_int(sdata.get('semester')) != req_sem:
                    continue
                if req_sub_id and sid != req_sub_id:
                    continue
                subject_ids.append(sid)

        # If faculty, limit to subjects taught by them
        if user_role == 'faculty':
            subject_ids = [sid for sid in subject_ids if subs_dict.get(sid, {}).get('facultyId') == user_uid]

        # 2. Query attendance sessions for these subjects
        att_query = db.collection('attendance').where('department', '==', effective_dept)
        if req_sem is not None:
            att_query = att_query.where('semester', '==', req_sem)

        att_docs = list(att_query.stream())

        # 3. Query cohort students
        std_query = db.collection('users')\
                      .where('role', '==', 'student')\
                      .where('department', '==', effective_dept)
        if req_sem is not None:
            std_query = std_query.where('semester', '==', req_sem)
        if req_div and req_div != 'ALL':
            std_query = std_query.where('division', '==', req_div)

        students_docs = list(std_query.stream())
        students_map = {doc.id: doc.to_dict() for doc in students_docs}

        # Structure: {subjectId: {studentId: {"present": 0, "total": 0}}}
        sub_student_stats = {sid: {st_id: {"present": 0, "total": 0} for st_id in students_map} for sid in subject_ids}
        sub_total_lectures = {sid: 0 for sid in subject_ids}

        for doc in att_docs:
            d = doc.to_dict()
            sid = d.get('subjectId')
            if sid not in sub_student_stats:
                continue
            sub_total_lectures[sid] += 1
            records = d.get('records', [])
            for r in records:
                st_id = r.get('studentId')
                status = r.get('status')
                if st_id in sub_student_stats[sid] and status in ['present', 'absent', 'leave']:
                    sub_student_stats[sid][st_id]["total"] += 1
                    if status == 'present':
                        sub_student_stats[sid][st_id]["present"] += 1

        # 4. Build output per subject
        subject_reports = []
        for sid in subject_ids:
            sinfo = subs_dict.get(sid, {})
            fac_id = sinfo.get('facultyId')
            fac_name = fac_names.get(fac_id, "Assigned Professor")

            deficient_students = []
            all_students_in_sub = []
            sub_p_sum = 0
            sub_t_sum = 0

            for st_id, st_data in students_map.items():
                m = sub_student_stats[sid][st_id]
                p = m["present"]
                t = m["total"]
                sub_p_sum += p
                sub_t_sum += t

                if t > 0:
                    perc = round((p / t * 100), 1)
                    is_def = (perc < threshold)
                else:
                    perc = None
                    is_def = False

                entry = {
                    "studentId": st_id,
                    "rollNumber": st_data.get('rollNumber', 'N/A'),
                    "name": st_data.get('name', 'Student'),
                    "division": st_data.get('division', 'N/A'),
                    "parentMobile": st_data.get('parentMobile') or st_data.get('mobile') or 'N/A',
                    "attended": p,
                    "total": t,
                    "percentage": perc,
                    "isDeficient": is_def
                }
                all_students_in_sub.append(entry)
                if is_def:
                    deficient_students.append(entry)

            # Sort deficient students lowest first
            deficient_students.sort(key=lambda x: (x["percentage"] if x["percentage"] is not None else 999.0, str(x["rollNumber"])))

            sub_avg = round((sub_p_sum / sub_t_sum * 100), 1) if sub_t_sum > 0 else None

            subject_reports.append({
                "subjectId": sid,
                "subjectCode": sinfo.get('code', ''),
                "subjectName": sinfo.get('name', 'Unknown Subject'),
                "facultyName": fac_name,
                "semester": sinfo.get('semester'),
                "lecturesConducted": sub_total_lectures[sid],
                "totalStudents": len(all_students_in_sub),
                "deficientCount": len(deficient_students),
                "subjectAverage": sub_avg,
                "deficientStudents": deficient_students
            })

        return jsonify({
            "success": True,
            "data": {
                "department": effective_dept,
                "semester": req_sem,
                "division": req_div or 'ALL',
                "threshold": threshold,
                "subjects": subject_reports
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =========================================================================
# 5. INDIVIDUAL STUDENT DOSSIER & PARENT ACKNOWLEDGEMENT NOTICE
# =========================================================================
@reports_bp.route('/student-dossier/<student_id>', methods=['GET'])
@require_auth(['admin', 'hod', 'faculty'])
def get_student_dossier(student_id):
    """
    Returns complete cumulative and subject-wise academic attendance profile for one student.
    Strictly enforces authorization:
      - Admin: full access
      - HOD: restricted to own department
      - Faculty: restricted to students enrolled in their assigned classes/subjects.
    """
    user_role = g.current_user.get('role')
    user_dept = g.current_user.get('department')
    user_uid = g.current_user.get('uid')

    try:
        # 1. Fetch student user profile
        std_doc = db.collection('users').document(student_id).get()
        if not std_doc.exists:
            return jsonify({"success": False, "error": "Student profile not found."}), 404

        std_data = std_doc.to_dict()
        if std_data.get('role') != 'student':
            return jsonify({"success": False, "error": "Specified ID does not belong to a student."}), 400

        # Security check
        if user_role == 'hod' and std_data.get('department') != user_dept:
            return jsonify({"success": False, "error": "Forbidden: Student belongs to another department."}), 403

        if user_role == 'faculty':
            is_authorized = check_faculty_student_authorization(user_uid, std_data, db)
            if not is_authorized:
                return jsonify({"success": False, "error": "Forbidden: You are not authorized to view this student's records."}), 403

        # 2. Fetch all attendance logs for student's department and semester
        dept = std_data.get('department')
        sem = std_data.get('semester')
        try:
            sem_int = int(sem)
        except (ValueError, TypeError):
            sem_int = sem

        subs_dict = get_cached_subjects(db)
        fac_names = get_cached_faculty_names(db)

        # Subjects for this curriculum
        student_subjects = {
            sid: sinfo for sid, sinfo in subs_dict.items()
            if sinfo.get('department') == dept and safe_int(sinfo.get('semester')) == safe_int(sem)
        }

        att_docs = db.collection('attendance')\
                     .where('department', '==', dept)\
                     .where('semester', '==', sem_int).get()

        attended_count = 0
        missed_count = 0
        leave_count = 0
        total_count = 0

        sub_stats = {sid: {"attended": 0, "total": 0} for sid in student_subjects}
        monthly_stats = {}  # { "YYYY-MM": {"attended": 0, "total": 0} }
        recent_history = []

        for doc in att_docs:
            att = doc.to_dict()
            records = att.get('records', [])
            date_val = att.get('date', '')
            sub_id = att.get('subjectId')

            # Find matching student entry
            match = next((r for r in records if r.get('studentId') == student_id), None)
            if not match:
                continue

            status = match.get('status')
            if status not in ['present', 'absent', 'leave']:
                continue

            total_count += 1
            if status == 'present':
                attended_count += 1
            elif status == 'absent':
                missed_count += 1
            elif status == 'leave':
                leave_count += 1

            # Subject breakdown
            if sub_id in sub_stats:
                sub_stats[sub_id]["total"] += 1
                if status == 'present':
                    sub_stats[sub_id]["attended"] += 1

            # Monthly breakdown
            if date_val and len(date_val) >= 7:
                m_key = date_val[:7]
                if m_key not in monthly_stats:
                    monthly_stats[m_key] = {"attended": 0, "total": 0}
                monthly_stats[m_key]["total"] += 1
                if status == 'present':
                    monthly_stats[m_key]["attended"] += 1

            # Recent history item
            sub_info = subs_dict.get(sub_id, {})
            recent_history.append({
                "date": date_val,
                "period": att.get('period'),
                "subjectCode": sub_info.get('code', ''),
                "subjectName": sub_info.get('name', 'Unknown'),
                "status": status
            })

        # Sort history newest first, take last 15
        recent_history.sort(key=lambda x: (x.get('date', ''), x.get('period', 0)), reverse=True)
        recent_history = recent_history[:15]

        # Calculate overall percentage (None if 0 sessions conducted to avoid false 100% inflation)
        overall_perc = round((attended_count / total_count * 100), 1) if total_count > 0 else None

        # Format Subject Breakdown
        subject_breakdown = []
        for sid, meta in sub_stats.items():
            sinfo = student_subjects[sid]
            fac_id = sinfo.get('facultyId')
            fac_name = fac_names.get(fac_id, "Assigned Professor")
            
            if meta["total"] > 0:
                p = round((meta["attended"] / meta["total"] * 100), 1)
                cat = "critical" if p < 60.0 else ("warning" if p < 75.0 else "satisfactory")
                is_sub_def = (p < 75.0)
            else:
                p = None
                cat = "no_data"
                is_sub_def = False

            subject_breakdown.append({
                "subjectId": sid,
                "code": sinfo.get('code', ''),
                "name": sinfo.get('name', 'Subject'),
                "facultyName": fac_name,
                "attended": meta["attended"],
                "total": meta["total"],
                "percentage": p,
                "category": cat,
                "isDeficient": is_sub_def
            })

        # Sort subjects by code
        subject_breakdown.sort(key=lambda x: x["code"])

        # Format monthly trend
        monthly_trend = []
        for m_key in sorted(monthly_stats.keys()):
            m_data = monthly_stats[m_key]
            m_perc = round((m_data["attended"] / m_data["total"] * 100), 1) if m_data["total"] > 0 else None
            month_label = datetime.datetime.strptime(m_key, "%Y-%m").strftime("%b %Y")
            monthly_trend.append({
                "monthKey": m_key,
                "monthLabel": month_label,
                "attended": m_data["attended"],
                "total": m_data["total"],
                "percentage": m_perc
            })

        # Format Parent Notice Metadata with neutral academic regulation wording
        now_ist = get_ist_now()
        notice_date = now_ist.strftime("%d-%m-%Y")
        roll_num = std_data.get('rollNumber', 'N/A')
        ref_no = f"SAT/DEF/{now_ist.year}/{roll_num}"

        attendance_summary_phrase = (
            f"Your ward currently has {overall_perc}% cumulative attendance."
            if overall_perc is not None 
            else "No attendance records have been filed for this cohort to date."
        )

        return jsonify({
            "success": True,
            "data": {
                "student": {
                    "id": student_id,
                    "name": std_data.get('name', 'Student'),
                    "rollNumber": roll_num,
                    "enrollmentNumber": std_data.get('enrollmentNumber') or roll_num,
                    "department": dept,
                    "semester": sem,
                    "division": std_data.get('division', 'N/A'),
                    "email": std_data.get('email', 'N/A'),
                    "mobile": std_data.get('mobile') or std_data.get('phone') or 'N/A',
                    "parentMobile": std_data.get('parentMobile') or std_data.get('mobile') or 'N/A'
                },
                "attendance": {
                    "conducted": total_count,
                    "attended": attended_count,
                    "absent": missed_count,
                    "leave": leave_count,
                    "overallPercentage": overall_perc,
                    "isDeficient": (overall_perc < 75.0) if overall_perc is not None else False
                },
                "subjectBreakdown": subject_breakdown,
                "monthlyTrend": monthly_trend,
                "recentHistory": recent_history,
                "parentNotice": {
                    "refNumber": ref_no,
                    "noticeDate": notice_date,
                    "collegeName": "Department of Technical Education / Institutional Academic Office",
                    "departmentName": f"Department of {dept}",
                    "minimumRequiredPercentage": 75.0,
                    "warningStatement": (
                        f"As per institutional academic regulations, a minimum of 75% overall and subject-wise "
                        f"attendance is required to remain eligible for term-end examinations. {attendance_summary_phrase}"
                    )
                }
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
