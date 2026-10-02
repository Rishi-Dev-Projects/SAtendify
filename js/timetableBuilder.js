// SAtendify - Academic Timetable Generator & Criteria Builder Module
import { apiFetch, showToast } from './api.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIOD_TIMES = [
  { num: 1, time: '10:00 - 10:55', label: 'Period 1' },
  { num: 2, time: '11:00 - 11:55', label: 'Period 2' },
  { num: 3, time: '11:55 - 12:50', label: 'Period 3' },
  { num: 4, time: '01:20 - 02:15', label: 'Period 4' },
  { num: 5, time: '02:15 - 03:10', label: 'Period 5' },
  { num: 6, time: '03:20 - 04:15', label: 'Period 6' },
  { num: 7, time: '04:15 - 05:10', label: 'Period 7' }
];

// Contiguous 2-period blocks allowed for Labs / Tutorials (cannot span lunch recess between P3 & P4)
const LAB_PERIOD_BLOCKS = [
  [1, 2], // Morning
  [4, 5], // Afternoon
  [6, 7]  // Late Afternoon
];

const DEFAULT_CLASSROOMS = ['Room 301', 'Room 302', 'Room 303', 'Room 304'];
const DEFAULT_LAB_ROOMS = ['Lab 101', 'Lab 102', 'IoT Lab', 'AI Research Lab'];

// Helper to compute batch names for an academic semester
export function getBatchNamesForSemester(sem, batchCount = 2) {
  const enrollmentYear = 2026 - Math.floor((sem - 1) / 2);
  const yearSuffix = String(enrollmentYear % 100).padStart(2, '0');
  const batches = [];
  for (let i = 1; i <= batchCount; i++) {
    batches.push(`${yearSuffix}${i}`);
  }
  return batches;
}

/**
 * Intelligent Timetable Constraint Solver
 * Generates a conflict-free schedule matching user criteria
 */
