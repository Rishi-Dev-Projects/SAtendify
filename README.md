# SAtendify — Frontend client console

SAtendify is a premium, state-of-the-art student attendance management portal built for a diploma engineering college. The client interface serves four roles: Administrator, Head of Department (HOD), Faculty, and Student.

---

## 🚀 Getting Started & Local Testing

Since SAtendify uses modern **ES6 Javascript Modules** (`type="module"`), files must be served from a web host server to pass CORS security controls rather than opened directly as static `file:///` paths.

A pre-packaged server script is provided. Double-click the launcher script or run standard commands:

### 1. Launch local server
To spin up a light server, run this in PowerShell or Command Prompt inside the directory:
```bash
py -m http.server 8000
```
Then visit: **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 🔑 Demo testing accounts (Pre-populated)

Inside the login screen, a **Developer Quick Switcher** panel allows you to bypass typing credentials. Clicking any account pre-fills credentials and signs in automatically:

| Academic Profile / Role | Email Account | Mock Password |
| :--- | :--- | :--- |
| **System Admin** | `admin@satendify.edu` | (Type anything or click switcher) |
| **IT HOD** | `hod.it@satendify.edu` | (Type anything or click switcher) |
| **Faculty (DBMS)** | `fac.dbms@satendify.edu` | (Type anything or click switcher) |
| **IT Student (Sem 4)** | `std-23it01@satendify.edu` | (Type anything or click switcher) |

*Note: In local mock mode, any password will bypass the validation checks. Password input field is required by forms validations.*

---

## ⚙️ Connecting to a Live Backend (Flask/FastAPI)

Swap from client-side mocked localStorage to a live Firebase Auth and FastAPI/Flask backend server in one step. Open `js/config.js` and modify these keys:

```javascript
export const CONFIG = {
  // 1. Toggle this key to false
  USE_MOCK: false,

  // 2. Point to your live backend REST API URL
  API_BASE_URL: 'https://api.yourcollege.edu/api',

  // 3. Configure your production Firebase Web SDK Configuration
  FIREBASE_CONFIG: {
    apiKey: "YOUR_PRODUCTION_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "1234567890",
    appId: "your-app-id"
  }
};
```

---

## 🏛 Directory Architecture Details

```text
SAtendify/
├── css/
│   └── style.css          # Design System token declarations and global CSS styles
├── js/
│   ├── config.js          # API switch toggles and Firebase configuration variables
│   ├── mockData.js        # Default seed database initializer (Localstorage persistence)
│   ├── auth.js            # Firebase Authentication + Mock Auth sessions router
│   ├── api.js             # Shared fetch client wrapper, status Toast notifications, and Mock CRUD APIs 
│   ├── main.js            # Shared Chrome chrome drawers (sidebar and headers) renderer
│   ├── admin.js           # Admin Dashboard Tab panels (Analytics, Subjects CRUD, Users CRUD, Timetables)
│   ├── hod.js             # HOD scoped Department panel (Faculty assignment, Timetable grid, Take attendance)
│   ├── faculty.js         # Faculty core pages (Availability timeline, Roster marking sheets, 48h history)
│   └── student.js         # Student profile analytics (Radial wheel progress, Ledger details, ChartJS graphs)
├── index.html             # Route Gateway gatekeeper (Auto session check direction)
├── login.html             # Login screen panel + Developer Switcher + Forgot password panel
├── 403.html               # 403 Access Denied layout wrapper
├── 404.html               # 404 Not Found error layout wrapper
├── admin.html             # Admin chrome workspace
├── hod.html               # HOD chrome workspace
├── faculty.html           # Faculty chrome workspace
├── student.html           # Student chrome workspace
└── run.bat                # Shortcut windows batch script to open server
```

---

## ⚡ Key Workflows Implemented

### 1. Roster Attendance Marking (Faculty/HOD)
- Today's timetable slots are computed relative to real system time. Future periods are locked/greyed out with helpful labels (e.g. "Available at 11:15 AM").
- Roster details load dynamically. Clicking "Mark all Present" / "Mark all Absent" modifies rows.
- Large touch buttons toggle individual student rows between Present (Green), Absent (Red), and On Leave (Yellow) statuses.
- Sticky margins submit student registers, writing records to historical session arrays.

### 2. Verification History Locks (Faculty)
- Faculty can filter logs by subject code and target dates.
- Interactive Modify triggers allow editing submissions.
- **48-Hour Business Logic:** If a logged entry is older than 48 hours, editing actions are disabled.

### 3. Student Attendance Report Card
- Overall attendance is visualized as a radial circle percentage.
- **Academic minimum (75%) conditional formatting:** Under 75% displays a red advisory banner highlighting final exam restrictions. Above 75% displays a green clearance indicator.
- Subject list items display progress percentage bar colors matching status (emerald vs red). Collapsing accordion triggers render granular dates lists ledger rows.
- Live **Chart.js HTML5 canvases** draw Subject histograms and Week-by-week trend indices.
- CSV export logs can be compiled in the browser and downloaded with a single click.

---

## ⚠️ Known Mock Limitations

1. **Timetable Grid Collision:** When schedule classes are added, collision scripts verify that the target professor is not scheduled elsewhere and that the class room is free. Live multi-device tests may allow racing if done outside a transactional server.
2. **Session Persistence:** Disabling mock mode wipes local storage buffers. The real backend database registers are expected to store subjects, classes, rules, and timetable schemas permanently.
