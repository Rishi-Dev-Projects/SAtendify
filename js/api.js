// SAtendify API Wrapper and Mock Service Layer
import { CONFIG } from './config.js';
import { getAuthToken, getCurrentUser } from './auth.js';
import { getDB, setDB } from './mockData.js';

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Custom toast notification system
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    min-width: 280px;
    max-width: 400px;
    background: #ffffff;
    border-left: 4px solid var(--toast-border, #64748b);
    color: var(--text-primary, #0f172a);
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
    padding: 14px 18px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.875rem;
    font-family: var(--font-sans);
    font-weight: 500;
    pointer-events: auto;
    animation: toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    transition: all 0.3s ease;
  `;

  // Set colors based on type
  if (type === 'success') {
    toast.style.setProperty('--toast-border', '#10b981'); // Emerald
    toast.innerHTML = `<span style="color:#059669; font-weight:700; margin-right:4px;">✓</span> <span>${message}</span>`;
  } else if (type === 'error') {
    toast.style.setProperty('--toast-border', '#ef4444'); // Rose
    toast.innerHTML = `<span style="color:#dc2626; font-weight:700; margin-right:4px;">✕</span> <span>${message}</span>`;
  } else if (type === 'warning') {
    toast.style.setProperty('--toast-border', '#f59e0b'); // Amber
    toast.innerHTML = `<span style="color:#d97706; font-weight:700; margin-right:4px;">⚠</span> <span>${message}</span>`;
  } else {
    toast.style.setProperty('--toast-border', '#3b82f6'); // Accent Blue
    toast.innerHTML = `<span style="color:#2563eb; font-weight:700; margin-right:4px;">ℹ</span> <span>${message}</span>`;
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--text-secondary, #64748b);
    cursor: pointer;
    line-height: 1;
    margin-left: auto;
    padding: 0;
  `;
  closeBtn.addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 300);
  });
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Add CSS keyframe animation for toast dynamically if it doesn't exist
if (typeof document !== 'undefined' && !document.getElementById('toast-animation-styles')) {
  const styles = document.createElement('style');
  styles.id = 'toast-animation-styles';
  styles.innerText = `
    @keyframes toast-slide-in {
      from { opacity: 0; transform: translateY(12px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(styles);
}

// In-Memory API Cache for ultra-fast tab switches
const apiCache = new Map();
const CACHE_TTL_MS = 20000; // 20 seconds TTL

export function clearApiCache() {
  apiCache.clear();
}

// Main API Fetch Wrapper
export async function apiFetch(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();

  // Invalidate cache on data mutation requests (POST, PUT, DELETE)
  if (method !== 'GET') {
    clearApiCache();
  }

  // 1. If USING MOCK MODE: Intercept routes locally
  if (CONFIG.USE_MOCK) {
    await sleep(CONFIG.MOCK_DELAY);
    try {
      const response = await handleMockApi(endpoint, options);
      if (response && response.success) {
        return response;
      } else {
        const errMsg = (response && response.error) ? response.error : 'Mock API error';
        showToast(errMsg, 'error');
        return { success: false, error: errMsg };
      }
    } catch (e) {
      console.error('Mock API system exception:', e);
      showToast(e.message, 'error');
      return { success: false, error: e.message };
    }
  }

  // Check in-memory cache for GET requests
  const cacheKey = endpoint;
  if (method === 'GET' && !options.skipCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }
  }

  // 2. PRODUCTION MODE: real HTTP calls to the backend
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers
  };

  try {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const response = await fetch(url, fetchOptions);

    // Check for HTTP errors
    if (response.status === 401 || response.status === 403) {
      // Clear token and kick out
      localStorage.removeItem('sat_session');
      window.location.href = 'login.html';
      return { success: false, error: 'Session expired or unauthorised.' };
    }

    const payload = await response.json();
    if (!payload.success) {
      showToast(payload.error || 'Server error', 'error');
    } else if (method === 'GET') {
      apiCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    }
    return payload; // Returns { success: true/false, data: ... , error: ... }
  } catch (error) {
    console.error('API connection failure:', error);
    showToast('Failed to connect to the backend server.', 'error');
    return { success: false, error: 'Backend server connection failed.' };
  }
}

// Stateful Mock Router representing the backend operations
async function handleMockApi(endpoint, options) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : null;
  const currUser = getCurrentUser();

  // Validate session presence (auth simulation)
  if (!currUser && endpoint !== '/auth/login') {
    return { success: false, error: 'Unauthorized. Please login.' };
  }

  // MATCH ROUTES
  if (endpoint === '/auth/me') {
    if (method === 'GET') {
      return { success: true, data: currUser };
    } else if (method === 'PUT') {
      if (body && body.name) currUser.name = body.name;
      if (body && body.email) currUser.email = body.email;
      
      const sessionStr = localStorage.getItem('sat_session');
      if (sessionStr) {
        try {
          const sess = JSON.parse(sessionStr);
          sess.user.name = currUser.name;
          sess.user.email = currUser.email;
          localStorage.setItem('sat_session', JSON.stringify(sess));
        } catch (e) {}
      }
      return { success: true, message: 'Profile details updated successfully!' };
    }
  }

  // -- ADMIN & HOD ANALYTICS --
  if (endpoint.startsWith('/admin/analytics') || endpoint.startsWith('/hod/analytics')) {
    const users = getDB('sat_users') || [];
    const subjects = getDB('sat_subjects') || [];
    const history = getDB('sat_attendance_history') || [];

    const students = users.filter(u => u.role === 'student');
    const teachers = users.filter(u => u.role === 'faculty' || u.role === 'hod');

    // If HOD, scope to their department only
    let deptFilter = null;
    if (endpoint.startsWith('/hod/analytics')) {
      deptFilter = currUser.department;
    }

    const scopedStudents = deptFilter ? students.filter(s => s.department === deptFilter) : students;
    const scopedTeachers = deptFilter ? teachers.filter(t => t.department === deptFilter) : teachers;
    const scopedSubjects = deptFilter ? subjects.filter(s => s.department === deptFilter) : subjects;

    // Calculate aggregated attendance percent
    // Calculate overall percent = (sum of all present records) / (sum of all records)
    let totalLogs = 0;
    let presentCount = 0;

    history.forEach(hist => {
      // Check if this history entry is for the target department
      const matchingSubject = subjects.find(s => s.id === hist.subjectId);
      if (matchingSubject && (!deptFilter || matchingSubject.department === deptFilter)) {
        Object.values(hist.roster).forEach(status => {
          totalLogs++;
          if (status === 'present') {
            presentCount++;
          }
        });
      }
    });

    const averageAttendance = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 1000) / 10 : 0;

    // Calculate department list breakdown
    const depts = getDB('sat_depts') || [];
    const deptBreakdown = depts.map(d => {
      let deptTotal = 0;
      let deptPres = 0;
      history.forEach(hist => {
        const sub = subjects.find(s => s.id === hist.subjectId);
        if (sub && sub.department === d) {
          Object.values(hist.roster).forEach(st => {
            deptTotal++;
            if (st === 'present') deptPres++;
          });
        }
      });
      return {
        department: d,
        studentCount: students.filter(s => s.department === d).length,
        averageAttendance: deptTotal > 0 ? Math.round((deptPres / deptTotal) * 1000) / 10 : 0
      };
    });

    return {
      success: true,
      data: {
        totalStudents: scopedStudents.length,
        totalFaculty: scopedTeachers.length,
        totalSubjects: scopedSubjects.length,
        averageAttendanceToday: averageAttendance || 78.5, // fallback mock
        deptBreakdown: deptBreakdown
      }
    };
  }

  // -- MANAGE DEPARTMENTS / SEMESTERS / DIVISIONS --
  if (endpoint === '/admin/departments' && method === 'GET') {
    return { success: true, data: getDB('sat_depts') };
  }

  // -- CRUD USERS --
  if (endpoint === '/admin/users') {
    let users = getDB('sat_users') || [];

    if (method === 'GET') {
      return { success: true, data: users };
    }

    if (method === 'POST') {
      const newUser = {
        id: `usr-${Date.now()}`,
        ...body
      };

      // Basic validation
      if (!body.email || !body.name || !body.role) {
        return { success: false, error: 'Required fields: Name, Email, Role' };
      }
      if (users.some(u => u.email.toLowerCase() === body.email.toLowerCase())) {
        return { success: false, error: 'Email already exists!' };
      }

      users.push(newUser);
      setDB('sat_users', users);
      return { success: true, data: newUser };
    }
  }

  if (endpoint.startsWith('/admin/users/')) {
    const userId = endpoint.split('/').pop();
    let users = getDB('sat_users') || [];
    const index = users.findIndex(u => u.id === userId);

    if (index === -1) return { success: false, error: 'User not found' };

    if (method === 'PUT') {
      users[index] = { ...users[index], ...body };
      setDB('sat_users', users);
      return { success: true, data: users[index] };
    }

    if (method === 'DELETE') {
      const deletedUser = users[index];
      users.splice(index, 1);
      setDB('sat_users', users);
      return { success: true, data: deletedUser };
    }
  }

  // -- CRUD SUBJECTS --
  if (endpoint === '/admin/subjects') {
    let subjects = getDB('sat_subjects') || [];

    if (method === 'GET') {
      return { success: true, data: subjects };
    }

    if (method === 'POST') {
      const newSub = {
        id: `sub-${Date.now()}`,
        ...body
      };

      if (!body.name || !body.code || !body.department || !body.semester) {
        return { success: false, error: 'Missing subject parameter.' };
      }

      if (subjects.some(s => s.code.toUpperCase() === body.code.toUpperCase())) {
        return { success: false, error: 'Subject Code already exists.' };
      }

      subjects.push(newSub);
      setDB('sat_subjects', subjects);
      return { success: true, data: newSub };
    }
  }

  if (endpoint.startsWith('/admin/subjects/')) {
    const subId = endpoint.split('/').pop();
    let subjects = getDB('sat_subjects') || [];
    const index = subjects.findIndex(s => s.id === subId);

    if (index === -1) return { success: false, error: 'Subject not found' };

    if (method === 'PUT') {
      subjects[index] = { ...subjects[index], ...body };
      setDB('sat_subjects', subjects);
      return { success: true, data: subjects[index] };
    }

    if (method === 'DELETE') {
      const deleted = subjects[index];
      subjects.splice(index, 1);
      setDB('sat_subjects', subjects);
      return { success: true, data: deleted };
    }
  }

  // -- TIMETABLE ENDPOINTS --
  if (endpoint === '/admin/timetable') {
    let tt = getDB('sat_timetable') || [];

    if (method === 'GET') {
      return { success: true, data: tt };
    }

    if (method === 'POST') {
      const type = body.type || 'lecture';
      const duration = parseInt(body.duration || 1);
      const startPeriod = parseInt(body.period);

      // Create array of candidate period numbers
      const candidatePeriods = [];
      for (let i = 0; i < duration; i++) {
        candidatePeriods.push(startPeriod + i);
      }

      // Check if slot conflicts (room, faculty or division at overlapping day + periods)
      const conflict = tt.find(cell => {
        if (cell.day !== body.day) return false;

        const cellDuration = parseInt(cell.duration || 1);
        const cellStart = parseInt(cell.period);
        const cellPeriods = [];
        for (let i = 0; i < cellDuration; i++) {
          cellPeriods.push(cellStart + i);
        }

        // Check if periods overlap
        const overlaps = candidatePeriods.some(p => cellPeriods.includes(p));
        if (!overlaps) return false;

        // Conflict check criteria
        const teacherConflict = cell.facultyId === body.facultyId;
        const roomConflict = cell.room === body.room;
        const classConflict = cell.department === body.department && cell.semester === parseInt(body.semester) && cell.division === body.division;

        return teacherConflict || roomConflict || classConflict;
      });

      if (conflict) {
        return { success: false, error: 'Schedule conflict detected! Faculty, Room, or Class division is busy for this Day - Period range.' };
      }

      const newCell = {
        id: `tt-${Date.now()}`,
        department: body.department,
        semester: parseInt(body.semester),
        division: body.division,
        day: body.day,
        period: startPeriod,
        type: type,
        duration: duration,
        subjectId: body.subjectId,
        facultyId: body.facultyId,
        room: body.room
      };

      tt.push(newCell);
      setDB('sat_timetable', tt);
      return { success: true, data: newCell };
    }
  }

  if (endpoint.startsWith('/admin/timetable/')) {
    const cellId = endpoint.split('/').pop();
    let tt = getDB('sat_timetable') || [];
    const index = tt.findIndex(c => c.id === cellId);

    if (index === -1) return { success: false, error: 'Timetable cell not found' };

    if (method === 'DELETE') {
      const deleted = tt[index];
      tt.splice(index, 1);
      setDB('sat_timetable', tt);
      return { success: true, data: deleted };
    }
  }

  // -- SEMESTER CONFIG ENDPOINT --
  if (endpoint === '/admin/semester-config') {
    let configs = getDB('sat_semester_config') || { "1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 2 };
    if (method === 'GET') {
      return { success: true, data: configs };
    }
    if (method === 'POST') {
      configs[body.semester] = parseInt(body.batches);
      setDB('sat_semester_config', configs);
      return { success: true, message: 'Updated semester config successfully' };
    }
  }
  if (endpoint.startsWith('/hod/faculty-subjects')) {
    let users = getDB('sat_users') || [];
    if (method === 'POST') {
      const { facultyId, subjectId } = body;
      const index = users.findIndex(u => u.id === facultyId);
      if (index === -1) return { success: false, error: 'Faculty not found.' };

      if (!users[index].subjects) users[index].subjects = [];
      if (!users[index].assignedSubjects) users[index].assignedSubjects = [];
      if (!users[index].subjects.includes(subjectId)) {
        users[index].subjects.push(subjectId);
      }
      if (!users[index].assignedSubjects.includes(subjectId)) {
        users[index].assignedSubjects.push(subjectId);
      }
      setDB('sat_users', users);
      return { success: true, data: users[index] };
    }
  }

  // -- FACULTY EXCLUSIVE ROUTES --
  if (endpoint === '/faculty/timetable' && method === 'GET') {
    // Get schedule for this teacher
    const timetable = getDB('sat_timetable') || [];
    const subjects = getDB('sat_subjects') || [];
    const history = getDB('sat_attendance_history') || [];

    // Filter classes where facultyId === current faculty
    const facultyClasses = timetable.filter(cell => cell.facultyId === currUser.id);

    // Format timetable entries to include subject info and attendance submission flag
    const today = new Date();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDayName = daysOfWeek[today.getDay()];
    const todayFormatted = today.toISOString().split('T')[0];

    const result = facultyClasses.map(cell => {
      const subInfo = subjects.find(s => s.id === cell.subjectId);

      // Check if attendance already exists in logs for this slot + date
      const taken = history.some(hist =>
        hist.timetableId === cell.id &&
        hist.date === todayFormatted
      );

      return {
        id: cell.id,
        department: cell.department,
        semester: cell.semester,
        division: cell.division,
        day: cell.day,
        period: cell.period,
        room: cell.room,
        subject: subInfo ? { id: subInfo.id, name: subInfo.name, code: subInfo.code } : null,
        isSubmittedToday: taken,
        isToday: cell.day === todayDayName
      };
    });

    return { success: true, data: result };
  }

  // Get student roster for a particular class/timetable mapping
  if (endpoint.startsWith('/faculty/roster/') && method === 'GET') {
    const timetableId = endpoint.split('/').pop();
    const timetable = getDB('sat_timetable') || [];
    const cell = timetable.find(c => c.id === timetableId);

    if (!cell) {
      return { success: false, error: 'Class schedule not found.' };
    }

    const users = getDB('sat_users') || [];
    const isLecture = !cell.type || cell.type === 'lecture';
    // Lectures include whole class (all divisions of department & semester), Labs include specific division
    const roster = users.filter(u =>
      u.role === 'student' &&
      u.department === cell.department &&
      u.semester === cell.semester &&
      (isLecture || cell.division === 'ALL' || u.division === cell.division)
    );

    const subjects = getDB('sat_subjects') || [];
    const subInfo = subjects.find(s => s.id === cell.subjectId);

    return {
      success: true,
      data: {
        timetableCell: {
          id: cell.id,
          department: cell.department,
          semester: cell.semester,
          division: cell.division,
          period: cell.period,
          room: cell.room,
          subject: subInfo
        },
        roster: roster.map(r => ({ id: r.id, name: r.name, rollNumber: r.rollNumber }))
      }
    };
  }

  // Submit attendance logs
  if (endpoint === '/faculty/attendance' && method === 'POST') {
    const { timetableId, date, roster } = body; // roster: { [studentUserId]: 'present' | 'absent' | 'leave' }

    const timetable = getDB('sat_timetable') || [];
    const cell = timetable.find(c => c.id === timetableId);
    if (!cell) return { success: false, error: 'Timetable mapping not found.' };

    let history = getDB('sat_attendance_history') || [];

    // Check if entry for this date/timetable already exists
    const existingIndex = history.findIndex(h => h.timetableId === timetableId && h.date === date);

    const newRecord = {
      id: existingIndex === -1 ? `att-hist-${Date.now()}` : history[existingIndex].id,
      timetableId: cell.id,
      subjectId: cell.subjectId,
      date: date,
      semester: cell.semester,
      division: cell.division,
      period: cell.period,
      facultyId: currUser.role === 'faculty' ? currUser.id : (existingIndex === -1 ? cell.facultyId : history[existingIndex].facultyId),
      roster: roster
    };

    if (existingIndex > -1) {
      // Validate edit window: edit allowed if date is today or yesterday
      const recordDate = new Date(history[existingIndex].date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      recordDate.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(today - recordDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 2 && currUser.role !== 'admin' && currUser.role !== 'hod') {
        return { success: false, error: 'Edit window expired! Historically locked class records cannot be edited after 48 hours.' };
      }

      history[existingIndex] = newRecord;
    } else {
      history.push(newRecord);
    }

    setDB('sat_attendance_history', history);
    return { success: true, data: newRecord };
  }

  // Get HOD department attendance logs
  if (endpoint === '/hod/attendance-logs' && method === 'GET') {
    const history = getDB('sat_attendance_history') || [];
    const subjects = getDB('sat_subjects') || [];
    const users = getDB('sat_users') || [];

    const dept = currUser.department;
    const deptHistory = history.filter(h => {
      const sub = subjects.find(s => s.id === h.subjectId);
      return sub && sub.department === dept;
    });

    const enriched = deptHistory.map(h => {
      const sub = subjects.find(s => s.id === h.subjectId);
      const fac = users.find(u => u.id === h.facultyId);
      const presentCount = Object.values(h.roster).filter(st => st === 'present').length;
      const totalCount = Object.keys(h.roster).length;

      return {
        id: h.id,
        timetableId: h.timetableId,
        date: h.date,
        period: h.period,
        semester: h.semester,
        division: h.division,
        subjectName: sub ? sub.name : 'Unknown Subject',
        subjectCode: sub ? sub.code : '???',
        facultyName: fac ? fac.name : 'Unknown Faculty',
        presentCount,
        totalCount,
        canEdit: true,
        roster: h.roster
      };
    });

    return { success: true, data: enriched.sort((a, b) => b.date.localeCompare(a.date)) };
  }

  // Get Admin all attendance logs
  if (endpoint === '/admin/attendance-logs' && method === 'GET') {
    const history = getDB('sat_attendance_history') || [];
    const subjects = getDB('sat_subjects') || [];
    const users = getDB('sat_users') || [];

    const enriched = history.map(h => {
      const sub = subjects.find(s => s.id === h.subjectId);
      const fac = users.find(u => u.id === h.facultyId);
      const presentCount = Object.values(h.roster).filter(st => st === 'present').length;
      const totalCount = Object.keys(h.roster).length;

      return {
        id: h.id,
        timetableId: h.timetableId,
        date: h.date,
        period: h.period,
        semester: h.semester,
        division: h.division,
        subjectName: sub ? sub.name : 'Unknown Subject',
        subjectCode: sub ? sub.code : '???',
        facultyName: fac ? fac.name : 'Unknown Faculty',
        department: sub ? sub.department : 'GEN',
        presentCount,
        totalCount,
        canEdit: true,
        roster: h.roster
      };
    });

    return { success: true, data: enriched.sort((a, b) => b.date.localeCompare(a.date)) };
  }

  // Get Faculty historical attendance lists
  if (endpoint === '/faculty/history' && method === 'GET') {
    const history = getDB('sat_attendance_history') || [];
    const subjects = getDB('sat_subjects') || [];
    const users = getDB('sat_users') || [];

    const myHistory = history.filter(h => h.facultyId === currUser.id);

    // Enrich history records
    const enriched = myHistory.map(h => {
      const sub = subjects.find(s => s.id === h.subjectId);
      const presentCount = Object.values(h.roster).filter(st => st === 'present').length;
      const totalCount = Object.keys(h.roster).length;

      // Edit window active calculation (48 hours)
      const recordDate = new Date(h.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      recordDate.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(today - recordDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const canEdit = diffDays <= 2;

      return {
        id: h.id,
        timetableId: h.timetableId,
        date: h.date,
        period: h.period,
        semester: h.semester,
        division: h.division,
        subjectName: sub ? sub.name : 'Unknown Subject',
        subjectCode: sub ? sub.code : '???',
        presentCount,
        totalCount,
        canEdit,
        roster: h.roster
      };
    });

    return { success: true, data: enriched.sort((a, b) => b.date.localeCompare(a.date)) };
  }

  // -- STUDENT EXCLUSIVE ROUTE --
  if (endpoint === '/student/attendance' && method === 'GET') {
    const userId = currUser.id;
    const history = getDB('sat_attendance_history') || [];
    const subjects = getDB('sat_subjects') || [];
    const users = getDB('sat_users') || [];

    // Student data filter
    const stdUser = users.find(u => u.id === userId);
    if (!stdUser) return { success: false, error: 'Student not found.' };

    const mySubjects = subjects.filter(sub => sub.department === stdUser.department && sub.semester === stdUser.semester);

    const subjectBreakdown = {};
    mySubjects.forEach(s => {
      subjectBreakdown[s.id] = {
        subjectId: s.id,
        name: s.name,
        code: s.code,
        facultyName: 'Prof. ' + (users.find(u => u.subjects && u.subjects.includes(s.id))?.name || 'TBD').replace('Prof. ', '').replace('Dr. ', ''),
        attended: 0,
        missed: 0,
        leave: 0,
        total: 0,
        historyLog: [] // dates, statuses
      };
    });

    history.forEach(log => {
      const studentStatus = log.roster ? log.roster[userId] : null;
      if (studentStatus) {
        const breakdown = subjectBreakdown[log.subjectId];
        if (breakdown) {
          breakdown.total++;
          if (studentStatus === 'present') {
            breakdown.attended++;
          } else if (studentStatus === 'leave') {
            breakdown.leave++;
            // count Leave as neither present nor absolute missed depending on system, 
            // for clean reports let's treat attending score as attended / total
          } else {
            breakdown.missed++;
          }

          breakdown.historyLog.push({
            date: log.date,
            status: studentStatus,
            period: log.period
          });
        }
      }
    });

    const finalBreakdown = Object.values(subjectBreakdown).map(sb => {
      const pct = sb.total > 0 ? Math.round((sb.attended / sb.total) * 1000) / 10 : 0;
      return {
        ...sb,
        percentage: pct,
        historyLog: sb.historyLog.sort((a, b) => b.date.localeCompare(a.date))
      };
    });

    // Compute weekly trend
    // Let's bucket details into weeks
    // Sort all history logs that belong to the student
    const allStudLogs = [];
    history.forEach(log => {
      if (log.semester === stdUser.semester && log.roster && log.roster[userId]) {
        allStudLogs.push({ date: log.date, status: log.roster[userId] });
      }
    });

    allStudLogs.sort((a, b) => a.date.localeCompare(b.date));

    // Group into chunks of 5 days (representing 1 study week)
    const weeklyTrend = [];
    const chunkSize = 15; // roughly 15 lectures per week
    for (let c = 0; c < allStudLogs.length; c += chunkSize) {
      const chunk = allStudLogs.slice(0, c + chunkSize);
      const attCount = chunk.filter(l => l.status === 'present').length;
      weeklyTrend.push({
        week: `Wk ${Math.floor(c / chunkSize) + 1}`,
        percentage: Math.round((attCount / chunk.length) * 100)
      });
    }

    // Default trends if empty
    if (weeklyTrend.length === 0) {
      weeklyTrend.push({ week: 'Wk 1', percentage: 90 }, { week: 'Wk 2', percentage: 84 }, { week: 'Wk 3', percentage: 78 });
    }

    // Compute global percent
    let totalClasses = 0;
    let attendedClasses = 0;
    let missedClasses = 0;
    let leaveClasses = 0;

    finalBreakdown.forEach(item => {
      totalClasses += item.total;
      attendedClasses += item.attended;
      missedClasses += item.missed;
      leaveClasses += item.leave;
    });

    const overallPercentage = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 1000) / 10 : 0;

    return {
      success: true,
      data: {
        studentInfo: {
          id: stdUser.id,
          name: stdUser.name,
          rollNumber: stdUser.rollNumber,
          department: stdUser.department,
          semester: stdUser.semester,
          division: stdUser.division
        },
        stats: {
          totalClasses,
          attendedClasses,
          missedClasses,
          leaveClasses,
          overallPercentage
        },
        subjectBreakdown: finalBreakdown,
        weeklyTrend
      }
    };
  }

  // Student schedule (timetable)
  if (endpoint === '/student/timetable' && method === 'GET') {
    const timetable = getDB('sat_timetable') || [];
    const subjects = getDB('sat_subjects') || [];
    const users = getDB('sat_users') || [];

    const stdClasses = timetable.filter(c => c.department === currUser.department && c.semester === currUser.semester && c.division === currUser.division);

    const result = stdClasses.map(cell => {
      const subInfo = subjects.find(s => s.id === cell.subjectId);
      const facInfo = users.find(u => u.id === cell.facultyId);
      return {
        id: cell.id,
        day: cell.day,
        period: cell.period,
        room: cell.room,
        subject: subInfo ? { name: subInfo.name, code: subInfo.code } : null,
        facultyName: facInfo ? facInfo.name : 'Unknown Faculty'
      };
    });

    return { success: true, data: result };
  }

  // Fallback 404 for mock endpoints
  return { success: false, error: `Mock endpoint path ${endpoint} with method ${method} not implemented.` };
}
