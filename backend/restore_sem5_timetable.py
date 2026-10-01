from config import db, init_firebase

init_firebase()

ORIGINAL_SEM5_SLOTS = [
    # --- MONDAY ---
    {
        "id": "tt-slot-it-5-241-mon-1",
        "day": "Monday",
        "period": 1,
        "duration": 2,
        "type": "lab",
        "division": "241",
        "room": "E24",
        "subjectId": "sub-it5-di05000341",
        "facultyId": "FLV24RyHPSYQZ5rWsa4V3pAmxWz2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-242-mon-1",
        "day": "Monday",
        "period": 1,
        "duration": 2,
        "type": "lab",
        "division": "242",
        "room": "E-24",
        "subjectId": "sub-it5-di05000341",
        "facultyId": "osseLhaAnKc4IZn1tW3fpcSfTna2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-mon-3",
        "day": "Monday",
        "period": 3,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E26",
        "subjectId": "sub-it5-di05016031",
        "facultyId": "IuG5aTNMBbNtpRSKAo75eMn5UAm1",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-mon-4",
        "day": "Monday",
        "period": 4,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E26",
        "subjectId": "sub-it5-di05016011",
        "facultyId": "vVDW2NExcnMxnEoQpGoD4gX9BeF3",
        "department": "IT",
        "semester": 5
    },

    # --- TUESDAY ---
    {
        "id": "tt-slot-it-5-241-tue-1",
        "day": "Tuesday",
        "period": 1,
        "duration": 2,
        "type": "lab",
        "division": "241",
        "room": "E29",
        "subjectId": "sub-it5-di05016031",
        "facultyId": "osseLhaAnKc4IZn1tW3fpcSfTna2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-242-tue-1",
        "day": "Tuesday",
        "period": 1,
        "duration": 2,
        "type": "lab",
        "division": "242",
        "room": "E-24",
        "subjectId": "sub-it5-di05016021",
        "facultyId": "Z29x8aKMwSMhRuwgknuZE9mCLH63",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-tue-3",
        "day": "Tuesday",
        "period": 3,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E26",
        "subjectId": "sub-it5-di05016021",
        "facultyId": "Z29x8aKMwSMhRuwgknuZE9mCLH63",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-tue-4",
        "day": "Tuesday",
        "period": 4,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E26",
        "subjectId": "sub-it5-di05016011",
        "facultyId": "vVDW2NExcnMxnEoQpGoD4gX9BeF3",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-tue-5",
        "day": "Tuesday",
        "period": 5,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E26",
        "subjectId": "sub-it5-di05016031",
        "facultyId": "osseLhaAnKc4IZn1tW3fpcSfTna2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-tue-6",
        "day": "Tuesday",
        "period": 6,
        "duration": 2,
        "type": "lab",
        "division": "241",
        "room": "E24",
        "subjectId": "sub-it5-di05000341",
        "facultyId": "osseLhaAnKc4IZn1tW3fpcSfTna2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-242-tue-6",
        "day": "Tuesday",
        "period": 6,
        "duration": 2,
        "type": "lab",
        "division": "242",
        "room": "E-24",
        "subjectId": "sub-it5-di05000341",
        "facultyId": "IuG5aTNMBbNtpRSKAo75eMn5UAm1",
        "department": "IT",
        "semester": 5
    },

    # --- WEDNESDAY ---
    {
        "id": "tt-slot-it-5-241-wed-2",
        "day": "Wednesday",
        "period": 2,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E26",
        "subjectId": "sub-it5-di05016021",
        "facultyId": "osseLhaAnKc4IZn1tW3fpcSfTna2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-wed-3",
        "day": "Wednesday",
        "period": 3,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "CH-23",
        "subjectId": "sub-it5-di05016022",
        "facultyId": "FLV24RyHPSYQZ5rWsa4V3pAmxWz2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-wed-4",
        "day": "Wednesday",
        "period": 4,
        "duration": 2,
        "type": "lab",
        "division": "241",
        "room": "E-24",
        "subjectId": "sub-it5-di05016021",
        "facultyId": "osseLhaAnKc4IZn1tW3fpcSfTna2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-242-wed-4",
        "day": "Wednesday",
        "period": 4,
        "duration": 2,
        "type": "lab",
        "division": "242",
        "room": "E-25",
        "subjectId": "sub-it5-di05016011",
        "facultyId": "vVDW2NExcnMxnEoQpGoD4gX9BeF3",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-wed-6",
        "day": "Wednesday",
        "period": 6,
        "duration": 2,
        "type": "lab",
        "division": "241",
        "room": "E24",
        "subjectId": "sub-it5-di05000341",
        "facultyId": "IuG5aTNMBbNtpRSKAo75eMn5UAm1",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-242-wed-6",
        "day": "Wednesday",
        "period": 6,
        "duration": 2,
        "type": "lab",
        "division": "242",
        "room": "E-24",
        "subjectId": "sub-it5-di05000341",
        "facultyId": "Z29x8aKMwSMhRuwgknuZE9mCLH63",
        "department": "IT",
        "semester": 5
    },

    # --- THURSDAY ---
    {
        "id": "tt-slot-it-5-241-thu-1",
        "day": "Thursday",
        "period": 1,
        "duration": 2,
        "type": "lab",
        "division": "241",
        "room": "E24",
        "subjectId": "sub-it5-di05016061",
        "facultyId": "vVDW2NExcnMxnEoQpGoD4gX9BeF3",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-242-thu-1",
        "day": "Thursday",
        "period": 1,
        "duration": 2,
        "type": "lab",
        "division": "242",
        "room": "E-29",
        "subjectId": "sub-it5-di05016031",
        "facultyId": "IuG5aTNMBbNtpRSKAo75eMn5UAm1",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-thu-3",
        "day": "Thursday",
        "period": 3,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E-26",
        "subjectId": "sub-it5-di05016011",
        "facultyId": "IuG5aTNMBbNtpRSKAo75eMn5UAm1",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-thu-4",
        "day": "Thursday",
        "period": 4,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E-26",
        "subjectId": "sub-it5-di05016021",
        "facultyId": "Z29x8aKMwSMhRuwgknuZE9mCLH63",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-thu-5",
        "day": "Thursday",
        "period": 5,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E-26",
        "subjectId": "sub-it5-di05016061",
        "facultyId": "vVDW2NExcnMxnEoQpGoD4gX9BeF3",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-thu-6",
        "day": "Thursday",
        "period": 6,
        "duration": 2,
        "type": "tutorial",
        "division": "241",
        "room": "E24",
        "subjectId": "sub-it5-di05016071",
        "facultyId": "FLV24RyHPSYQZ5rWsa4V3pAmxWz2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-242-thu-6",
        "day": "Thursday",
        "period": 6,
        "duration": 2,
        "type": "tutorial",
        "division": "242",
        "room": "E-24",
        "subjectId": "sub-it5-di05016071",
        "facultyId": "Z29x8aKMwSMhRuwgknuZE9mCLH63",
        "department": "IT",
        "semester": 5
    },

    # --- FRIDAY ---
    {
        "id": "tt-slot-it-5-241-fri-2",
        "day": "Friday",
        "period": 2,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E26",
        "subjectId": "sub-it5-di05016031",
        "facultyId": "osseLhaAnKc4IZn1tW3fpcSfTna2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-fri-3",
        "day": "Friday",
        "period": 3,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "E26",
        "subjectId": "sub-it5-di05016061",
        "facultyId": "vVDW2NExcnMxnEoQpGoD4gX9BeF3",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-fri-4",
        "day": "Friday",
        "period": 4,
        "duration": 2,
        "type": "lab",
        "division": "241",
        "room": "E-24",
        "subjectId": "sub-it5-di05016011",
        "facultyId": "IuG5aTNMBbNtpRSKAo75eMn5UAm1",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-242-fri-4",
        "day": "Friday",
        "period": 4,
        "duration": 2,
        "type": "lab",
        "division": "242",
        "room": "E-29",
        "subjectId": "sub-it5-di05016061",
        "facultyId": "Z29x8aKMwSMhRuwgknuZE9mCLH63",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-241-fri-6",
        "day": "Friday",
        "period": 6,
        "duration": 2,
        "type": "lab",
        "division": "241",
        "room": "E24",
        "subjectId": "sub-it5-di05016071",
        "facultyId": "FLV24RyHPSYQZ5rWsa4V3pAmxWz2",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-it-5-242-fri-6",
        "day": "Friday",
        "period": 6,
        "duration": 2,
        "type": "lab",
        "division": "242",
        "room": "E-24",
        "subjectId": "sub-it5-di05016071",
        "facultyId": "Z29x8aKMwSMhRuwgknuZE9mCLH63",
        "department": "IT",
        "semester": 5
    },

    # --- SATURDAY ---
    {
        "id": "tt-slot-it-5-241-sat-1",
        "day": "Saturday",
        "period": 1,
        "duration": 2,
        "type": "lab",
        "division": "241",
        "room": "E-26",
        "subjectId": "sub-it5-di05000341",
        "facultyId": "Z29x8aKMwSMhRuwgknuZE9mCLH63",
        "department": "IT",
        "semester": 5
    },
    {
        "id": "tt-slot-me-5-241-sat-1",
        "day": "Saturday",
        "period": 1,
        "duration": 1,
        "type": "lecture",
        "division": "ALL",
        "room": "M-24",
        "subjectId": "sub-me5-di05016052",
        "facultyId": "HEykXhdtrDOAdsn68e0uxKiMG3w2",
        "department": "ME",
        "semester": 5
    }
]

def restore_timetable():
    print("==================================================")
    print(" Restoring Original Semester 5 Timetable          ")
    print("==================================================")

    # 1. Clear current Sem 5 slots in IT
    existing = db.collection('timetables').where('semester', '==', 5).stream()
    cleared = 0
    for doc in existing:
        doc.reference.delete()
        cleared += 1
    print(f"Cleared {cleared} existing Sem 5 slots.")

    # 2. Write original slots
    batch = db.batch()
    for s in ORIGINAL_SEM5_SLOTS:
        doc_ref = db.collection('timetables').document(s["id"])
        data = {k: v for k, v in s.items() if k != "id"}
        batch.set(doc_ref, data)
    batch.commit()

    print(f"Successfully restored all {len(ORIGINAL_SEM5_SLOTS)} original Sem 5 slots!")

if __name__ == '__main__':
    restore_timetable()
