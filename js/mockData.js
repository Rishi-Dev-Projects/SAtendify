// SAtendify Mock Database Initializer and LocalStorage Sync

const DEPARTMENTS = ['IT', 'CE', 'ME', 'CH', 'EE'];
const SEMESTERS = [1, 2, 3, 4, 5, 6];
const DIVISIONS = ['A', 'B'];

const SUBJECTS_DATA = [
  // IT Sem 3
  { id: 'sub-it3-di03016011', name: 'Data Structures & Algorithms', code: 'DI03016011', department: 'IT', semester: 3, facultyId: 'usr-fac-1' },
  { id: 'sub-it3-di03016021', name: 'Object-Oriented Programming (Java)', code: 'DI03016021', department: 'IT', semester: 3, facultyId: 'usr-fac-2' },
  { id: 'sub-it3-di03016031', name: 'Database Management Systems', code: 'DI03016031', department: 'IT', semester: 3, facultyId: 'usr-fac-3' },
  { id: 'sub-it3-di03016041', name: 'Digital Electronics & Logic Design', code: 'DI03016041', department: 'IT', semester: 3, facultyId: 'usr-fac-4' },
  { id: 'sub-it3-di03016051', name: 'Computer Networks & Operating Systems', code: 'DI03016051', department: 'IT', semester: 3, facultyId: 'usr-hod-it' },

  // IT Sem 4
  { id: 'sub-it4-dbms', name: 'Database Management Systems', code: 'IT401', department: 'IT', semester: 4 },
  { id: 'sub-it4-cn', name: 'Computer Networks', code: 'IT402', department: 'IT', semester: 4 },
  { id: 'sub-it4-wad', name: 'Web Application Development', code: 'IT403', department: 'IT', semester: 4 },
  { id: 'sub-it4-se', name: 'Software Engineering', code: 'IT404', department: 'IT', semester: 4 },
  { id: 'sub-it4-os', name: 'Operating Systems', code: 'IT405', department: 'IT', semester: 4 },
  
  // CE Sem 4
  { id: 'sub-ce4-daa', name: 'Design & Analysis of Algorithms', code: 'CE401', department: 'CE', semester: 4 },
  { id: 'sub-ce4-mp', name: 'Microprocessors', code: 'CE402', department: 'CE', semester: 4 },
  { id: 'sub-ce4-dbms', name: 'Database Systems', code: 'CE403', department: 'CE', semester: 4 },
  { id: 'sub-ce4-os', name: 'Operating Systems', code: 'CE404', department: 'CE', semester: 4 },
  
  // ME Sem 4
  { id: 'sub-me4-tom', name: 'Theory of Machines', code: 'ME401', department: 'ME', semester: 4 },
  { id: 'sub-me4-ms', name: 'Material Science', code: 'ME402', department: 'ME', semester: 4 },
  { id: 'sub-me4-mt', name: 'Manufacturing Technology', code: 'ME403', department: 'ME', semester: 4 },

  // IT Sem 6
  { id: 'sub-it6-cloud', name: 'Cloud Computing & Security', code: 'IT601', department: 'IT', semester: 6 },
  { id: 'sub-it6-ml', name: 'Machine Learning Basics', code: 'IT602', department: 'IT', semester: 6 },
  { id: 'sub-it6-iot', name: 'Internet of Things', code: 'IT603', department: 'IT', semester: 6 }
];