export function generateTimetableSchedule(criteriaList, batches, options = {}) {
  const seed = options.seed || Math.random();
  const days = options.days || DAYS;
  const maxPerDay = options.maxPerDay || 1;

  // Track occupancy
  // occupancy[day][period] = { wholeClass: boolean, batches: Set<string> }
  const occupancy = {};
  const facultyBusy = {}; // facultyBusy[facId][day][period] = boolean
  const roomBusy = {};    // roomBusy[room][day][period] = boolean
  const subDayLectures = {}; // subDayLectures[subId][day] = count

  days.forEach(d => {
    occupancy[d] = {};
    for (let p = 1; p <= 7; p++) {
      occupancy[d][p] = { wholeClass: false, batches: new Set() };
    }
  });

  const slots = [];
  const conflicts = [];

  // Helper shuffle with pseudo-random seed
  function pseudoShuffle(arr, salt = 0) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(((seed * (i + 1) * 9301 + salt * 49297) % 233280) / 233280 * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Helper to test if slot block is completely free for a lab batch
  function isLabSlotFree(day, startPeriod, batch, facId, room) {
    for (let p = startPeriod; p < startPeriod + 2; p++) {
      if (occupancy[day][p].wholeClass) return false;
      if (occupancy[day][p].batches.has(batch)) return false;
      if (facId && facultyBusy[facId]?.[day]?.[p]) return false;
      if (room && roomBusy[room]?.[day]?.[p]) return false;
    }
    return true;
  }

  // Helper to book a lab slot
  function bookLabSlot(day, startPeriod, batch, facId, room, subItem) {
    for (let p = startPeriod; p < startPeriod + 2; p++) {
      occupancy[day][p].batches.add(batch);
      if (facId) {
        if (!facultyBusy[facId]) facultyBusy[facId] = {};
        if (!facultyBusy[facId][day]) facultyBusy[facId][day] = {};
        facultyBusy[facId][day][p] = true;
      }
      if (room) {
        if (!roomBusy[room]) roomBusy[room] = {};
        if (!roomBusy[room][day]) roomBusy[room][day] = {};
        roomBusy[room][day][p] = true;
      }
    }
    slots.push({
      subjectId: subItem.id,
      subjectCode: subItem.code,
      subjectName: subItem.name,
      facultyId: facId,
      room: room,
      day: day,
      period: startPeriod,
      duration: 2,
      type: 'lab',
      division: batch
    });
  }

  // Helper to test if a period is free for Whole Class lecture
  function isLectureSlotFree(day, period, facId, room, subId) {
    if (occupancy[day][period].wholeClass) return false;
    if (occupancy[day][period].batches.size > 0) return false;
    if (facId && facultyBusy[facId]?.[day]?.[period]) return false;
    if (room && roomBusy[room]?.[day]?.[period]) return false;
    if ((subDayLectures[subId]?.[day] || 0) >= maxPerDay) return false;
    return true;
  }

  // Helper to book a lecture slot
  function bookLectureSlot(day, period, facId, room, subItem) {
    occupancy[day][period].wholeClass = true;
    batches.forEach(b => occupancy[day][period].batches.add(b));

    if (facId) {
      if (!facultyBusy[facId]) facultyBusy[facId] = {};
      if (!facultyBusy[facId][day]) facultyBusy[facId][day] = {};
      facultyBusy[facId][day][period] = true;
    }
    if (room) {
      if (!roomBusy[room]) roomBusy[room] = {};
      if (!roomBusy[room][day]) roomBusy[room][day] = {};
      roomBusy[room][day][period] = true;
    }

    if (!subDayLectures[subItem.id]) subDayLectures[subItem.id] = {};
    subDayLectures[subItem.id][day] = (subDayLectures[subItem.id][day] || 0) + 1;

    slots.push({
      subjectId: subItem.id,
      subjectCode: subItem.code,
      subjectName: subItem.name,
      facultyId: facId,
      room: room,
      day: day,
      period: period,
      duration: 1,
      type: 'lecture',
      division: 'ALL'
    });
  }

  // ==========================================
  // PHASE 1: SCHEDULE PRACTICAL LABS (2 contiguous periods)
  // ==========================================
  const labSubjects = criteriaList.filter(s => s.hasLab);
  let saltCounter = 1;

  labSubjects.forEach(subItem => {
    batches.forEach((batch, bIdx) => {
      let placed = false;
      const shuffledDays = pseudoShuffle(days, saltCounter++);
      const shuffledBlocks = pseudoShuffle(LAB_PERIOD_BLOCKS, saltCounter++);

      // Assign room for batch (use distinct room if parallel)
      const labRoom = subItem.labRoom || DEFAULT_LAB_ROOMS[bIdx % DEFAULT_LAB_ROOMS.length];
      const facId = subItem.facultyId;

      for (const d of shuffledDays) {
        for (const block of shuffledBlocks) {
          const startP = block[0];
          if (isLabSlotFree(d, startP, batch, facId, labRoom)) {
            bookLabSlot(d, startP, batch, facId, labRoom, subItem);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }

      if (!placed) {
        conflicts.push(`Could not place lab session for ${subItem.code} (${subItem.name}) - Batch ${batch}`);
      }
    });
  });

  // ==========================================
  // PHASE 2: SCHEDULE WHOLE-CLASS LECTURES (1 period each)
  // ==========================================
  const lectureSubjects = criteriaList.filter(s => s.lectureCount > 0);

  // Preferred lecture periods: P2, P3, P4, P5, then P1, P6, P7
  const preferredLecturePeriods = [2, 3, 4, 5, 1, 6, 7];

  lectureSubjects.forEach(subItem => {
    const needed = subItem.lectureCount;
    let placedCount = 0;

    // First pass: try with strict maxPerDay limit
    const shuffledDays = pseudoShuffle(days, saltCounter++);
    for (const d of shuffledDays) {
      if (placedCount >= needed) break;
      const shuffledPeriods = pseudoShuffle(preferredLecturePeriods, saltCounter++);
      for (const p of shuffledPeriods) {
        const classroom = subItem.classroom || DEFAULT_CLASSROOMS[0];
        const facId = subItem.facultyId;
        if (isLectureSlotFree(d, p, facId, classroom, subItem.id)) {
          bookLectureSlot(d, p, facId, classroom, subItem);
          placedCount++;
          break;
        }
      }
    }

    // Second pass: if needed lectures remain, relax maxPerDay constraint
    if (placedCount < needed) {
      for (const d of days) {
        if (placedCount >= needed) break;
        for (const p of preferredLecturePeriods) {
          const classroom = subItem.classroom || DEFAULT_CLASSROOMS[0];
          const facId = subItem.facultyId;
          if (!occupancy[d][p].wholeClass && occupancy[d][p].batches.size === 0) {
            if (!facultyBusy[facId]?.[d]?.[p] && !roomBusy[classroom]?.[d]?.[p]) {
              bookLectureSlot(d, p, facId, classroom, subItem);
              placedCount++;
              if (placedCount >= needed) break;
            }
          }
        }
      }
    }

    if (placedCount < needed) {
      conflicts.push(`Could only place ${placedCount}/${needed} lectures for ${subItem.code} (${subItem.name})`);
    }
  });

  // Sort slots by Day and Period
  const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
  slots.sort((a, b) => {
    const dDiff = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
    if (dDiff !== 0) return dDiff;
    return a.period - b.period;
  });

  // Metrics summary
  const lectureSlots = slots.filter(s => s.type === 'lecture').length;
  const labSlots = slots.filter(s => s.type === 'lab').length;
  const totalOccupiedPeriods = slots.reduce((sum, s) => sum + (s.duration || 1), 0);
  const totalGridSlots = days.length * 7;
  const utilization = Math.round((totalOccupiedPeriods / totalGridSlots) * 100);

  return {
    slots,
    metrics: {
      totalSessions: slots.length,
      lectureSessions: lectureSlots,
      labSessions: labSlots,
      totalOccupiedPeriods,
      utilization,
      conflictsCount: conflicts.length,
      conflicts
    }
  };
}

/**
 * Opens the Timetable Generator Studio Modal
 */
/**
 * Opens the Timetable Generator Studio Modal
 */
export async function openTimetableBuilderStudio({ department, semester, batches, subjects, facultyList, onApplied, initialTab = 'criteria' }) {
  let currentSem = semester || 5;
  let currentBatchesCount = batches ? batches.length : 2;
  let currentBatches = getBatchNamesForSemester(currentSem, currentBatchesCount);
  let activeTab = initialTab; // 'criteria' | 'preview' | 'syllabus'

  // GTU Syllabus Parsing State
  let selectedSyllabusFiles = [];
  let isParsingSyllabus = false;
  let parsedSyllabusSubjects = [];
  let parsedMetadata = null;
  let syllabusParsingError = null;

  // Filter subjects for department & semester
  let eligibleSubjects = subjects.filter(s => s.department === department && s.semester === currentSem);
  let eligibleFaculty = facultyList.filter(u => (u.role === 'faculty' || u.role === 'hod') && u.department === department);

  // Initialize criteria model with smart mock defaults
  let criteriaList = eligibleSubjects.map((sub, idx) => {
    const isProjectOrSkill = sub.name.toLowerCase().includes('project') || sub.name.toLowerCase().includes('training') || sub.name.toLowerCase().includes('skill');
    const isPractical = isProjectOrSkill || sub.name.toLowerCase().includes('programming') || sub.name.toLowerCase().includes('ai') || sub.name.toLowerCase().includes('iot') || sub.name.toLowerCase().includes('cloud') || sub.name.toLowerCase().includes('database') || sub.name.toLowerCase().includes('cad');

    return {
      id: sub.id,
      code: sub.code || `SUB${sub.semester}0${idx + 1}`,
      name: sub.name,
      facultyId: sub.facultyId || (eligibleFaculty[idx % eligibleFaculty.length]?.id || ''),
      lectureCount: isProjectOrSkill ? 2 : 3,
      hasLab: isPractical,
      classroom: DEFAULT_CLASSROOMS[idx % DEFAULT_CLASSROOMS.length],
      labRoom: DEFAULT_LAB_ROOMS[idx % DEFAULT_LAB_ROOMS.length]
    };
  });

  let generatedResult = null;
  let randomSeed = Math.random();

  function runGeneration() {
    generatedResult = generateTimetableSchedule(criteriaList, currentBatches, { seed: randomSeed });
  }

  // Pre-generate once so preview is ready immediately
  runGeneration();

  function renderStudioHTML() {
    const totalRequiredLectures = criteriaList.reduce((acc, c) => acc + (parseInt(c.lectureCount) || 0), 0);
    const totalRequiredLabs = criteriaList.filter(c => c.hasLab).length * currentBatches.length * 2;
    const totalPeriodsNeeded = totalRequiredLectures + totalRequiredLabs;

    return `
      <div class="tt-studio-wrapper" style="display:flex; flex-direction:column; gap:16px;">
        <!-- Studio Header Controls -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color:white; padding:16px 20px; border-radius:var(--radius-lg); box-shadow:0 4px 14px rgba(30,27,75,0.25);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:rgba(255,255,255,0.2); color:#fff; font-size:0.75rem; text-transform:uppercase; font-weight:700;">Automatic Schedule Engine</span>
              <span class="badge badge-${department.toLowerCase()}" style="font-size:0.75rem; font-weight:700;">${department} Department</span>
            </div>
            <h3 style="margin:4px 0 2px 0; font-size:1.25rem; font-weight:800; color:#fff;">Timetable Generator Studio</h3>
            <p style="font-size:0.8rem; margin:0; opacity:0.85;">Automatically generate conflict-free schedules with whole-class lectures, batch labs, and GTU syllabus import.</p>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="text-align:right;">
              <div style="font-size:0.7rem; text-transform:uppercase; opacity:0.8;">Semester</div>
              <strong style="font-size:1.1rem; color:#fff;">Semester ${currentSem}</strong>
            </div>
            <div style="background:rgba(255,255,255,0.15); padding:6px 12px; border-radius:var(--radius-md); font-size:0.8rem;">
              Batches: <strong>${currentBatches.join(', ')}</strong>
            </div>
          </div>
        </div>

        <!-- Studio Navigation Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--border-color); padding-bottom:8px; gap:12px; flex-wrap:wrap;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary ${activeTab === 'criteria' ? 'active' : ''}" id="btn-tab-criteria" style="font-weight:700; font-size:0.85rem; padding:6px 16px; border-radius:var(--radius-sm); display:inline-flex; align-items:center; gap:6px; ${activeTab === 'criteria' ? 'background:var(--color-accent); color:white;' : ''}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Criteria & Workload Rules (${criteriaList.length} Subjects)
            </button>
            <button type="button" class="btn btn-secondary ${activeTab === 'preview' ? 'active' : ''}" id="btn-tab-preview" style="font-weight:700; font-size:0.85rem; padding:6px 16px; border-radius:var(--radius-sm); display:inline-flex; align-items:center; gap:6px; ${activeTab === 'preview' ? 'background:var(--color-accent); color:white;' : ''}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Generated Grid Preview (${generatedResult?.slots?.length || 0} Slots)
            </button>
            <button type="button" class="btn btn-secondary ${activeTab === 'syllabus' ? 'active' : ''}" id="btn-tab-syllabus" style="font-weight:700; font-size:0.85rem; padding:6px 16px; border-radius:var(--radius-sm); display:inline-flex; align-items:center; gap:6px; ${activeTab === 'syllabus' ? 'background:var(--color-accent); color:white;' : ''}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              GTU Syllabus Extractor ${parsedSyllabusSubjects.length > 0 ? `(${parsedSyllabusSubjects.length})` : ''}
            </button>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn btn-secondary" id="btn-shuffle-seed" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:600;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Randomize Alternative
            </button>
            <button type="button" class="btn btn-primary" id="btn-run-generate" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:700; background:linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              Regenerate Schedule
            </button>
          </div>
        </div>

        <!-- TAB 1: CRITERIA & RULES -->
        <div id="studio-pane-criteria" style="display:${activeTab === 'criteria' ? 'block' : 'none'};">
          <!-- Summary Metrics Cards -->
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:16px;">
            <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 14px; text-align:center;">
              <span style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Weekly Lectures</span>
              <div style="font-size:1.3rem; font-weight:800; color:var(--color-accent);">${totalRequiredLectures} periods</div>
            </div>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:var(--radius-md); padding:10px 14px; text-align:center;">
              <span style="font-size:0.75rem; color:#166534; text-transform:uppercase; font-weight:600;">Weekly Labs</span>
              <div style="font-size:1.3rem; font-weight:800; color:#15803d;">${totalRequiredLabs} periods</div>
            </div>
            <div style="background:#fefce8; border:1px solid #fde047; border-radius:var(--radius-md); padding:10px 14px; text-align:center;">
              <span style="font-size:0.75rem; color:#854d0e; text-transform:uppercase; font-weight:600;">Total Weekly Hours</span>
              <div style="font-size:1.3rem; font-weight:800; color:#ca8a04;">${totalPeriodsNeeded} / 42 periods</div>
            </div>
            <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:var(--radius-md); padding:10px 14px; text-align:center;">
              <span style="font-size:0.75rem; color:#065f46; text-transform:uppercase; font-weight:600;">Grid Utilization</span>
              <div style="font-size:1.3rem; font-weight:800; color:#059669;">${Math.round((totalPeriodsNeeded / 42) * 100)}%</div>
            </div>
          </div>

          <!-- Subject Matrix Cards Table -->
          <div style="max-height:360px; overflow-y:auto; border:1px solid var(--border-color); border-radius:var(--radius-md); background:white;">
            <table class="custom-table" style="margin:0; font-size:0.85rem;">
              <thead style="position:sticky; top:0; background:#f1f5f9; z-index:2;">
                <tr>
                  <th style="width:30px;">#</th>
                  <th>Subject Details</th>
                  <th style="width:200px;">Assigned Faculty</th>
                  <th style="width:130px; text-align:center;">Lectures/Wk</th>
                  <th style="width:140px; text-align:center;">Practical Lab</th>
                  <th style="width:130px;">Classroom</th>
                  <th style="width:130px;">Lab Room</th>
                </tr>
              </thead>
              <tbody>
                ${criteriaList.map((c, idx) => `
                  <tr>
                    <td><strong>${idx + 1}</strong></td>
                    <td>
                      <div style="font-weight:700; color:var(--text-primary);">${c.name}</div>
                      <span class="badge badge-it" style="font-size:0.7rem; font-family:monospace;">${c.code}</span>
                    </td>
                    <td>
                      <select class="form-control crit-faculty-select" data-idx="${idx}" style="font-size:0.8rem; padding:4px 8px;">
                        ${eligibleFaculty.map(f => `<option value="${f.id}" ${f.id === c.facultyId ? 'selected' : ''}>${f.name.replace('Prof. ', '').replace('Dr. ', '')}</option>`).join('')}
                      </select>
                    </td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; align-items:center; gap:6px;">
                        <input type="number" class="form-control crit-lecture-input" data-idx="${idx}" value="${c.lectureCount}" min="0" max="6" style="width:60px; text-align:center; padding:4px;">
                        <span style="font-size:0.75rem; color:var(--text-muted);">hrs</span>
                      </div>
                    </td>
                    <td style="text-align:center;">
                      <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; font-size:0.8rem;">
                        <input type="checkbox" class="crit-lab-checkbox" data-idx="${idx}" ${c.hasLab ? 'checked' : ''}>
                        <span>2h Lab / Batch</span>
                      </label>
                    </td>
                    <td>
                      <input type="text" class="form-control crit-classroom-input" data-idx="${idx}" value="${c.classroom}" style="font-size:0.8rem; padding:4px 8px;">
                    </td>
                    <td>
                      <input type="text" class="form-control crit-labroom-input" data-idx="${idx}" value="${c.labRoom}" style="font-size:0.8rem; padding:4px 8px;">
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <p style="font-size:0.775rem; color:var(--text-secondary); margin-top:8px;">
            * Lectures automatically apply to <strong>Whole Class (all divisions)</strong>. Practical Labs schedule contiguous 2-period sessions for each batch (${currentBatches.join(', ')}) without teacher or room clashes.
          </p>
        </div>

        <!-- TAB 2: LIVE GRID PREVIEW -->
        <div id="studio-pane-preview" style="display:${activeTab === 'preview' ? 'block' : 'none'};">
          <!-- Validation Banner -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; border-radius:var(--radius-md); margin-bottom:12px; background:${generatedResult?.metrics?.conflictsCount === 0 ? '#f0fdf4; border:1px solid #bbf7d0;' : '#fef2f2; border:1px solid #fecaca;'}">
            <div style="display:flex; align-items:center; gap:10px;">
              ${generatedResult?.metrics?.conflictsCount === 0 ? 
                `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#22c55e; color:#fff; flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>` : 
                `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:#ef4444; color:#fff; flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></span>`
              }
              <strong style="color:${generatedResult?.metrics?.conflictsCount === 0 ? '#15803d' : '#dc2626'}; font-size:0.9rem;">
                ${generatedResult?.metrics?.conflictsCount === 0 ? `Conflict-Free Schedule Generated (${generatedResult.slots.length} Sessions across Mon-Sat)` : `${generatedResult.metrics.conflictsCount} Scheduling Conflicts Detected`}
              </strong>
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">
              Coverage: <strong>${generatedResult?.metrics?.utilization}% grid utilized</strong> &middot; 0 Room / Faculty Clashes
            </div>
          </div>

          <!-- Calendar Timetable Grid -->
          <div style="max-height:380px; overflow:auto; border:1px solid var(--border-color); border-radius:var(--radius-md); background:white;">
            <div class="timetable-grid" style="grid-template-columns: 80px repeat(6, 1fr); min-width:850px;">
              <div class="timetable-header-cell">Period</div>
              ${DAYS.map(d => `<div class="timetable-header-cell">${d}</div>`).join('')}

              ${PERIOD_TIMES.map(p => {
                let rowCellsHTML = `
                  <div class="timetable-row-header" style="padding:6px 4px;">
                    <strong>P${p.num}</strong>
                    <span style="font-size:0.6rem; font-weight:normal; display:block;">${p.time.split(' - ')[0]}</span>
                  </div>
                `;

                DAYS.forEach(day => {
                  // Find all slots spanning this period
                  const matchingSlots = (generatedResult?.slots || []).filter(s => {
                    const dur = s.duration || 1;
                    return s.day === day && p.num >= s.period && p.num < s.period + dur;
                  });

                  if (matchingSlots.length === 0) {
                    rowCellsHTML += `
                      <div class="timetable-cell empty-cell" style="background:#fafafa; border:none; display:flex; align-items:center; justify-content:center;">
                        <span style="color:var(--text-muted); font-size:0.7rem;">-</span>
                      </div>
                    `;
                  } else {
                    let cellContent = '';
                    matchingSlots.forEach(s => {
                      const isStart = s.period === p.num;
                      const fac = eligibleFaculty.find(f => f.id === s.facultyId);
                      const facName = fac ? fac.name.replace('Prof. ', '').replace('Dr. ', '') : 'Faculty';

                      if (isStart) {
                        const isLab = s.type === 'lab';
                        const badgeHTML = isLab 
                          ? `<span style="font-size:0.65rem; background:#dbeafe; color:#1e40af; padding:1px 4px; border-radius:3px;">Batch ${s.division}</span>`
                          : `<span style="font-size:0.65rem; background:#f1f5f9; color:#475569; padding:1px 4px; border-radius:3px;">Whole Class</span>`;

                        cellContent += `
                          <div style="background:${isLab ? '#f0fdf4' : 'var(--color-accent-subtle)'}; border-left:3px solid ${isLab ? 'var(--color-success)' : 'var(--color-accent)'}; padding:4px 6px; border-radius:4px; margin-bottom:2px;">
                            <div style="font-weight:700; font-size:0.75rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                              ${s.subjectCode} ${badgeHTML}
                            </div>
                            <div style="font-size:0.68rem; color:var(--text-secondary); margin-top:2px; display:flex; align-items:center; gap:6px;">
                              <span style="display:inline-flex; align-items:center; gap:3px;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                ${facName}
                              </span>
                              <span>|</span>
                              <span style="display:inline-flex; align-items:center; gap:3px;">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M9 3v18"></path></svg>
                                ${s.room}
                              </span>
                            </div>
                          </div>
                        `;
                      } else {
                        cellContent += `
                          <div style="background:#f0fdf4; border-left:3px solid var(--color-success); opacity:0.8; padding:2px 6px; border-radius:4px; font-size:0.65rem; color:#166534; font-style:italic;">
                            (Cont. ${s.subjectCode} - Batch ${s.division})
                          </div>
                        `;
                      }
                    });

                    rowCellsHTML += `
                      <div class="timetable-cell" style="padding:4px; display:flex; flex-direction:column; gap:2px; justify-content:center;">
                        ${cellContent}
                      </div>
                    `;
                  }
                });

                return rowCellsHTML;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- TAB 3: GTU SYLLABUS UPLOAD & EXTRACTOR -->
        <div id="studio-pane-syllabus" style="display:${activeTab === 'syllabus' ? 'block' : 'none'};">
          <!-- GTU Banner Header -->
          <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:14px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge" style="background:#4338ca; color:#fff; font-size:0.7rem; font-weight:700;">GTU AI Extractor</span>
                <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary);">Gujarat Technological University Teaching Scheme Parser</span>
              </div>
              <p style="font-size:0.775rem; color:var(--text-secondary); margin:4px 0 0 0;">
                Upload official GTU syllabus files (PDF, Excel, CSV, or Text) to automatically extract Course Codes, Subject Names, and Workload Hours (Lectures L, Practicals P, Tutorials T, Credits C).
              </p>
            </div>
            <button type="button" class="btn btn-secondary" id="btn-load-sample-syllabus" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:600; white-space:nowrap;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Test with Sample GTU Scheme
            </button>
          </div>

          <!-- Upload / Dropzone Area -->
          <div style="margin-bottom:14px;">
            ${selectedSyllabusFiles.length === 0 ? `
              <div id="syllabus-dropzone" style="border:2px dashed var(--border-color); border-radius:var(--radius-lg); padding:28px 20px; text-align:center; background:#ffffff; cursor:pointer; transition:border-color 0.2s, background 0.2s;">
                <input type="file" id="syllabus-file-input" accept=".pdf,.xlsx,.xls,.csv,.txt" multiple style="display:none;">
                <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; background:var(--color-accent-subtle); color:var(--color-accent); margin-bottom:10px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary); margin-bottom:4px;">
                  Drop GTU syllabus file(s) here, or <span style="color:var(--color-accent); text-decoration:underline;">browse files</span>
                </div>
                <div style="font-size:0.775rem; color:var(--text-secondary); margin-bottom:10px;">
                  Upload single or multiple subject syllabus PDFs (e.g. OS, CN, AI, Cyber Security) or curriculum tables
                </div>
                <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
                  <span class="badge" style="background:#eef2ff; color:#3730a3; font-size:0.7rem; font-weight:600;">Individual Subject PDFs</span>
                  <span class="badge" style="background:#f0fdf4; color:#166534; font-size:0.7rem; font-weight:600;">Multi-File Batch Upload</span>
                  <span class="badge" style="background:#f8fafc; color:#475569; font-size:0.7rem; font-weight:600;">GTU L-T-P-C Schemes</span>
                </div>
              </div>
            ` : `
              <div style="display:flex; justify-content:space-between; align-items:center; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:var(--radius-md); padding:12px 18px; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <span style="display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:50%; background:#dcfce7; color:#15803d;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </span>
                  <div>
                    <div style="font-weight:700; font-size:0.9rem; color:#14532d;">
                      ${selectedSyllabusFiles.length === 1 ? selectedSyllabusFiles[0].name : `${selectedSyllabusFiles.length} Syllabus Files Selected`}
                    </div>
                    <div style="font-size:0.75rem; color:#166534;">
                      ${(selectedSyllabusFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB &middot; Ready to extract
                    </div>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <button type="button" class="btn btn-secondary" id="btn-remove-syllabus-file" style="font-size:0.8rem; padding:5px 12px;">Change Files</button>
                  <button type="button" class="btn btn-primary" id="btn-parse-syllabus" style="font-size:0.8rem; padding:5px 16px; background:#16a34a; border-color:#16a34a; font-weight:700; display:inline-flex; align-items:center; gap:6px;" ${isParsingSyllabus ? 'disabled' : ''}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    ${isParsingSyllabus ? 'Parsing Syllabus...' : 'Extract GTU Subjects'}
                  </button>
                </div>
              </div>
            `}
          </div>

          <!-- Loading State -->
          ${isParsingSyllabus ? `
            <div style="text-align:center; padding:32px 16px; background:white; border:1px solid var(--border-color); border-radius:var(--radius-md); margin-bottom:14px;">
              <div class="spinner" style="margin:0 auto 12px auto; width:32px; height:32px; border:3px solid var(--border-color); border-top-color:var(--color-accent); border-radius:50%; animation:spin 1s linear infinite;"></div>
              <h4 style="margin:0 0 4px 0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Parsing GTU Teaching Scheme...</h4>
              <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">Extracting course codes, subject names, and lecture/practical workloads.</p>
            </div>
          ` : ''}

          <!-- Error Banner -->
          ${syllabusParsingError ? `
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:var(--radius-md); padding:10px 16px; margin-bottom:14px; display:flex; align-items:center; gap:10px; color:#991b1b; font-size:0.85rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>${syllabusParsingError}</span>
            </div>
          ` : ''}

          <!-- Parsed Subjects Results Table -->
          ${parsedSyllabusSubjects.length > 0 && !isParsingSyllabus ? `
            <div style="background:white; border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden;">
              <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f1f5f9; border-bottom:1px solid var(--border-color); flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-weight:800; font-size:0.9rem; color:var(--text-primary);">Extracted GTU Subjects</span>
                  <span class="badge" style="background:#3b82f6; color:#fff; font-size:0.75rem; font-weight:700;">${parsedSyllabusSubjects.length} Courses Found</span>
                  ${parsedMetadata?.detectedSemester ? `<span class="badge" style="background:#64748b; color:#fff; font-size:0.75rem;">Sem ${parsedMetadata.detectedSemester}</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <label style="font-size:0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="syllabus-check-all" ${parsedSyllabusSubjects.every(s => s.checked) ? 'checked' : ''}>
                    <span>Select All</span>
                  </label>
                </div>
              </div>

              <div style="max-height:300px; overflow-y:auto;">
                <table class="custom-table" style="margin:0; font-size:0.825rem;">
                  <thead style="position:sticky; top:0; background:#f8fafc; z-index:2;">
                    <tr>
                      <th style="width:36px; text-align:center;">Sel</th>
                      <th style="width:110px;">Course Code</th>
                      <th>Course Title</th>
                      <th style="width:70px; text-align:center;">L (hrs)</th>
                      <th style="width:70px; text-align:center;">T (hrs)</th>
                      <th style="width:70px; text-align:center;">P (hrs)</th>
                      <th style="width:60px; text-align:center;">C</th>
                      <th style="width:190px;">Assigned Faculty</th>
                      <th style="width:120px;">Classroom</th>
                      <th style="width:120px;">Lab Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${parsedSyllabusSubjects.map((s, idx) => `
                      <tr style="${s.checked ? '' : 'opacity:0.5; background:#fafafa;'}">
                        <td style="text-align:center;">
                          <input type="checkbox" class="syllabus-row-check" data-idx="${idx}" ${s.checked ? 'checked' : ''}>
                        </td>
                        <td>
                          <span class="badge" style="font-family:monospace; font-size:0.75rem; font-weight:700; background:#ede9fe; color:#5b21b6;">${s.code}</span>
                        </td>
                        <td>
                          <input type="text" class="form-control syllabus-title-input" data-idx="${idx}" value="${s.name}" style="font-size:0.8rem; font-weight:600; padding:4px 6px;">
                        </td>
                        <td style="text-align:center;">
                          <input type="number" class="form-control syllabus-lectures-input" data-idx="${idx}" value="${s.lectures}" min="0" max="6" style="width:50px; text-align:center; padding:4px; margin:0 auto;">
                        </td>
                        <td style="text-align:center;">
                          <input type="number" class="form-control syllabus-tutorials-input" data-idx="${idx}" value="${s.tutorials || 0}" min="0" max="4" style="width:50px; text-align:center; padding:4px; margin:0 auto;">
                        </td>
                        <td style="text-align:center;">
                          <input type="number" class="form-control syllabus-practicals-input" data-idx="${idx}" value="${s.practicals}" min="0" max="6" style="width:50px; text-align:center; padding:4px; margin:0 auto;">
                        </td>
                        <td style="text-align:center; font-weight:700; color:var(--text-primary);">
                          ${s.credits || (s.lectures + Math.floor(s.practicals / 2))}
                        </td>
                        <td>
                          <select class="form-control syllabus-faculty-select" data-idx="${idx}" style="font-size:0.775rem; padding:4px 6px;">
                            ${eligibleFaculty.map(f => `<option value="${f.id}" ${f.id === s.facultyId ? 'selected' : ''}>${f.name.replace('Prof. ', '').replace('Dr. ', '')}</option>`).join('')}
                          </select>
                        </td>
                        <td>
                          <input type="text" class="form-control syllabus-classroom-input" data-idx="${idx}" value="${s.classroom || DEFAULT_CLASSROOMS[idx % DEFAULT_CLASSROOMS.length]}" style="font-size:0.75rem; padding:3px 6px;">
                        </td>
                        <td>
                          <input type="text" class="form-control syllabus-labroom-input" data-idx="${idx}" value="${s.labRoom || DEFAULT_LAB_ROOMS[idx % DEFAULT_LAB_ROOMS.length]}" style="font-size:0.75rem; padding:3px 6px;">
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <!-- Action Bar -->
              <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#f8fafc; border-top:1px solid var(--border-color); flex-wrap:wrap; gap:10px;">
                <div style="font-size:0.775rem; color:var(--text-secondary);">
                  Selected <strong>${parsedSyllabusSubjects.filter(s => s.checked).length}</strong> of ${parsedSyllabusSubjects.length} subjects &middot; Practicals (P &gt; 0) automatically create 2h lab blocks for each batch.
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <button type="button" class="btn btn-secondary" id="btn-import-syllabus-to-erp" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:700;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Save Subjects to ERP Database
                  </button>
                  <button type="button" class="btn btn-primary" id="btn-apply-syllabus-to-tt" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:700; background:linear-gradient(135deg, #16a34a 0%, #15803d 100%); border-color:#16a34a;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Apply to Timetable Generator
                  </button>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function attachStudioListeners() {
    const tabCriteriaBtn = document.getElementById('btn-tab-criteria');
    const tabPreviewBtn = document.getElementById('btn-tab-preview');
    const tabSyllabusBtn = document.getElementById('btn-tab-syllabus');
    const shuffleBtn = document.getElementById('btn-shuffle-seed');
    const runGenBtn = document.getElementById('btn-run-generate');
    const saveApplyBtn = document.getElementById('btn-save-generated-tt');
    const exportCsvBtn = document.getElementById('btn-export-generated-csv');

    if (tabCriteriaBtn) {
      tabCriteriaBtn.onclick = () => {
        activeTab = 'criteria';
        updateStudioView();
      };
    }
    if (tabPreviewBtn) {
      tabPreviewBtn.onclick = () => {
        activeTab = 'preview';
        updateStudioView();
      };
    }
    if (tabSyllabusBtn) {
      tabSyllabusBtn.onclick = () => {
        activeTab = 'syllabus';
        updateStudioView();
      };
    }

    if (shuffleBtn) {
      shuffleBtn.onclick = () => {
        randomSeed = Math.random();
        runGeneration();
        activeTab = 'preview';
        updateStudioView();
        showToast('Generated new conflict-free alternative schedule!', 'info');
      };
    }

    if (runGenBtn) {
      runGenBtn.onclick = () => {
        syncCriteriaFromDOM();
        runGeneration();
        activeTab = 'preview';
        updateStudioView();
        showToast('Schedule regenerated based on your workload rules.', 'success');
      };
    }

    if (exportCsvBtn) {
      exportCsvBtn.onclick = () => {
        exportGeneratedScheduleCSV(generatedResult.slots, department, currentSem);
      };
    }

    if (saveApplyBtn) {
      saveApplyBtn.onclick = async () => {
        if (!generatedResult || generatedResult.slots.length === 0) {
          showToast('No slots generated to apply.', 'warning');
          return;
        }

        const confirmMsg = `Apply this generated timetable for ${department} Engineering - Semester ${currentSem}? This will replace current schedule slots with ${generatedResult.slots.length} new conflict-free slots.`;
        if (!confirm(confirmMsg)) return;

        saveApplyBtn.disabled = true;
        saveApplyBtn.textContent = 'Applying...';

        try {
          const res = await apiFetch('/admin/timetable/bulk-apply', {
            method: 'POST',
            body: JSON.stringify({
              department: department,
              semester: currentSem,
              slots: generatedResult.slots
            })
          });

          if (res.success) {
            showToast(`Applied ${generatedResult.slots.length} timetable slots successfully!`, 'success');
            if (window.closeModal) window.closeModal();
            if (typeof onApplied === 'function') onApplied();
          } else {
            showToast(res.error || 'Failed to apply timetable.', 'error');
            saveApplyBtn.disabled = false;
            saveApplyBtn.textContent = 'Apply to Live Timetable';
          }
        } catch (e) {
          showToast('Error communicating with server.', 'error');
          saveApplyBtn.disabled = false;
          saveApplyBtn.textContent = 'Apply to Live Timetable';
        }
      };
    }

    // GTU Syllabus Upload & Interaction Listeners
    const dropzone = document.getElementById('syllabus-dropzone');
    const fileInput = document.getElementById('syllabus-file-input');
    const removeFileBtn = document.getElementById('btn-remove-syllabus-file');
    const parseFileBtn = document.getElementById('btn-parse-syllabus');
    const loadSampleBtn = document.getElementById('btn-load-sample-syllabus');
    const applySyllabusBtn = document.getElementById('btn-apply-syllabus-to-tt');
    const importSyllabusBtn = document.getElementById('btn-import-syllabus-to-erp');
    const checkAllBox = document.getElementById('syllabus-check-all');

    if (dropzone && fileInput) {
      dropzone.onclick = () => fileInput.click();
      dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--color-accent)';
        dropzone.style.background = '#f0fdf4';
      };
      dropzone.ondragleave = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '#ffffff';
      };
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = '#ffffff';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          selectedSyllabusFiles = Array.from(e.dataTransfer.files);
          syllabusParsingError = null;
          updateStudioView();
        }
      };
      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          selectedSyllabusFiles = Array.from(e.target.files);
          syllabusParsingError = null;
          updateStudioView();
        }
      };
    }

    if (removeFileBtn) {
      removeFileBtn.onclick = () => {
        selectedSyllabusFiles = [];
        syllabusParsingError = null;
        updateStudioView();
      };
    }

    if (parseFileBtn) {
      parseFileBtn.onclick = async () => {
        if (!selectedSyllabusFiles || selectedSyllabusFiles.length === 0) return;
        isParsingSyllabus = true;
        updateStudioView();

        try {
          const formData = new FormData();
          for (const f of selectedSyllabusFiles) {
            formData.append('files', f);
          }
          formData.append('department', department);
          formData.append('semester', currentSem);

          const res = await apiFetch('/admin/timetable/parse-syllabus', {
            method: 'POST',
            body: formData
          });

          isParsingSyllabus = false;
          if (res.success && res.subjects && res.subjects.length > 0) {
            const existingCodes = new Set(parsedSyllabusSubjects.map(s => s.code));
            const newSubjects = res.subjects.map((s, idx) => ({
              ...s,
              checked: true,
              facultyId: eligibleFaculty[idx % eligibleFaculty.length]?.id || '',
              classroom: DEFAULT_CLASSROOMS[idx % DEFAULT_CLASSROOMS.length],
              labRoom: DEFAULT_LAB_ROOMS[idx % DEFAULT_LAB_ROOMS.length]
            }));

            if (parsedSyllabusSubjects.length > 0) {
              const toAppend = newSubjects.filter(s => !existingCodes.has(s.code));
              parsedSyllabusSubjects = [...parsedSyllabusSubjects, ...toAppend];
            } else {
              parsedSyllabusSubjects = newSubjects;
            }

            parsedMetadata = {
              detectedDepartment: res.detectedDepartment || department,
              detectedSemester: res.detectedSemester || currentSem,
              filename: selectedSyllabusFiles.length === 1 ? selectedSyllabusFiles[0].name : `${selectedSyllabusFiles.length} files`,
              totalSubjects: parsedSyllabusSubjects.length
            };
            syllabusParsingError = null;
            showToast(`Extracted ${res.subjects.length} subject(s) from GTU syllabus.`, 'success');
          } else {
            syllabusParsingError = res.error || 'No GTU teaching scheme could be identified in the uploaded file(s).';
            showToast(syllabusParsingError, 'error');
          }
        } catch (err) {
          isParsingSyllabus = false;
          syllabusParsingError = err.message || 'Error uploading syllabus file(s).';
          showToast(syllabusParsingError, 'error');
        }
        updateStudioView();
      };
    }

    if (loadSampleBtn) {
      loadSampleBtn.onclick = async () => {
        isParsingSyllabus = true;
        updateStudioView();

        const sampleText = `
GUJARAT TECHNOLOGICAL UNIVERSITY
Teaching Scheme for Bachelor of Engineering / Diploma Engineering
Branch Code: 16 (${department})
Semester: ${currentSem}

Sr No. Course Code Course Title L T P C
1. 3150702 Operating Systems 4 0 2 5
2. 3150710 Computer Networks 4 0 2 5
3. 3151608 Artificial Intelligence with Prompt Engineering 3 0 2 4
4. 3150713 Cyber Security and Ethical Hacking 3 0 2 4
5. 3151609 Web Application Development with Frameworks 2 0 4 4
6. 3150005 Integrated Personality Development Course 2 0 0 2
`.trim();

        try {
          const res = await apiFetch('/admin/timetable/parse-syllabus', {
            method: 'POST',
            body: JSON.stringify({
              text: sampleText,
              department: department,
              semester: currentSem
            })
          });

          isParsingSyllabus = false;
          if (res.success && res.subjects && res.subjects.length > 0) {
            parsedSyllabusSubjects = res.subjects.map((s, idx) => ({
              ...s,
              checked: true,
              facultyId: eligibleFaculty[idx % eligibleFaculty.length]?.id || '',
              classroom: DEFAULT_CLASSROOMS[idx % DEFAULT_CLASSROOMS.length],
              labRoom: DEFAULT_LAB_ROOMS[idx % DEFAULT_LAB_ROOMS.length]
            }));
            parsedMetadata = {
              detectedDepartment: department,
              detectedSemester: currentSem,
              filename: 'Sample_GTU_Teaching_Scheme.txt',
              totalSubjects: res.subjects.length
            };
            syllabusParsingError = null;
            showToast(`Loaded sample GTU syllabus with ${res.subjects.length} subjects!`, 'success');
          } else {
            syllabusParsingError = res.error || 'Failed to load sample scheme.';
            showToast(syllabusParsingError, 'error');
          }
        } catch (e) {
          isParsingSyllabus = false;
          syllabusParsingError = e.message || 'Failed to parse sample syllabus.';
          showToast(syllabusParsingError, 'error');
        }
        updateStudioView();
      };
    }

    if (checkAllBox) {
      checkAllBox.onchange = (e) => {
        const checked = e.target.checked;
        parsedSyllabusSubjects.forEach(s => s.checked = checked);
        updateStudioView();
      };
    }

    document.querySelectorAll('.syllabus-row-check').forEach(chk => {
      chk.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        if (parsedSyllabusSubjects[idx]) {
          parsedSyllabusSubjects[idx].checked = e.target.checked;
        }
        updateStudioView();
      };
    });

    document.querySelectorAll('.syllabus-title-input').forEach(inp => {
      inp.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        if (parsedSyllabusSubjects[idx]) parsedSyllabusSubjects[idx].name = e.target.value.trim();
      };
    });

    document.querySelectorAll('.syllabus-lectures-input').forEach(inp => {
      inp.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        if (parsedSyllabusSubjects[idx]) parsedSyllabusSubjects[idx].lectures = parseInt(e.target.value) || 0;
      };
    });

    document.querySelectorAll('.syllabus-tutorials-input').forEach(inp => {
      inp.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        if (parsedSyllabusSubjects[idx]) parsedSyllabusSubjects[idx].tutorials = parseInt(e.target.value) || 0;
      };
    });

    document.querySelectorAll('.syllabus-practicals-input').forEach(inp => {
      inp.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        if (parsedSyllabusSubjects[idx]) {
          const p = parseInt(e.target.value) || 0;
          parsedSyllabusSubjects[idx].practicals = p;
          parsedSyllabusSubjects[idx].hasLab = p > 0;
        }
      };
    });

    document.querySelectorAll('.syllabus-faculty-select').forEach(sel => {
      sel.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        if (parsedSyllabusSubjects[idx]) parsedSyllabusSubjects[idx].facultyId = e.target.value;
      };
    });

    document.querySelectorAll('.syllabus-classroom-input').forEach(inp => {
      inp.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        if (parsedSyllabusSubjects[idx]) parsedSyllabusSubjects[idx].classroom = e.target.value.trim();
      };
    });

    document.querySelectorAll('.syllabus-labroom-input').forEach(inp => {
      inp.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        if (parsedSyllabusSubjects[idx]) parsedSyllabusSubjects[idx].labRoom = e.target.value.trim();
      };
    });

    if (applySyllabusBtn) {
      applySyllabusBtn.onclick = () => {
        const checkedSubs = parsedSyllabusSubjects.filter(s => s.checked);
        if (checkedSubs.length === 0) {
          showToast('Please select at least one subject to apply.', 'warning');
          return;
        }

        criteriaList = checkedSubs.map((s, idx) => {
          const existingSub = eligibleSubjects.find(sub => (sub.code && sub.code.toUpperCase() === s.code.toUpperCase()) || sub.name.toLowerCase() === s.name.toLowerCase());
          return {
            id: existingSub ? existingSub.id : `sub_${s.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            code: s.code,
            name: s.name,
            facultyId: s.facultyId || (eligibleFaculty[idx % eligibleFaculty.length]?.id || ''),
            lectureCount: parseInt(s.lectures) || 0,
            hasLab: (parseInt(s.practicals) || 0) > 0,
            classroom: s.classroom || DEFAULT_CLASSROOMS[idx % DEFAULT_CLASSROOMS.length],
            labRoom: s.labRoom || DEFAULT_LAB_ROOMS[idx % DEFAULT_LAB_ROOMS.length]
          };
        });

        runGeneration();
        activeTab = 'preview';
        updateStudioView();
        showToast(`Applied ${checkedSubs.length} GTU subjects to Timetable Generator! Generated conflict-free schedule.`, 'success');
      };
    }

    if (importSyllabusBtn) {
      importSyllabusBtn.onclick = async () => {
        const checkedSubs = parsedSyllabusSubjects.filter(s => s.checked);
        if (checkedSubs.length === 0) {
          showToast('Please select at least one subject to save to ERP.', 'warning');
          return;
        }

        importSyllabusBtn.disabled = true;
        importSyllabusBtn.textContent = 'Saving to Database...';

        try {
          const res = await apiFetch('/admin/timetable/import-syllabus-subjects', {
            method: 'POST',
            body: JSON.stringify({
              department: department,
              semester: currentSem,
              subjects: checkedSubs
            })
          });

          if (res.success) {
            showToast(`Successfully saved ${res.importedCount || checkedSubs.length} subjects to ERP database!`, 'success');
            checkedSubs.forEach(s => {
              const exists = subjects.find(sub => sub.code === s.code && sub.semester === currentSem && sub.department === department);
              if (!exists) {
                subjects.push({
                  id: `sub_${s.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                  code: s.code,
                  name: s.name,
                  department: department,
                  semester: currentSem,
                  facultyId: s.facultyId || '',
                  credits: s.credits || 4,
                  lectureHours: s.lectures || 3,
                  labHours: s.practicals || 0
                });
              }
            });
            eligibleSubjects = subjects.filter(s => s.department === department && s.semester === currentSem);
          } else {
            showToast(res.error || 'Failed to save subjects to ERP.', 'error');
          }
        } catch (e) {
          showToast('Error saving subjects to ERP database.', 'error');
        } finally {
          if (importSyllabusBtn) {
            importSyllabusBtn.disabled = false;
            importSyllabusBtn.textContent = 'Save Subjects to ERP Database';
          }
        }
      };
    }

    // Dynamic bindings for criteria inputs
    document.querySelectorAll('.crit-lecture-input').forEach(input => {
      input.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        criteriaList[idx].lectureCount = parseInt(e.target.value) || 0;
      };
    });

    document.querySelectorAll('.crit-lab-checkbox').forEach(input => {
      input.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        criteriaList[idx].hasLab = e.target.checked;
      };
    });

    document.querySelectorAll('.crit-faculty-select').forEach(sel => {
      sel.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        criteriaList[idx].facultyId = e.target.value;
      };
    });

    document.querySelectorAll('.crit-classroom-input').forEach(input => {
      input.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        criteriaList[idx].classroom = e.target.value;
      };
    });

    document.querySelectorAll('.crit-labroom-input').forEach(input => {
      input.onchange = (e) => {
        const idx = parseInt(e.target.dataset.idx);
        criteriaList[idx].labRoom = e.target.value;
      };
    });
  }

  function syncCriteriaFromDOM() {
    document.querySelectorAll('.crit-lecture-input').forEach(input => {
      const idx = parseInt(input.dataset.idx);
      if (criteriaList[idx]) criteriaList[idx].lectureCount = parseInt(input.value) || 0;
    });
    document.querySelectorAll('.crit-lab-checkbox').forEach(input => {
      const idx = parseInt(input.dataset.idx);
      if (criteriaList[idx]) criteriaList[idx].hasLab = input.checked;
    });
  }

  function updateStudioView() {
    const modalContent = document.getElementById('modal-form-content');
    if (modalContent) {
      modalContent.innerHTML = renderStudioHTML();
      attachStudioListeners();
    }
  }

  // Open the modal with custom footer actions
  const openModalFn = window.openModal || (typeof openModal === 'function' ? openModal : null);
  if (openModalFn) {
    openModalFn(
      `Automatic Timetable Generator Studio`,
      renderStudioHTML(),
      null,
      {
        maxWidth: '1050px',
        hideCancel: true,
        customFooter: `
          <button type="button" class="btn btn-secondary" id="btn-close-studio" style="font-weight:600;">Close Studio</button>
          <button type="button" class="btn btn-secondary" id="btn-export-generated-csv" style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Export CSV
          </button>
          <button type="button" class="btn btn-primary" id="btn-save-generated-tt" style="background:#16a34a; border-color:#16a34a; display:inline-flex; align-items:center; gap:6px; font-weight:700; box-shadow:0 2px 8px rgba(22,163,74,0.35);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Apply to Live Timetable
          </button>
        `
      }
    );

    setTimeout(() => {
      attachStudioListeners();
      const closeBtn = document.getElementById('btn-close-studio');
      if (closeBtn && window.closeModal) closeBtn.onclick = () => window.closeModal();
    }, 50);
  }
}

// Export timetable to CSV
export function exportGeneratedScheduleCSV(slots, department, semester) {
  if (!slots || slots.length === 0) {
    showToast('No slots to export.', 'warning');
    return;
  }

  const rows = [
    ["SAtendify Timetable Generator - Official Schedule Matrix"],
    ["Department:", `${department} Engineering`],
    ["Semester:", `Semester ${semester}`],
    ["Generated At:", new Date().toLocaleString()],
    [""],
    ["Day", "Period", "Session Type", "Division / Batch", "Subject Code", "Subject Name", "Room"]
  ];

  slots.forEach(s => {
    rows.push([
      s.day,
      s.duration > 1 ? `Period ${s.period}-${s.period + s.duration - 1}` : `Period ${s.period}`,
      s.type.toUpperCase(),
      s.division === 'ALL' ? 'Whole Class' : `Batch ${s.division}`,
      `"${s.subjectCode || ''}"`,
      `"${s.subjectName || ''}"`,
      s.room || 'N/A'
    ]);
  });

  const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `SAtendify_Timetable_${department}_Sem${semester}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Timetable schedule downloaded as CSV.', 'success');
}
