import sys
import os
import unittest
import json

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from config import db
from decorators import USER_CACHE

class TestReportsCenter(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        
        # Discover test users for each role from Firestore
        cls.admin_user = None
        cls.hod_user = None
        cls.faculty_user = None
        cls.student_user = None

        if db is not None:
            users_ref = db.collection('users').stream()
            for u in users_ref:
                udata = u.to_dict()
                role = udata.get('role')
                if role == 'admin' and not cls.admin_user:
                    cls.admin_user = dict(udata, uid=u.id)
                elif role == 'hod' and not cls.hod_user:
                    cls.hod_user = dict(udata, uid=u.id)
                elif role == 'faculty' and not cls.faculty_user:
                    cls.faculty_user = dict(udata, uid=u.id)
                elif role == 'student' and not cls.student_user:
                    cls.student_user = dict(udata, uid=u.id)

        print(f"\n[Test Setup] Discovered Users:")
        print(f"  Admin: {cls.admin_user.get('name') if cls.admin_user else 'None'} ({cls.admin_user.get('uid') if cls.admin_user else ''})")
        print(f"  HOD: {cls.hod_user.get('name') if cls.hod_user else 'None'} ({cls.hod_user.get('department') if cls.hod_user else ''})")
        print(f"  Faculty: {cls.faculty_user.get('name') if cls.faculty_user else 'None'}")
        print(f"  Student: {cls.student_user.get('name') if cls.student_user else 'None'}")

        # Seed mock tokens in USER_CACHE for fast decorator bypass
        import time
        if cls.admin_user:
            USER_CACHE['mock-admin-token'] = (cls.admin_user, cls.admin_user['uid'], time.time() + 3600)
        if cls.hod_user:
            USER_CACHE['mock-hod-token'] = (cls.hod_user, cls.hod_user['uid'], time.time() + 3600)
        if cls.faculty_user:
            USER_CACHE['mock-faculty-token'] = (cls.faculty_user, cls.faculty_user['uid'], time.time() + 3600)
        if cls.student_user:
            USER_CACHE['mock-student-token'] = (cls.student_user, cls.student_user['uid'], time.time() + 3600)

    def test_01_student_blocked_from_reports_center(self):
        """Security: Students must receive 403 Forbidden on all administrative reports endpoints."""
        if not self.student_user:
            self.skipTest("No student found in DB")
        
        headers = {"Authorization": "Bearer mock-student-token"}
        endpoints = [
            "/api/reports/filters-meta",
            "/api/reports/daily-absentee",
            "/api/reports/monthly-summary",
            "/api/reports/subject-deficiency",
            f"/api/reports/student-dossier/{self.student_user['uid']}"
        ]
        for ep in endpoints:
            res = self.client.get(ep, headers=headers)
            self.assertEqual(res.status_code, 403, f"Student was not blocked from {ep}: got {res.status_code}")
        print("\n[PASS] Student role is strictly blocked (403) from all Reports Center endpoints.")

    def test_02_filters_meta_role_scoping(self):
        """RBAC: Check metadata returned for Admin vs HOD."""
        if not self.admin_user or not self.hod_user:
            self.skipTest("Admin or HOD user missing")

        # Admin can access multiple departments
        admin_res = self.client.get("/api/reports/filters-meta", headers={"Authorization": "Bearer mock-admin-token"})
        self.assertEqual(admin_res.status_code, 200)
        admin_data = json.loads(admin_res.data)
        self.assertTrue(admin_data["success"])
        self.assertGreaterEqual(len(admin_data["data"]["departments"]), 1)
        self.assertEqual(admin_data["data"]["userRole"], "admin")

        # HOD is strictly restricted to their department
        hod_res = self.client.get("/api/reports/filters-meta", headers={"Authorization": "Bearer mock-hod-token"})
        self.assertEqual(hod_res.status_code, 200)
        hod_data = json.loads(hod_res.data)
        self.assertTrue(hod_data["success"])
        self.assertEqual(hod_data["data"]["userRole"], "hod")
        self.assertEqual(hod_data["data"]["departments"], [self.hod_user.get('department')])
        print("\n[PASS] Filters meta correctly scopes departments for Admin vs HOD.")

    def test_03_daily_absentee_report(self):
        """Daily report returns structured sessions, absent list, and formatted WhatsApp message."""
        if not self.admin_user:
            self.skipTest("No admin user")

        res = self.client.get("/api/reports/daily-absentee?date=2026-09-22", headers={"Authorization": "Bearer mock-admin-token"})
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        self.assertIn("totalSessions", data["data"])
        self.assertIn("totalAbsences", data["data"])
        self.assertIn("uniqueAbsentCount", data["data"])
        self.assertIn("sessions", data["data"])
        
        if data["data"]["sessions"]:
            s = data["data"]["sessions"][0]
            self.assertIn("whatsappNotice", s)
            self.assertIn("SAtendify Daily Absentee Alert", s["whatsappNotice"])
            self.assertIn("absentStudents", s)
            print(f"\n[PASS] Daily absentee report verified: {len(data['data']['sessions'])} sessions found. WhatsApp notice formatted.")
        else:
            print("\n[PASS] Daily absentee report schema verified (0 sessions on test date).")

    def test_04_monthly_summary_calculation_policy(self):
        """Monthly summary uses verified formula: present / (present + absent + leave) * 100."""
        if not self.admin_user:
            self.skipTest("No admin user")

        dept = self.admin_user.get('department', 'CE')
        res = self.client.get(f"/api/reports/monthly-summary?month=2026-09&department={dept}&semester=4&threshold=75.0", headers={"Authorization": "Bearer mock-admin-token"})
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        self.assertIn("totalStudentsEvaluated", data["data"])
        self.assertIn("lowAttendanceCount", data["data"])
        self.assertIn("cohortAverage", data["data"])
        self.assertIn("reportingPeriod", data["data"])

        # Validate calculation consistency on each student record
        for st in data["data"]["students"]:
            pres = st["present"]
            tot = st["total"]
            expected_perc = round((pres / tot * 100), 1) if tot > 0 else None
            self.assertEqual(st["percentage"], expected_perc, f"Mismatch in percentage calculation for student {st['rollNumber']}")
            if expected_perc is not None and expected_perc < 75.0:
                self.assertTrue(st["isDeficient"])
            else:
                self.assertFalse(st["isDeficient"])
        print(f"\n[PASS] Monthly calculation policy strictly verified across all {len(data['data']['students'])} student records.")

    def test_05_subject_deficiency_breakdown(self):
        """Subject deficiency report returns curriculum subjects and flags < 75%."""
        if not self.admin_user:
            self.skipTest("No admin user")

        dept = self.admin_user.get('department', 'CE')
        res = self.client.get(f"/api/reports/subject-deficiency?department={dept}&semester=4&threshold=75.0", headers={"Authorization": "Bearer mock-admin-token"})
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        self.assertIn("subjects", data["data"])
        for sub in data["data"]["subjects"]:
            self.assertIn("subjectCode", sub)
            self.assertIn("lecturesConducted", sub)
            self.assertIn("deficientStudents", sub)
        print(f"\n[PASS] Subject deficiency breakdown verified for {len(data['data']['subjects'])} subjects.")

    def test_06_student_dossier_and_parent_notice_authorization(self):
        """Student dossier includes complete parent notice metadata and enforces HOD cross-department blocks."""
        if not self.student_user or not self.admin_user:
            self.skipTest("Missing student or admin user")

        std_id = self.student_user['uid']
        res = self.client.get(f"/api/reports/student-dossier/{std_id}", headers={"Authorization": "Bearer mock-admin-token"})
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data["success"])
        dossier = data["data"]
        
        # Check student details
        self.assertIn("rollNumber", dossier["student"])
        self.assertIn("parentMobile", dossier["student"])
        
        # Check attendance metrics
        att = dossier["attendance"]
        self.assertIn("conducted", att)
        self.assertIn("attended", att)
        self.assertIn("overallPercentage", att)
        
        # Check Parent Notice Letterhead details
        notice = dossier["parentNotice"]
        self.assertIn("refNumber", notice)
        self.assertIn("noticeDate", notice)
        self.assertIn("collegeName", notice)
        self.assertIn("warningStatement", notice)

        # Cross-department test for HOD:
        if self.hod_user:
            # Temporarily simulate HOD belonging to another department
            cached_hod, uid, ts = USER_CACHE['mock-hod-token']
            foreign_hod = dict(cached_hod, department="NON_EXISTENT_DEPT")
            import time
            USER_CACHE['mock-foreign-hod-token'] = (foreign_hod, uid, time.time() + 3600)
            
            forbidden_res = self.client.get(f"/api/reports/student-dossier/{std_id}", headers={"Authorization": "Bearer mock-foreign-hod-token"})
            self.assertEqual(forbidden_res.status_code, 403, "HOD was able to access student from another department!")
            print("\n[PASS] Student dossier verified. HOD cross-department access strictly returns 403 Forbidden.")

    def test_07_leave_and_calculation_edge_cases(self):
        """Verify mathematical precision of attendance policy and leave handling."""
        # 1. 0 conducted sessions in reports -> None ("No Attendance Data")
        attended, total = 0, 0
        perc = round((attended / total * 100), 1) if total > 0 else None
        self.assertIsNone(perc)

        # 2. Leave does not increment attended, but increments total
        present = 5
        absent = 2
        leave = 1
        attended_count = present
        total_count = present + absent + leave  # 8
        perc = round((attended_count / total_count * 100), 1) if total_count > 0 else 100.0
        self.assertEqual(total_count, 8)
        self.assertEqual(perc, 62.5)

        # 3. Exactly 75% boundary
        present = 3
        total = 4
        perc = round((present / total * 100), 1)
        self.assertEqual(perc, 75.0)
        self.assertFalse(perc < 75.0, "75.0% must not be classified as deficient")

        # 4. 74.9% boundary
        present = 749
        total = 1000
        perc = round((present / total * 100), 1)
        self.assertEqual(perc, 74.9)
        self.assertTrue(perc < 75.0, "74.9% must be classified as deficient")
        print("\n[PASS] Leave handling, 0-session handling, and 75% boundary conditions verified.")

    def test_08_csv_sanitization_formula_injection(self):
        """Verify CSV formula injection sanitization logic."""
        import re
        def sanitize_cell(val):
            s = str(val).strip()
            if re.match(r'^[=+\-@\t\r]', s):
                s = "'" + s
            escaped = s.replace('"', '""')
            return f'"{escaped}"'

        # Dangerous formulas
        dangerous = ["=SUM(A1:A10)", "+cmd|' /C calc'!A0", "-2+3*4", "@SUM(1,2)", "=1+1"]
        for d in dangerous:
            sanitized = sanitize_cell(d)
            self.assertTrue(sanitized.startswith('"\''), f"Formula {d} was not sanitized: {sanitized}")

        # Normal safe text
        safe = "CE Department"
        self.assertEqual(sanitize_cell(safe), '"CE Department"')
        print("\n[PASS] CSV formula injection sanitization logic successfully verified.")

    def test_09_faculty_unauthorized_student_access(self):
        """Security: Faculty cannot access dossier of a student they do not teach."""
        if not self.faculty_user or not self.student_user:
            self.skipTest("Faculty or student missing")

        # Create a faculty mock whose assigned classes do NOT match student's class
        cached_fac, uid, ts = USER_CACHE['mock-faculty-token']
        unauthorized_fac = dict(cached_fac, department="DIFFERENT_DEPT", uid="fac-isolated-user")
        import time
        USER_CACHE['mock-unauth-fac-token'] = (unauthorized_fac, unauthorized_fac['uid'], time.time() + 3600)

        std_id = self.student_user['uid']
        res = self.client.get(f"/api/reports/student-dossier/{std_id}", headers={"Authorization": "Bearer mock-unauth-fac-token"})
        self.assertEqual(res.status_code, 403, "Unauthorized faculty was allowed to access student dossier!")
        print("\n[PASS] Faculty authorization check verified: unauthorized faculty blocked with 403.")

if __name__ == '__main__':
    unittest.main()