const USERS_DATA = [
  // Admin
  { id: 'usr-admin', email: 'admin@satendify.edu', role: 'admin', name: 'Dr. Ramesh Mehta', department: null },

  // HODs
  { id: 'usr-hod-it', email: 'hod.it@satendify.edu', role: 'hod', name: 'Prof. Sunita Sharma', department: 'IT' },
  { id: 'usr-hod-ce', email: 'hod.ce@satendify.edu', role: 'hod', name: 'Prof. Anil Varma', department: 'CE' },

  // Faculty (IT Department)
  { id: 'usr-fac-1', email: 'fac.dbms@satendify.edu', role: 'faculty', name: 'Dr. Alok Patel', department: 'IT', subjects: ['sub-it4-dbms'] },
  { id: 'usr-fac-2', email: 'fac.cn@satendify.edu', role: 'faculty', name: 'Prof. Ritu Shah', department: 'IT', subjects: ['sub-it4-cn', 'sub-it6-cloud'] },
  { id: 'usr-fac-3', email: 'fac.wad@satendify.edu', role: 'faculty', name: 'Prof. Jaydeep Trivedi', department: 'IT', subjects: ['sub-it4-wad'] },
  { id: 'usr-fac-4', email: 'fac.se@satendify.edu', role: 'faculty', name: 'Dr. Namrata Joshi', department: 'IT', subjects: ['sub-it4-se', 'sub-it4-os'] },

  // Students (IT Department, Sem 4, Div A)
  { id: 'usr-std-1', role: 'student', name: 'Aarav Patel', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT001', dob: '15082004' },
  { id: 'usr-std-2', role: 'student', name: 'Diya Sharma', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT002', dob: '12032005' },
  { id: 'usr-std-3', role: 'student', name: 'Kabir Sengupta', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT003', dob: '22112004' },
  { id: 'usr-std-4', role: 'student', name: 'Isha Deshmukh', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT004', dob: '05012005' },
  { id: 'usr-std-5', role: 'student', name: 'Rohan Malhotra', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT005', dob: '19092004' },
  { id: 'usr-std-6', role: 'student', name: 'Ananya Roy', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT006', dob: '30072005' },
  { id: 'usr-std-7', role: 'student', name: 'Dev Joshi', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT007', dob: '14022004' },
  { id: 'usr-std-8', role: 'student', name: 'Meera Iyer', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT008', dob: '08102004' },
  { id: 'usr-std-9', role: 'student', name: 'Vivaan Saxena', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT009', dob: '25122004' },
  { id: 'usr-std-10', role: 'student', name: 'Sneha Kulkarni', department: 'IT', semester: 4, division: 'A', rollNumber: '23IT010', dob: '11052005' },

  // Students (IT Department, Sem 3 - Batch 251)
  { id: 'student-256370316001', role: 'student', name: 'Aarav Sharma', department: 'IT', semester: 3, division: '251', rollNumber: '256370316001', dob: '01012006' },
  { id: 'student-256370316002', role: 'student', name: 'Aditya Verma', department: 'IT', semester: 3, division: '251', rollNumber: '256370316002', dob: '01012006' },
  { id: 'student-256370316003', role: 'student', name: 'Akshat Mehta', department: 'IT', semester: 3, division: '251', rollNumber: '256370316003', dob: '01012006' },
  { id: 'student-256370316004', role: 'student', name: 'Ananya Joshi', department: 'IT', semester: 3, division: '251', rollNumber: '256370316004', dob: '01012006' },
  { id: 'student-256370316005', role: 'student', name: 'Aryan Patel', department: 'IT', semester: 3, division: '251', rollNumber: '256370316005', dob: '01012006' },
  { id: 'student-256370316006', role: 'student', name: 'Bhavya Shah', department: 'IT', semester: 3, division: '251', rollNumber: '256370316006', dob: '01012006' },
  { id: 'student-256370316007', role: 'student', name: 'Chirag Desai', department: 'IT', semester: 3, division: '251', rollNumber: '256370316007', dob: '01012006' },
  { id: 'student-256370316008', role: 'student', name: 'Devanshi Dave', department: 'IT', semester: 3, division: '251', rollNumber: '256370316008', dob: '01012006' },
  { id: 'student-256370316009', role: 'student', name: 'Dhruv Trivedi', department: 'IT', semester: 3, division: '251', rollNumber: '256370316009', dob: '01012006' },
  { id: 'student-256370316010', role: 'student', name: 'Harshil Soni', department: 'IT', semester: 3, division: '251', rollNumber: '256370316010', dob: '01012006' },
  { id: 'student-256370316011', role: 'student', name: 'Ishita Bhatt', department: 'IT', semester: 3, division: '251', rollNumber: '256370316011', dob: '01012006' },
  { id: 'student-256370316012', role: 'student', name: 'Jay Solanki', department: 'IT', semester: 3, division: '251', rollNumber: '256370316012', dob: '01012006' },
  { id: 'student-256370316013', role: 'student', name: 'Khushi Panchal', department: 'IT', semester: 3, division: '251', rollNumber: '256370316013', dob: '01012006' },
  { id: 'student-256370316014', role: 'student', name: 'Manav Parmar', department: 'IT', semester: 3, division: '251', rollNumber: '256370316014', dob: '01012006' },
  { id: 'student-256370316015', role: 'student', name: 'Meet Prajapati', department: 'IT', semester: 3, division: '251', rollNumber: '256370316015', dob: '01012006' },

  // Students (IT Department, Sem 3 - Batch 252)
  { id: 'student-256370316016', role: 'student', name: 'Neha Rathod', department: 'IT', semester: 3, division: '252', rollNumber: '256370316016', dob: '01012006' },
  { id: 'student-256370316017', role: 'student', name: 'Nishant Rawal', department: 'IT', semester: 3, division: '252', rollNumber: '256370316017', dob: '01012006' },
  { id: 'student-256370316018', role: 'student', name: 'Omkar Chauhan', department: 'IT', semester: 3, division: '252', rollNumber: '256370316018', dob: '01012006' },
  { id: 'student-256370316019', role: 'student', name: 'Prachi Vaghela', department: 'IT', semester: 3, division: '252', rollNumber: '256370316019', dob: '01012006' },
  { id: 'student-256370316020', role: 'student', name: 'Pranav Makwana', department: 'IT', semester: 3, division: '252', rollNumber: '256370316020', dob: '01012006' },
  { id: 'student-256370316021', role: 'student', name: 'Priya Jani', department: 'IT', semester: 3, division: '252', rollNumber: '256370316021', dob: '01012006' },
  { id: 'student-256370316022', role: 'student', name: 'Rahul Barot', department: 'IT', semester: 3, division: '252', rollNumber: '256370316022', dob: '01012006' },
  { id: 'student-256370316023', role: 'student', name: 'Riya Goswami', department: 'IT', semester: 3, division: '252', rollNumber: '256370316023', dob: '01012006' },
  { id: 'student-256370316024', role: 'student', name: 'Sahil Kothari', department: 'IT', semester: 3, division: '252', rollNumber: '256370316024', dob: '01012006' },
  { id: 'student-256370316025', role: 'student', name: 'Sakshi Pandya', department: 'IT', semester: 3, division: '252', rollNumber: '256370316025', dob: '01012006' },
  { id: 'student-256370316026', role: 'student', name: 'Shivam Modi', department: 'IT', semester: 3, division: '252', rollNumber: '256370316026', dob: '01012006' },
  { id: 'student-256370316027', role: 'student', name: 'Tanvi Shukla', department: 'IT', semester: 3, division: '252', rollNumber: '256370316027', dob: '01012006' },
  { id: 'student-256370316028', role: 'student', name: 'Tirth Thakkar', department: 'IT', semester: 3, division: '252', rollNumber: '256370316028', dob: '01012006' },
  { id: 'student-256370316029', role: 'student', name: 'Yashvi Doshi', department: 'IT', semester: 3, division: '252', rollNumber: '256370316029', dob: '01012006' },
  { id: 'student-256370316030', role: 'student', name: 'Yuvraj Jadeja', department: 'IT', semester: 3, division: '252', rollNumber: '256370316030', dob: '01012006' }
];

const PERIOD_SLOTS = [
  { index: 1, time: '09:00 AM - 10:00 AM', triggerTime: '09:00' },
  { index: 2, time: '10:00 AM - 11:00 AM', triggerTime: '10:00' },
  { index: 3, time: '11:15 AM - 12:15 PM', triggerTime: '11:15' },
  { index: 4, time: '01:00 PM - 02:00 PM', triggerTime: '13:00' },
  { index: 5, time: '02:00 PM - 03:00 PM', triggerTime: '14:00' }
];

// Timetable schema: Mon-Fri, Periods 1-5
const TIMETABLE_DATA = [
  // IT Sem 4 Div A Weekly schedule
  { id: 'tt-1', department: 'IT', semester: 4, division: 'A', day: 'Monday', period: 1, subjectId: 'sub-it4-dbms', facultyId: 'usr-fac-1', room: 'Lab 101' },
  { id: 'tt-2', department: 'IT', semester: 4, division: 'A', day: 'Monday', period: 2, subjectId: 'sub-it4-os', facultyId: 'usr-fac-4', room: 'Classroom 302' },
  { id: 'tt-3', department: 'IT', semester: 4, division: 'A', day: 'Monday', period: 3, subjectId: 'sub-it4-wad', facultyId: 'usr-fac-3', room: 'Lab 103' },
  
  { id: 'tt-4', department: 'IT', semester: 4, division: 'A', day: 'Tuesday', period: 1, subjectId: 'sub-it4-cn', facultyId: 'usr-fac-2', room: 'Classroom 301' },
  { id: 'tt-5', department: 'IT', semester: 4, division: 'A', day: 'Tuesday', period: 2, subjectId: 'sub-it4-dbms', facultyId: 'usr-fac-1', room: 'Lab 101' },
  { id: 'tt-6', department: 'IT', semester: 4, division: 'A', day: 'Tuesday', period: 3, subjectId: 'sub-it4-se', facultyId: 'usr-fac-4', room: 'Classroom 302' },

  { id: 'tt-7', department: 'IT', semester: 4, division: 'A', day: 'Wednesday', period: 2, subjectId: 'sub-it4-wad', facultyId: 'usr-fac-3', room: 'Lab 103' },
  { id: 'tt-8', department: 'IT', semester: 4, division: 'A', day: 'Wednesday', period: 3, subjectId: 'sub-it4-cn', facultyId: 'usr-fac-2', room: 'Classroom 301' },
  { id: 'tt-9', department: 'IT', semester: 4, division: 'A', day: 'Wednesday', period: 4, subjectId: 'sub-it4-os', facultyId: 'usr-fac-4', room: 'Classroom 302' },

  { id: 'tt-10', department: 'IT', semester: 4, division: 'A', day: 'Thursday', period: 1, subjectId: 'sub-it4-se', facultyId: 'usr-fac-4', room: 'Classroom 302' },
  { id: 'tt-11', department: 'IT', semester: 4, division: 'A', day: 'Thursday', period: 3, subjectId: 'sub-it4-dbms', facultyId: 'usr-fac-1', room: 'Lab 101' },
  { id: 'tt-12', department: 'IT', semester: 4, division: 'A', day: 'Thursday', period: 4, subjectId: 'sub-it4-cn', facultyId: 'usr-fac-2', room: 'Classroom 301' },

  { id: 'tt-13', department: 'IT', semester: 4, division: 'A', day: 'Friday', period: 1, subjectId: 'sub-it4-wad', facultyId: 'usr-fac-3', room: 'Lab 103' },
  { id: 'tt-14', department: 'IT', semester: 4, division: 'A', day: 'Friday', period: 2, subjectId: 'sub-it4-se', facultyId: 'usr-fac-4', room: 'Classroom 321' },
  { id: 'tt-15', department: 'IT', semester: 4, division: 'A', day: 'Friday', period: 5, subjectId: 'sub-it4-dbms', facultyId: 'usr-fac-1', room: 'Lab 101' }
];

// Helper to seed dynamic attendance history (for reports & visual charts)
function generateMockAttendanceHistory() {
  const history = [];
  const students = USERS_DATA.filter(u => u.role === 'student' && u.department === 'IT' && u.semester === 4);
  const subjects = SUBJECTS_DATA.filter(s => s.department === 'IT' && s.semester === 4);
  
  // Seed dates: go back 6 weeks
  const today = new Date();
  const daysOfSemester = 30; // 30 study days (excluding weekends)
  let dateCounter = new Date(today);
  dateCounter.setDate(today.getDate() - 40); // start 40 days ago

  let attendanceIdCounter = 1;
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let i = 0; i < daysOfSemester; i++) {
    // Increment date and skip weekends
    dateCounter.setDate(dateCounter.getDate() + 1);
    while (dateCounter.getDay() === 0 || dateCounter.getDay() === 6) {
      dateCounter.setDate(dateCounter.getDate() + 1);
    }

    const dayName = daysOfWeek[dateCounter.getDay()];
    const dateFormatted = dateCounter.toISOString().split('T')[0];

    // Find classes scheduled on this dayName in timetable
    const scheduledClasses = TIMETABLE_DATA.filter(tt => tt.day === dayName);

    scheduledClasses.forEach(c => {
      // Don't generate mock data for classes occurring after today's date/time
      const classDateTime = new Date(`${dateFormatted}T${PERIOD_SLOTS[c.period - 1].triggerTime}:00`);
      if (classDateTime > today) return;

      const rosterStatus = {};
      
      students.forEach(std => {
        // Randomly assign: 80% Present, 15% Absent, 5% Leave
        const rand = Math.random();
        // Give certain students lower attendance patterns
        let isProneToAbsent = std.rollNumber === '23IT003' || std.rollNumber === '23IT007'; // Aarav/Kabir/Dev Joshi
        
        let presentProb = isProneToAbsent ? 0.68 : 0.88;

        if (rand < presentProb) {
          rosterStatus[std.id] = 'present';
        } else if (rand < presentProb + 0.08) {
          rosterStatus[std.id] = 'leave';
        } else {
          rosterStatus[std.id] = 'absent';
        }
      });

      // Special case: make sure we leave today's corresponding slot unfilled (or filled) if it's past
      // This allows the teacher to take it.
      // If the class is today's current/upcoming slot, we DO NOT populate history so the user can submit it
      const todayFormatted = today.toISOString().split('T')[0];
      if (dateFormatted === todayFormatted) {
        // don't prefill matches if we want them to show as "Take Attendance"
        // Let's only prefill slot 1, but leave slot 2/3 for today empty so they can test it.
        if (c.period > 1) {
          return;
        }
      }

      history.push({
        id: `att-hist-${attendanceIdCounter++}`,
        timetableId: c.id,
        subjectId: c.subjectId,
        date: dateFormatted,
        semester: c.semester,
        division: c.division,
        period: c.period,
        facultyId: c.facultyId,
        roster: rosterStatus
      });
    });
  }

  return history;
}

export function initDatabase() {
  if (!localStorage.getItem('sat_db_initialized')) {
    localStorage.setItem('sat_depts', JSON.stringify(DEPARTMENTS));
    localStorage.setItem('sat_semesters', JSON.stringify(SEMESTERS));
    localStorage.setItem('sat_divisions', JSON.stringify(DIVISIONS));
    localStorage.setItem('sat_subjects', JSON.stringify(SUBJECTS_DATA));
    localStorage.setItem('sat_users', JSON.stringify(USERS_DATA));
    localStorage.setItem('sat_timetable', JSON.stringify(TIMETABLE_DATA));
    localStorage.setItem('sat_attendance_history', JSON.stringify(generateMockAttendanceHistory()));
    localStorage.setItem('sat_slots', JSON.stringify(PERIOD_SLOTS));
    
    // Set a flag to not reseed on reload
    localStorage.setItem('sat_db_initialized', 'true');
  }
}

export function getDB(key) {
  initDatabase();
  return JSON.parse(localStorage.getItem(key));
}

export function setDB(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
