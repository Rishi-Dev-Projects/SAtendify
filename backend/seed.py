import os
import random
import datetime
from firebase_admin import auth, firestore
from config import db, init_firebase

# Ensure database driver connection is active
try:
    init_firebase()
except Exception as e:
    print(f"Skipping startup: configuration file not loaded {e}")

DEPARTMENTS = [
    {"id": "IT", "name": "Information Technology", "hodId": "usr-hod-it"},
    {"id": "CE", "name": "Computer Engineering", "hodId": "usr-hod-ce"},
    {"id": "ME", "name": "Mechanical Engineering", "hodId": "usr-hod-me"},
    {"id": "CH", "name": "Chemical Engineering", "hodId": ""},
    {"id": "EE", "name": "Electrical Engineering", "hodId": ""}
]

DEMO_USERS = [
    {
        "id": "usr-admin",
        "email": "admin@satendify.edu",
        "role": "admin",
        "name": "Dr. Ramesh Mehta",
        "department": None,
        "phone": "+91 99999 88888",
        "status": "active"
    },
    {
        "id": "usr-hod-it",
        "email": "hod.it@satendify.edu",
        "role": "hod",
        "name": "Prof. Sunita Sharma",
        "department": "IT",
        "phone": "+91 98888 77777",
        "status": "active",
        "assignedSubjects": []
    },
    {
        "id": "usr-fac-1",
        "email": "fac.dbms@satendify.edu",
        "role": "faculty",
        "name": "Dr. Alok Patel",
        "department": "IT",
        "phone": "+91 97777 66666",
        "status": "active",
        "assignedSubjects": ["sub-it4-dbms"]
    },
    {
        "id": "usr-fac-2",
        "email": "fac.cn@satendify.edu",
        "role": "faculty",
        "name": "Prof. Ritu Shah",
        "department": "IT",
        "phone": "+91 96666 55555",
        "status": "active",
        "assignedSubjects": ["sub-it4-cn"]
    },
    {
        "id": "usr-fac-3",
        "email": "fac.wad@satendify.edu",
        "role": "faculty",
        "name": "Prof. Jaydeep Trivedi",
        "department": "IT",
        "phone": "+91 95555 44444",
        "status": "active",
        "assignedSubjects": ["sub-it4-wad"]
    },
    {
        "id": "usr-fac-4",
        "email": "fac.se@satendify.edu",
        "role": "faculty",
        "name": "Dr. Namrata Joshi",
        "department": "IT",
        "phone": "+91 94444 33333",
        "status": "active",
        "assignedSubjects": ["sub-it4-se", "sub-it4-os"]
    },
    # Demo Students (IT department, Sem 4, Div A)
    {
        "id": "usr-std-1",
        "role": "student",
        "name": "Aarav Patel",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT001",
        "dob": "15082004",
        "phone": "+91 91111 22222",
        "status": "active"
    },
    {
        "id": "usr-std-2",
        "role": "student",
        "name": "Diya Sharma",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT002",
        "dob": "12032005",
        "phone": "+91 92222 33333",
        "status": "active"
    },
    {
        "id": "usr-std-3",
        "role": "student",
        "name": "Kabir Sengupta",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT003",
        "dob": "22112004",
        "phone": "+91 93333 44444",
        "status": "active"
    },
    {
        "id": "usr-std-4",
        "role": "student",
        "name": "Isha Deshmukh",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT004",
        "dob": "05012005",
        "phone": "+91 94444 55555",
        "status": "active"
    },
    {
        "id": "usr-std-5",
        "role": "student",
        "name": "Rohan Malhotra",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT005",
        "dob": "19092004",
        "phone": "+91 95555 66666",
        "status": "active"
    },
    {
        "id": "usr-std-6",
        "role": "student",
        "name": "Ananya Roy",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT006",
        "dob": "30072005",
        "phone": "+91 96666 77777",
        "status": "active"
    },
    {
        "id": "usr-std-7",
        "role": "student",
        "name": "Dev Joshi",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT007",
        "dob": "14022004",
        "phone": "+91 97777 88888",
        "status": "active"
    },
    {
        "id": "usr-std-8",
        "role": "student",
        "name": "Meera Iyer",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT008",
        "dob": "08102004",
        "phone": "+91 98888 99999",
        "status": "active"
    },
    {
        "id": "usr-std-9",
        "role": "student",
        "name": "Vivaan Saxena",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT009",
        "dob": "25122004",
        "phone": "+91 99999 00000",
        "status": "active"
    },
    {
        "id": "usr-std-10",
        "role": "student",
        "name": "Sneha Kulkarni",
        "department": "IT",
        "semester": 4,
        "division": "A",
        "rollNumber": "23IT010",
        "dob": "11052005",
        "phone": "+91 90000 11111",
        "status": "active"
    }
]

