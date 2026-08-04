# SAtendify Backend API — Documentation

A Python Flask backend server communicating with **Firebase Authentication** and **Firebase Firestore** databases. The server verifies ID tokens server-side, implements strict role-based access validation checks, and applies timetable-to-attendance integrity constraints.

---

## 🚀 Backend Local Setup & Startup

To run the backend on Windows:

### 1. Set up a Python Virtual Environment
Open PowerShell or Command Prompt in the `backend/` directory:
```bash
# Create virtual environment
py -m venv venv

# Activate virtual environment (Windows cmd)
venv\Scripts\activate

# Or in PowerShell:
# venv/Scripts/Activate.ps1
```

### 2. Install Package Requirements
```bash
py -m pip install -r requirements.txt
```

### 3. Setup Environment Configuration File
Copy the `.env.template` into a new `.env` file:
```bash
copy .env.template .env
```
Open `.env` and fill in your Firebase Project configuration keys (see details below).

### 4. Seed the Firestore Database
To seed user accounts, departments, timetable schedules, and 6 weeks of attendance records, run:
```bash
py seed.py
```
This syncs users to **Firebase Authentication** with a default testing password `password123`.

### 5. Launch the Server
```bash
py app.py
```
The server will boot on **`http://localhost:5000`**.

---

## 🪵 Firebase Project Setup Instructions

To obtain the `.env` credentials:
1. Visit the **[Firebase Console](https://console.firebase.google.com/)** and create a project called `SAtendify`.
2. Go to **Build -> Authentication** and enable the **Email/Password** provider.
3. Go to **Build -> Firestore Database** and click **Create Database** (start in test mode or production mode).
4. Go to **Project Settings (Gear Icon) -> Service Accounts**.
5. Select **Python** option and click **Generate New Private Key**. This downloads a JSON file.
6. Open that JSON file and extract these keys to your `.env`:
   * `project_id` -> `FIREBASE_PROJECT_ID`
   * `client_email` -> `FIREBASE_CLIENT_EMAIL`
   * `private_key` -> `FIREBASE_PRIVATE_KEY` (Keep the double-quotes and make sure the newlines are escaped with `\n`).

---

## 🛡️ Role Access Matrix & Request Scoping

Every request must include the header: **`Authorization: Bearer <ID_TOKEN>`** obtained during Firebase Authentication. The backend decodes this token to load the Firestore user details and enforces these routes rules:

* **Admin:** Performs system-wide modifications (CRUD). Can query all departments, subjects, timetables, and override locks.
* **HOD:** Confined to `request.user.department == resource.department`. Manages department subjects, faculty assignments, timetables, and logs.
* **Faculty:** Scoped to their own assigned course subjects and mapped schedules cells. Cannot modify rosters older than 48 hours.
* **Student:** Allowed read-only access to their own weekly schedule and personal regularity card.

---

## 📡 REST API Schema Contract Reference

All success APIs return headers in the format:
```json
{
  "success": true,
  "data": { ... }
}
```
All failed APIs return standard error formats:
```json
{
  "success": false,
  "error": "Error details explaining reason."
}
```

### A. Authentication Endpoints

#### `GET /auth/me`
* **Access Level:** Logged-In User
* **Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "usr-fac-1",
    "email": "fac.dbms@satendify.edu",
    "role": "faculty",
    "name": "Dr. Alok Patel",
    "department": "IT",
    "subjects": ["sub-it4-dbms"]
  }
}
```

#### `POST /auth/login`
* **Payload:** `{"idToken": "Token_String"}`
* **Response `200`:** Profile payload containing role routing properties.

#### `POST /auth/reset-password`
* **Payload:** `{"email": "user@satendify.edu"}`
* **Response `200`:** `{ "success": true, "message": "Password reset trigger generated.", "data": { "resetLink": "https://..." } }`

---

### B. Admin CRUD Endpoints (`/admin/...`)

#### `POST /admin/promote-hod`
* **Access Level:** admin
* **Payload:** `{"facultyId": "usr-fac-2", "department": "IT"}`
* **Response `200`:** Promotes faculty and demotes the previous HOD of that department automatically.

#### `POST /admin/timetable`
* **Access Level:** admin, hod
* **Payload:**
```json
{
  "department": "IT",
  "semester": 4,
  "division": "A",
  "day": "Monday",
  "period": 1,
  "subjectId": "sub-it4-dbms",
  "facultyId": "usr-fac-1",
  "room": "Lab 101"
}
```
* **Conflict Errors `409`:** Returns conflict errors if:
  * The teacher is teaching another class at that period.
  * The classroom location is booked.
  * The division has another class schedule at that slot.

---

### C. Faculty Endpoints (`/faculty/...`)

#### `GET /faculty/timetable`
* **Access Level:** faculty, hod
* **Response `200`:** Returns today's sessions schedule. Determines weekday matches (`isToday`) and checks whether attendance is already submitted (`isSubmittedToday`).

#### `GET /faculty/roster/<timetable_id>`
* **Access Level:** faculty, hod
* **Response `200`:**
```json
{
  "success": true,
  "data": {
    "timetableCell": {
      "id": "tt-1",
      "semester": 4,
      "division": "A",
      "room": "Lab 101",
      "subject": { "id": "sub-it4-dbms", "name": "Database Management Systems", "code": "IT401" }
    },
    "roster": [
      { "id": "usr-std-1", "name": "Aarav Patel", "rollNumber": "23IT001", "email": "std-23it01@satendify.edu" }
    ]
  }
}
```

#### `POST /faculty/attendance`
* **Access Level:** faculty, hod
* **Payload:**
```json
{
  "timetableId": "tt-1",
  "date": "2026-07-10",
  "roster": {
    "usr-std-1": "present",
    "usr-std-2": "absent"
  }
}
```
* **Response `201`:** Writes records, setting `createdBy`/`createdAt` audit stamps.
* **Rules Enforced:**
  * Rejects if `timetableId` is not taught by currently authenticated faculty user.
  * Rejects with `403` if modifying a registry date older than 48 hours (unless caller is HOD or Admin).

#### `GET /faculty/attendance/history`
* **Access Level:** faculty, hod
* **Response `200`:** Lists logs entries with breakdown. Returns `canEdit: false` if record date is older than 48 hours.

---

### D. Student Endpoints (`/student/...`)

#### `GET /student/timetable`
* **Access Level:** student
* **Response `200`:** Lists scheduled classes matching department, semester, and division values.

#### `GET /student/attendance`
* **Access Level:** student
* **Response `200`:** Returns aggregates, overall attendance percentage, subject meters percentages, 6-week aggregates history, and week-over-week trends.
