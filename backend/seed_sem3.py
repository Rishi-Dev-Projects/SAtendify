import datetime
from firebase_admin import firestore
from config import db, init_firebase

init_firebase()

SEM3_SUBJECTS = [
    {
        "id": "sub-it3-di03016011",
        "code": "DI03016011",
        "name": "Data Structures & Algorithms",
        "department": "IT",
        "semester": 3,
        "facultyId": "FLV24RyHPSYQZ5rWsa4V3pAmxWz2"  # Nirav Pandya
    },
    {
        "id": "sub-it3-di03016021",
        "code": "DI03016021",
        "name": "Object-Oriented Programming (Java)",
        "department": "IT",
        "semester": 3,
        "facultyId": "IuG5aTNMBbNtpRSKAo75eMn5UAm1"  # Parth Patel
    },
    {
        "id": "sub-it3-di03016031",
        "code": "DI03016031",
        "name": "Database Management Systems",
        "department": "IT",
        "semester": 3,
        "facultyId": "Z29x8aKMwSMhRuwgknuZE9mCLH63"  # Yash Prajapati
    },
    {
        "id": "sub-it3-di03016041",
        "code": "DI03016041",
        "name": "Digital Electronics & Logic Design",
        "department": "IT",
        "semester": 3,
        "facultyId": "osseLhaAnKc4IZn1tW3fpcSfTna2"  # Mehul Patel
    },
    {
        "id": "sub-it3-di03016051",
        "code": "DI03016051",
        "name": "Computer Networks & Operating Systems",
        "department": "IT",
        "semester": 3,
        "facultyId": "vVDW2NExcnMxnEoQpGoD4gX9BeF3"  # Meha Patel
    }
]

STUDENT_NAMES = [
    # Batch 251 (15 students)
    ("Aarav Sharma", "256370316001", "251"),
    ("Aditya Verma", "256370316002", "251"),
    ("Akshat Mehta", "256370316003", "251"),
    ("Ananya Joshi", "256370316004", "251"),
    ("Aryan Patel", "256370316005", "251"),
    ("Bhavya Shah", "256370316006", "251"),
    ("Chirag Desai", "256370316007", "251"),
    ("Devanshi Dave", "256370316008", "251"),
    ("Dhruv Trivedi", "256370316009", "251"),
    ("Harshil Soni", "256370316010", "251"),
    ("Ishita Bhatt", "256370316011", "251"),
    ("Jay Solanki", "256370316012", "251"),
    ("Khushi Panchal", "256370316013", "251"),
    ("Manav Parmar", "256370316014", "251"),
    ("Meet Prajapati", "256370316015", "251"),
    # Batch 252 (15 students)
    ("Neha Rathod", "256370316016", "252"),
    ("Nishant Rawal", "256370316017", "252"),
    ("Omkar Chauhan", "256370316018", "252"),
    ("Prachi Vaghela", "256370316019", "252"),
    ("Pranav Makwana", "256370316020", "252"),
    ("Priya Jani", "256370316021", "252"),
    ("Rahul Barot", "256370316022", "252"),
    ("Riya Goswami", "256370316023", "252"),
    ("Sahil Kothari", "256370316024", "252"),
    ("Sakshi Pandya", "256370316025", "252"),
    ("Shivam Modi", "256370316026", "252"),
    ("Tanvi Shukla", "256370316027", "252"),
    ("Tirth Thakkar", "256370316028", "252"),
    ("Yashvi Doshi", "256370316029", "252"),
    ("Yuvraj Jadeja", "256370316030", "252")
]

def seed_sem3_data():
    if db is None:
        print("ERROR: Firestore db is not initialized.")
        return

    print("==================================================")
    print(" Seeding Semester 3 IT Data into Firestore        ")
    print("==================================================")

    # 1. Seed Subjects
    print("\n[1/3] Writing 5 Subjects for IT Semester 3...")
    for sub in SEM3_SUBJECTS:
        sub_id = sub["id"]
        doc_ref = db.collection('subjects').document(sub_id)
        doc_ref.set({
            "name": sub["name"],
            "code": sub["code"],
            "department": sub["department"],
            "semester": sub["semester"],
            "facultyId": sub["facultyId"]
        })
        print(f"  + Added Subject: {sub['code']} - {sub['name']} (Assigned to {sub['facultyId']})")

    # 2. Update Faculty Assigned Subjects
    print("\n[2/3] Updating Faculty assignedSubjects in IT...")
    for sub in SEM3_SUBJECTS:
        fac_id = sub["facultyId"]
        sub_id = sub["id"]
        if fac_id:
            try:
                fac_ref = db.collection('users').document(fac_id)
                fac_doc = fac_ref.get()
                if fac_doc.exists:
                    current_subs = fac_doc.to_dict().get('assignedSubjects', [])
                    if sub_id not in current_subs:
                        current_subs.append(sub_id)
                        fac_ref.update({"assignedSubjects": current_subs})
                        print(f"  * Appended {sub_id} to faculty {fac_id}")
            except Exception as e:
                print(f"  ! Error updating faculty {fac_id}: {e}")

    # 3. Seed 30 Mock Students
    print("\n[3/3] Creating 30 Mock Students (15 in Batch 251, 15 in Batch 252)...")
    batch_write = db.batch()
    count = 0
    for name, roll_no, div in STUDENT_NAMES:
        uid = f"student-{roll_no.lower()}"
        doc_ref = db.collection('users').document(uid)
        payload = {
            "name": name,
            "role": "student",
            "department": "IT",
            "semester": 3,
            "division": div,
            "rollNumber": roll_no,
            "dob": "01012006",
            "email": f"{roll_no.lower()}@satendify.edu",
            "mobile": f"+91 98765 {str(count + 10).zfill(5)}",
            "phone": "",
            "enrollmentOrEmployeeId": roll_no,
            "status": "active",
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        batch_write.set(doc_ref, payload)
        count += 1

    batch_write.commit()
    print(f"  + Successfully committed {count} student records to 'users' collection.")
    print("\n==================================================")
    print(" Semester 3 IT seeding complete!")
    print("==================================================")

if __name__ == '__main__':
    seed_sem3_data()