SUBJECTS = [
    {"id": "sub-it4-dbms", "code": "IT401", "name": "Database Management Systems", "department": "IT", "semester": 4, "facultyId": "usr-fac-1"},
    {"id": "sub-it4-cn", "code": "IT402", "name": "Computer Networks", "department": "IT", "semester": 4, "facultyId": "usr-fac-2"},
    {"id": "sub-it4-wad", "code": "IT403", "name": "Web Application Development", "department": "IT", "semester": 4, "facultyId": "usr-fac-3"},
    {"id": "sub-it4-se", "code": "IT404", "name": "Software Engineering", "department": "IT", "semester": 4, "facultyId": "usr-fac-4"},
    {"id": "sub-it4-os", "code": "IT405", "name": "Operating Systems", "department": "IT", "semester": 4, "facultyId": "usr-fac-4"}
]

TIMETABLES = [
    # IT Semester 4 Division A
    {"id": "tt-1", "department": "IT", "semester": 4, "division": "A", "day": "Monday", "period": 1, "subjectId": "sub-it4-dbms", "facultyId": "usr-fac-1", "room": "Lab 101"},
    {"id": "tt-2", "department": "IT", "semester": 4, "division": "A", "day": "Monday", "period": 2, "subjectId": "sub-it4-os", "facultyId": "usr-fac-4", "room": "Classroom 302"},
    {"id": "tt-3", "department": "IT", "semester": 4, "division": "A", "day": "Monday", "period": 3, "subjectId": "sub-it4-wad", "facultyId": "usr-fac-3", "room": "Lab 103"},
    
    {"id": "tt-4", "department": "IT", "semester": 4, "division": "A", "day": "Tuesday", "period": 1, "subjectId": "sub-it4-cn", "facultyId": "usr-fac-2", "room": "Classroom 301"},
    {"id": "tt-5", "department": "IT", "semester": 4, "division": "A", "day": "Tuesday", "period": 2, "subjectId": "sub-it4-dbms", "facultyId": "usr-fac-1", "room": "Lab 101"},
    {"id": "tt-6", "department": "IT", "semester": 4, "division": "A", "day": "Tuesday", "period": 3, "subjectId": "sub-it4-se", "facultyId": "usr-fac-4", "room": "Classroom 302"},
    
    {"id": "tt-7", "department": "IT", "semester": 4, "division": "A", "day": "Wednesday", "period": 2, "subjectId": "sub-it4-wad", "facultyId": "usr-fac-3", "room": "Lab 103"},
    {"id": "tt-8", "department": "IT", "semester": 4, "division": "A", "day": "Wednesday", "period": 3, "subjectId": "sub-it4-cn", "facultyId": "usr-fac-2", "room": "Classroom 301"},
    {"id": "tt-9", "department": "IT", "semester": 4, "division": "A", "day": "Wednesday", "period": 4, "subjectId": "sub-it4-os", "facultyId": "usr-fac-4", "room": "Classroom 302"},
    
    {"id": "tt-10", "department": "IT", "semester": 4, "division": "A", "day": "Thursday", "period": 1, "subjectId": "sub-it4-se", "facultyId": "usr-fac-4", "room": "Classroom 302"},
    {"id": "tt-11", "department": "IT", "semester": 4, "division": "A", "day": "Thursday", "period": 3, "subjectId": "sub-it4-dbms", "facultyId": "usr-fac-1", "room": "Lab 101"},
    {"id": "tt-12", "department": "IT", "semester": 4, "division": "A", "day": "Thursday", "period": 4, "subjectId": "sub-it4-cn", "facultyId": "usr-fac-2", "room": "Classroom 301"},
    
    {"id": "tt-13", "department": "IT", "semester": 4, "division": "A", "day": "Friday", "period": 1, "subjectId": "sub-it4-wad", "facultyId": "usr-fac-3", "room": "Lab 103"},
    {"id": "tt-14", "department": "IT", "semester": 4, "division": "A", "day": "Friday", "period": 2, "subjectId": "sub-it4-se", "facultyId": "usr-fac-4", "room": "Classroom 321"},
    {"id": "tt-15", "department": "IT", "semester": 4, "division": "A", "day": "Friday", "period": 5, "subjectId": "sub-it4-dbms", "facultyId": "usr-fac-1", "room": "Lab 101"}
]

