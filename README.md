# 🎓 SAtendify — Smart Academic Attendance Portal

**SAtendify** is a state-of-the-art, high-performance Student Attendance Management System designed specifically for academic institutions. Built with a modern vanilla JavaScript architecture and Python Flask + Firebase Admin SDK backend, SAtendify provides tailored consoles for four distinct user roles: **System Administrator**, **Head of Department (HOD)**, **Faculty Member**, and **Student**.

---

## ✨ Key Features & Enhancements

### 🛡️ Role-Based Portals & Dashboards
- **System Administrator Console** (`admin.html`): Manage subject master lists, departmental staff directories, student enrollment profiles, dynamic timetable slots, institutional attendance logs, and system configuration.
- **Head of Department (HOD) Dashboard** (`hod.html`): Departmental analytics, faculty teaching load assignments, substitute proxy audits, student rosters, timetable master grid, and register logs.
- **Faculty Dashboard** (`faculty.html`): Today's timetable schedule, attendance roster marking pane with 48-hour edit locks, substitute proxy lecture allocation system, student directory, and attendance logs.
- **Student Portal** (`student.html`): Real-time overall attendance ratio, 75% academic eligibility status indicator, subject breakdown with visual progress fill bars, interactive attendance ledger, weekly trends, class schedule, and Roll Number + Date of Birth (`DDMMYYYY`) credentials login.

### ⚡ Substitute / Proxy Lecture Allocation System
- **Faculty Absence Delegation**: Faculty members on leave can assign scheduled lectures for a target date to a substitute professor in their department.
- **HOD Proxy Management**: HODs can assign and audit proxy substitute lectures across the department.
- **Proxy Roster Marking**: Proxy professors see assigned classes on their daily timeline marked with `⚡ Proxy (Covering for Prof. X)` and gain authorization to take attendance for the slot.

### 🆔 Student Credential Login (Roll No + DOB)
- **Student Sign-In**: Removed email requirements for students. Students log in using their **Roll Number** (e.g., `23IT01`) and **Date of Birth** in `DDMMYYYY` format (e.g., `15082004`).
- **Complete Employee ID Removal**: Cleaned up legacy `Employee ID` fields across forms, tables, modals, seeds, and API payloads for staff.

### 📊 Attendance Registers & Analytics
- **Indexed Registers & Visual Meters**: Clean table indexing (`#`), monospace timestamps, subject code tags, and percentage progress fill bars across all consoles.
- **SVG Design System**: Modern dark-gradient themes (`linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)`), glassmorphism, responsive drawer navigation, zero emojis, and pure SVG icons.

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- Python 3.10+
- Flask & Firebase Admin SDK

### 1. Launch Backend API Server
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Install requirements
pip install -r requirements.txt
# Run Flask app
python app.py
```
The Flask backend runs on **[http://localhost:8000](http://localhost:8000)**.

### 2. Frontend Development Server
Since SAtendify uses modern **ES6 JavaScript Modules** (`type="module"`), run a local HTTP server from the root directory:
```bash
py -m http.server 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your web browser.

---

## 🔑 Demo Access Credentials

The login interface includes a **Developer Quick Switcher** panel for instant single-click sign-in:

| Role / Profile | Identity / Roll No | Password / DOB | Console URL |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@satendify.edu` | `admin123` | `/admin.html` |
| **IT HOD** | `hod.it@satendify.edu` | `hod123` | `/hod.html` |
| **DBMS Faculty** | `fac.dbms@satendify.edu` | `fac123` | `/faculty.html` |
| **IT Student (Sem 4)** | `23IT01` | `15082004` | `/student.html` |

---

## 🏛️ Repository Architecture

```text
SAtendify/
├── backend/
│   ├── blueprints/
│   │   ├── admin.py       # Admin CRUD & system configuration API routes
│   │   ├── auth.py        # Authentication & profile resolution API routes
│   │   ├── faculty.py     # Faculty timetable, roster marking, & proxy API routes
│   │   ├── hod.py         # HOD department analytics & assignment API routes
│   │   └── student.py     # Student attendance metrics & timetable API routes
│   ├── app.py             # Flask application entry point
│   ├── config.py          # Firestore database & Firebase Admin SDK initialization
│   ├── decorators.py      # Bearer token verification & role authorization middleware
│   ├── seed.py            # Initial database seeder script
│   └── requirements.txt   # Python dependency manifest
├── css/
│   └── style.css          # Core design system tokens, utility classes, and global styles
├── js/
│   ├── config.js          # API endpoints & Firebase SDK configuration
│   ├── mockData.js        # Offline fallback database seeds
│   ├── auth.js            # Authentication sessions router & Roll No + DOB validator
│   ├── api.js             # API fetch client wrapper & toast notifications manager
│   ├── main.js            # Navigation drawer & chrome header manager
│   ├── admin.js           # Admin console controller
│   ├── hod.js             # HOD console controller
│   ├── faculty.js         # Faculty console & proxy management controller
│   └── student.js         # Student portal analytics controller
├── index.html             # Application gateway router
├── login.html             # Login panel with Developer Quick Switcher
├── admin.html             # Admin portal view
├── hod.html               # HOD portal view
├── faculty.html           # Faculty portal view
├── student.html           # Student portal view
└── README.md              # Project documentation
```

---

## 📄 License
This project is developed for academic institutional management. All rights reserved.