# Set student enrollment lists
STUDENT_UIDS = [u["id"] for u in DEMO_USERS if u["role"] == "student"]

def seed_database():
    if db is None:
        print("CRITICAL: Seed failure, firebase database not initialized.")
        return
        
    print("--------------------------------------------------")
    print(" Setting up Production Environment for SAtendify. ")
    print("--------------------------------------------------")

    # 1. Delete all other Auth Users
    print("\n   [1/4] Clearing Auth Users except Admin ...")
    try:
        page = auth.list_users()
        while page:
            for user in page.users:
                if user.email != "admin@satendify.edu":
                    try:
                        auth.delete_user(user.uid)
                        print(f"         Deleted auth user: {user.email}")
                    except Exception as e:
                        print(f"         Error deleting {user.email}: {e}")
            page = page.get_next_page()
    except Exception as e:
        print(f"         Warning listing/deleting auth users: {e}")

    # Ensure Admin exists in Auth
    admin_email = "admin@satendify.edu"
    admin_uid = "usr-admin"
    admin_name = "Dr. Ramesh Mehta"
    try:
        auth.get_user_by_email(admin_email)
        print(f"         Admin user {admin_email} already exists in Auth.")
    except auth.UserNotFoundError:
        auth.create_user(uid=admin_uid, email=admin_email, password="password123", display_name=admin_name)
        print(f"         Created Admin user account in Auth: {admin_email}")
    except Exception as e:
        print(f"         Auth check exception: {e}")

    # 2. Clear Firestore Collections
    print("\n   [2/4] Clearing Firestore Collections ...")
    collections_to_clear = ['departments', 'subjects', 'timetables', 'attendance', 'users']
    for coll in collections_to_clear:
        try:
            docs = db.collection(coll).stream()
            count = 0
            for doc in docs:
                if coll == 'users' and doc.id == admin_uid:
                    continue
                doc.reference.delete()
                count += 1
            if count > 0:
                print(f"         Deleted {count} documents from '{coll}' collection.")
        except Exception as e:
            print(f"         Error clearing collection '{coll}': {e}")

    # 3. Seed Admin Profile to Firestore
    print("\n   [3/4] Initializing Admin Profile in Firestore ...")
    try:
        admin_ref = db.collection('users').document(admin_uid)
        admin_ref.set({
            "email": admin_email,
            "name": admin_name,
            "role": "admin",
            "phone": "+91 99999 88888",
            "status": "active",
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        print("         Admin profile registered successfully.")
    except Exception as e:
        print(f"         Error saving admin profile: {e}")
        
    print("\n-------------------------------------------------------------")
    print(" SAtendify Production Ready. Loaded with Admin account only. ")
    print("-------------------------------------------------------------")

if __name__ == '__main__':
    seed_database()
