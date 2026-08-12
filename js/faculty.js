// SAtendify Faculty Dashboard Controller
import { guardRoute } from './auth.js';
import { initializeChrome } from './main.js';
import { apiFetch, showToast } from './api.js';

// Route guard validation
const user = guardRoute(['faculty']);
if (user) {
  window.addEventListener('DOMContentLoaded', () => initFacultyDashboard());
  window.addEventListener('popstate', () => initFacultyDashboard());
  window.addEventListener('tabchange', (e) => initFacultyDashboard(e.detail ? e.detail.tab : null));
}

// Global modal references
let modalBackdrop;
let modalTitle;
let modalClose;
let modalCancel;
let modalForm;
let modalContent;
let currentSaveCallback = null;
let semesterConfigs = { "1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 2 };

function getBatchNamesForSemester(semester, maxBatches = 2) {
  const enrollmentYear = 2026 - Math.floor((semester - 1) / 2);
  const yearSuffix = enrollmentYear % 100;
  const list = [];
  for (let i = 1; i <= maxBatches; i++) {
    list.push(`${yearSuffix}${i}`);
  }
  return list;
}

async function initFacultyDashboard(forcedTab = null) {
  modalBackdrop = document.getElementById('faculty-modal');
  modalTitle = document.getElementById('modal-panel-title');
  modalClose = document.getElementById('modal-close');
  modalCancel = document.getElementById('modal-cancel-btn');
  modalForm = document.getElementById('modal-form-element');
  modalContent = document.getElementById('modal-form-content');

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  if (modalForm) modalForm.addEventListener('submit', handleModalSubmit);

  const configRes = await apiFetch('/admin/semester-config');
  if (configRes.success) {
    semesterConfigs = configRes.data;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const activeTab = forcedTab || urlParams.get('tab') || 'timetable-today';

  initializeChrome(activeTab, getPageTitleForTab(activeTab));

  switch (activeTab) {
    case 'timetable-today':
      await renderTodayTimetable();
      break;
    case 'proxies':
      await renderProxyTab();
      break;
    case 'students':
      await renderStudentsTab();
      break;
    case 'history':
      await renderAttendanceHistory();
      break;
    case 'timetable-weekly':
      await renderWeeklyTimetable();
      break;
    default:
      await renderTodayTimetable();
  }
}

function getPageTitleForTab(tab) {
  switch (tab) {
    case 'timetable-today': return "Today's Classes";
    case 'proxies': return "Proxy Allocations";
    case 'students': return "Students";
    case 'history': return "Attendance Logs";
    case 'timetable-weekly': return "Weekly Timetable";
    default: return "Dashboard";
  }
}

function openModal(title, contentHTML, onSaveCallback) {
  modalTitle.textContent = title;
  modalContent.innerHTML = contentHTML;
  currentSaveCallback = onSaveCallback;
  modalBackdrop.classList.add('show');
}

function closeModal() {
  modalBackdrop.classList.remove('show');
  modalContent.innerHTML = '';
  currentSaveCallback = null;
}

async function handleModalSubmit(e) {
  e.preventDefault();
  if (currentSaveCallback) {
    const spinner = document.getElementById('modal-save-btn');
    const orig = spinner.innerHTML;
    spinner.disabled = true;
    spinner.textContent = 'Saving...';

    const success = await currentSaveCallback(new FormData(modalForm));

    spinner.disabled = false;
    spinner.innerHTML = orig;

    if (success) closeModal();
  }
}

// ==========================================
// 1. TODAY'S TIMETABLE & ACTIONABLE FLOWS
// ==========================================
async function renderTodayTimetable() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 260px;"></div>`;

  const res = await apiFetch('/faculty/timetable');
  if (!res.success) return;

  const logs = res.data;
  
  // Filter today's timetable slots
  const todayClasses = logs.filter(l => l.isToday).sort((a,b) => a.period - b.period);

  if (todayClasses.length === 0) {
    container.innerHTML = `
      <div class="empty-placeholder-box">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        </div>
        <p>No class lectures mapped to your name for today in timetable schedules.</p>
        <p style="font-size:0.775rem; color:var(--text-muted); margin-top:4px;">Admins or HODs can allocate new lectures to your account.</p>
      </div>
    `;
    return;
  }

  let slotsHTML = '';
  const triggerTimes = ['10:00', '11:00', '11:55', '13:20', '14:15', '15:20', '16:15'];
  const todayDate = new Date();

  todayClasses.forEach(item => {
    const periodTimeStr = triggerTimes[item.period - 1] || '10:00';
    
    const triggerDate = new Date();
    const [hours, minutes] = periodTimeStr.split(':');
    triggerDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const isAvailable = todayDate >= triggerDate;
    const timeHint = isAvailable ? '' : `Available at ${periodTimeStr}`;

    const duration = item.duration || 1;
    const periodText = duration > 1 ? `Period ${item.period}-${item.period + duration - 1}` : `Period ${item.period}`;
    const typeLabel = item.type === 'lab' ? '🔬 Lab' : item.type === 'tutorial' ? '📖 Tut' : '';

    const timeHour = parseInt(hours);
    const timeSuffix = timeHour >= 12 ? ' PM' : ' AM';
    const displayHour = timeHour > 12 ? timeHour - 12 : timeHour;
    const formattedTime = `${displayHour}:${minutes}${timeSuffix}`;

    let proxyBadge = '';
    if (item.isProxy) {
      proxyBadge = `<span class="badge badge-warning" style="display:inline-flex; align-items:center; gap:4px; padding:4px 8px; font-size:0.75rem; background:rgba(217,119,6,0.12); color:#d97706; border:1px solid rgba(217,119,6,0.3); margin-left:8px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        Proxy (Covering for ${item.originalFacultyName})
      </span>`;
    } else if (item.hasProxyAssigned && item.proxyInfo) {
      proxyBadge = `<span class="badge badge-info" style="display:inline-flex; align-items:center; gap:4px; padding:4px 8px; font-size:0.75rem; background:rgba(99,102,241,0.12); color:#4f46e5; border:1px solid rgba(99,102,241,0.3); margin-left:8px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
        Proxy Assigned to ${item.proxyInfo.proxyFacultyName}
      </span>`;
    }

    const assignProxyBtn = (!item.isProxy && !item.hasProxyAssigned) ? 
      `<button class="btn btn-secondary btn-assign-proxy-trigger" data-id="${item.id}" style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        Assign Proxy
      </button>` : '';

    slotsHTML += `
      <div class="timeline-slot-card" id="slot-card-${item.id}">
        <div class="slot-time-col">
          <span class="slot-index">${periodText}</span>
          <span class="slot-time-range">${item.subject ? formattedTime : ''}</span>
        </div>
        
        <div class="slot-info-col">
          <div class="slot-header">
            <span class="slot-subj-name">${item.subject ? item.subject.name : 'Unallocated Subject'} ${typeLabel ? `<span style="font-size:0.7rem; font-weight:normal; background:#dcfce7; color:#166534; padding:2px 6px; border-radius:3px; margin-left:4px;">${typeLabel}</span>` : ''}</span>
            <span class="badge badge-${user.department ? user.department.toLowerCase() : 'it'}">${item.subject ? item.subject.code : ''}</span>
            ${proxyBadge}
          </div>
          <div class="slot-meta">
            <span>🏫 Class: <strong>Sem-${item.semester} / Batch-${item.division}</strong></span>
            <span>🚪 Room: <strong>${item.room}</strong></span>
          </div>
        </div>

        <div class="slot-action-col">
          ${item.isSubmittedToday ? 
            `<span class="badge badge-success" style="padding: 8px 12px; font-weight:700;">✓ Attendance Submitted</span>` :
            `<div style="display:flex; gap:8px; align-items:center;">
              <button class="btn btn-primary btn-take-att-trigger" data-id="${item.id}" ${isAvailable ? '' : 'disabled'}>Take Attendance</button>
              ${assignProxyBtn}
             </div>
             ${timeHint ? `<span class="slot-hint">${timeHint}</span>` : ''}`
          }
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div id="faculty-today-timeline">
      <div class="panel-card">
        <div class="panel-header">
          <h3>Your Schedule Today</h3>
        </div>
        <div class="panel-body timetable-timeline">
          ${slotsHTML}
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('.btn-take-att-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const timetableId = btn.dataset.id;
      loadTakeAttendancePane(timetableId);
    });
  });

  document.querySelectorAll('.btn-assign-proxy-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotId = btn.dataset.id;
      openAssignProxyModal(slotId);
    });
  });
}

// Take Attendance Screen Logic
async function loadTakeAttendancePane(timetableId, prefillRoster = null, isEditFlow = false) {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 350px;"></div>`;

  const rosterRes = await apiFetch(`/faculty/roster/${timetableId}`);
  if (!rosterRes.success) return;

  const rosterData = rosterRes.data;
  const sub = rosterData.timetableCell.subject;
  const students = rosterData.roster;

  if (students.length === 0) {
    container.innerHTML = `
      <div class="empty-placeholder-box">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        </div>
        <p>No student enrollment registers found for this class.</p>
      </div>
    `;
    return;
  }

  // Set initial status values
  const presenceState = {};
  students.forEach(s => {
    if (prefillRoster && prefillRoster[s.id]) {
      presenceState[s.id] = prefillRoster[s.id];
    } else {
      presenceState[s.id] = 'present'; // Default Present
    }
  });

  function updateStatusSummary() {
    const present = Object.values(presenceState).filter(v => v === 'present').length;
    const absent = Object.values(presenceState).filter(v => v === 'absent').length;
    const leave = Object.values(presenceState).filter(v => v === 'leave').length;

    document.getElementById('att-summary-present').textContent = present;
    document.getElementById('att-summary-absent').textContent = absent;
    document.getElementById('att-summary-leave').textContent = leave;
  }

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <button class="btn btn-secondary" id="btn-back-to-referral">${isEditFlow ? '← Back to History' : '← Back to Timeline'}</button>
      <div>
        <h4 style="font-weight:700; text-align:right;">${sub.name} (${sub.code})</h4>
        <p style="font-size:0.775rem; text-align:right; color:var(--text-secondary);">Sem-${rosterData.timetableCell.semester} - Div-${rosterData.timetableCell.division} | Room ${rosterData.timetableCell.room}</p>
      </div>
    </div>

    <!-- Stats Summary & Quick Mark Buttons -->
    <div class="roster-header-bar">
      <div class="roster-header-stats">
        <span class="roster-stat-badge" style="color:var(--color-success);">🟢 Present: <strong id="att-summary-present">0</strong></span>
        <span class="roster-stat-badge" style="color:var(--color-danger);">🔴 Absent: <strong id="att-summary-absent">0</strong></span>
        <span class="roster-stat-badge" style="color:var(--color-warning);">🟡 Leave: <strong id="att-summary-leave">0</strong></span>
      </div>
      <div class="roster-quick-actions">
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem;" id="btn-mark-all-present">Mark All Present</button>
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem;" id="btn-mark-all-absent">Mark All Absent</button>
      </div>
    </div>

    <!-- Student Cards Rows -->
    <div class="roster-list-container" id="student-roster-rows">
      ${students.map(std => {
        const currentStatus = presenceState[std.id] || 'present';
        return `
          <div class="roster-card-row ${currentStatus}-selected" id="roster-row-${std.id}">
            <div class="roster-student-details">
              <span class="roster-roll-badge">${std.rollNumber}</span>
              <span class="roster-student-name">${std.name}</span>
            </div>
            <!-- Interactive Toggles -->
            <div class="presence-selector">
              <button type="button" class="presence-btn p-present ${currentStatus === 'present' ? 'active' : ''}" data-id="${std.id}" data-status="present">Present</button>
              <button type="button" class="presence-btn p-leave ${currentStatus === 'leave' ? 'active' : ''}" data-id="${std.id}" data-status="leave">Leave</button>
              <button type="button" class="presence-btn p-absent ${currentStatus === 'absent' ? 'active' : ''}" data-id="${std.id}" data-status="absent">Absent</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Sticky footer -->
    <div style="background:white; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px 24px; box-shadow:var(--shadow-sm); display:flex; justify-content:space-between; align-items:center; margin-top:24px;">
      <p style="font-size:0.825rem; color:var(--text-secondary);">Verify student details carefully before logging submission data.</p>
      <button class="btn btn-primary" id="btn-submit-attendance" style="padding:12px 24px;">
        ${isEditFlow ? 'Apply Attendance Changes' : 'Submit Attendance to Registry'}
      </button>
    </div>
  `;

  updateStatusSummary();

  // Return button bindings
  document.getElementById('btn-back-to-referral').addEventListener('click', () => {
    if (isEditFlow) {
      renderAttendanceHistory();
    } else {
      renderTodayTimetable();
    }
  });

  // Toggler button clicks
  const listEl = document.getElementById('student-roster-rows');
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.presence-btn');
    if (!btn) return;

    const stdId = btn.dataset.id;
    const status = btn.dataset.status;

    presenceState[stdId] = status;

    const row = document.getElementById(`roster-row-${stdId}`);
    row.className = `roster-card-row ${status}-selected`;

    const selector = btn.parentElement;
    selector.querySelectorAll('.presence-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    updateStatusSummary();
  });

  // Roster helpers
  document.getElementById('btn-mark-all-present').addEventListener('click', () => {
    students.forEach(s => {
      presenceState[s.id] = 'present';
      const row = document.getElementById(`roster-row-${s.id}`);
      row.className = 'roster-card-row present-selected';
      row.querySelectorAll('.presence-btn').forEach(b => b.classList.remove('active'));
      row.querySelector('.p-present').classList.add('active');
    });
    updateStatusSummary();
    showToast('Marked all present.', 'info');
  });

  document.getElementById('btn-mark-all-absent').addEventListener('click', () => {
    students.forEach(s => {
      presenceState[s.id] = 'absent';
      const row = document.getElementById(`roster-row-${s.id}`);
      row.className = 'roster-card-row absent-selected';
      row.querySelectorAll('.presence-btn').forEach(b => b.classList.remove('active'));
      row.querySelector('.p-absent').classList.add('active');
    });
    updateStatusSummary();
    showToast('Marked all absent.', 'info');
  });

  // Submit flow
  document.getElementById('btn-submit-attendance').addEventListener('click', async () => {
    if (confirm('Are you sure you want to write these attendance values?')) {
      // For editing, use historical record date. For today class, use today date.
      let submissionDate = new Date().toISOString().split('T')[0];
      
      if (isEditFlow && currentEditingHistoryId) {
        // Fetch original record date
        const historyDetails = await apiFetch('/faculty/history');
        if (historyDetails.success) {
          const matched = historyDetails.data.find(h => h.id === currentEditingHistoryId);
          if (matched) {
            submissionDate = matched.date;
          }
        }
      }

      const payload = {
        timetableId: timetableId,
        date: submissionDate,
        roster: presenceState
      };

      const res = await apiFetch('/faculty/attendance', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        showToast('Attendance calculations posted and synced successfully.', 'success');
        if (isEditFlow) {
          await renderAttendanceHistory();
        } else {
          await renderTodayTimetable();
        }
      }
    }
  });
}

// ==========================================
// 2. ATTENDANCE HISTORY (Filterable & editable within 48h limit)
// ==========================================
async function renderAttendanceHistory() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 260px;"></div>`;

  const [historyRes, subsRes] = await Promise.all([
    apiFetch('/faculty/history'),
    apiFetch('/admin/subjects')
  ]);

  if (!historyRes.success || !subsRes.success) return;

  const history = historyRes.data;
  const facultySubjects = subsRes.data.filter(s => user.subjects && user.subjects.includes(s.id));

  container.innerHTML = `
    <!-- Top Executive Banner -->
    <div class="admin-welcome-banner" style="margin-bottom: 20px;">
      <div>
        <h2 class="admin-welcome-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#6366f1;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <span>Lecture Session Attendance Registers</span>
        </h2>
        <p class="admin-welcome-subtitle">Review conducted class sessions, attendance ratios, and modify register records within 48h limit.</p>
      </div>
      <div class="admin-banner-actions">
        <div style="display:flex; gap:10px; align-items:center;">
          <span class="badge badge-primary" style="padding: 8px 14px; font-size:0.85rem;">${history.length} Conducted Sessions</span>
          <span class="badge badge-${user.department ? user.department.toLowerCase() : 'it'}" style="padding: 8px 14px; font-size:0.85rem;">${user.department || 'IT'} Stream</span>
        </div>
      </div>
    </div>

    <!-- Filter Controls Card -->
    <div class="panel-card" style="margin-bottom: 20px; padding: 18px 22px;">
      <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end;">
        <div class="form-group" style="flex: 1 1 240px; margin: 0;">
          <label for="filter-hist-subject" style="font-size: 0.775rem; font-weight: 700; color: var(--text-muted);">Course Subject</label>
          <select class="form-control" id="filter-hist-subject" style="font-size: 0.85rem;">
            <option value="all">All Subject Allocations</option>
            ${facultySubjects.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex: 1 1 180px; margin: 0;">
          <label for="filter-hist-date" style="font-size: 0.775rem; font-weight: 700; color: var(--text-muted);">Target Date</label>
          <input type="date" class="form-control" id="filter-hist-date" style="font-size: 0.85rem;">
        </div>
        <button class="btn btn-secondary" id="btn-clear-filters" style="padding: 9px 16px; font-size: 0.825rem; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          Reset Filters
        </button>
      </div>
    </div>

    <!-- Core logs table -->
    <div class="panel-card">
      <div class="panel-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-accent);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <h3 style="margin:0;">Class Session History Calendar</h3>
        </div>
        <span class="stat-desc">${user.name}</span>
      </div>
      <div class="table-responsive">
        <table class="custom-table" id="history-logs-table">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Date</th>
              <th>Slot</th>
              <th>Class Details</th>
              <th>Subject Course</th>
              <th>Attendance Ratio</th>
              <th>Edit Lock Status</th>
              <th style="text-align: right;">Operations</th>
            </tr>
          </thead>
          <tbody id="history-logs-rows">
            <!-- Filtered rows injected here -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  function drawHistory() {
    const subVal = document.getElementById('filter-hist-subject').value;
    const dateVal = document.getElementById('filter-hist-date').value;

    const filtered = history.filter(h => {
      const selectedSubObj = facultySubjects.find(s => s.id === subVal);
      const matchSubjectCode = subVal === 'all' || (selectedSubObj && h.subjectCode === selectedSubObj.code);
      const matchDate = !dateVal || h.date === dateVal;
      return matchSubjectCode && matchDate;
    });

    const rowsEl = document.getElementById('history-logs-rows');
    if (filtered.length === 0) {
      rowsEl.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-placeholder-box">
              <div class="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <p>No historical session logs match selected filter parameters.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    rowsEl.innerHTML = filtered.map((h, idx) => {
      const lockBadge = h.canEdit ? 
        `<span class="badge badge-success" style="display:inline-flex; align-items:center; gap:4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Active (Editable)</span>` : 
        `<span class="badge badge-danger" style="display:inline-flex; align-items:center; gap:4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg> Locked (&gt;48h)</span>`;

      const ratio = h.totalCount > 0 ? Math.round((h.presentCount / h.totalCount) * 100) : 0;
      const isHealthy = ratio >= 75;

      return `
        <tr>
          <td><span style="font-weight: 700; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</span></td>
          <td><strong style="font-family: monospace; font-size: 0.85rem;">${h.date}</strong></td>
          <td><span class="badge badge-primary">P${h.period}</span></td>
          <td><span class="badge badge-it">Sem-${h.semester} (${h.division})</span></td>
          <td><strong>${h.subjectCode}</strong> <span style="font-size:0.8rem; color:var(--text-secondary);">&middot; ${h.subjectName}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="color: ${isHealthy ? 'var(--color-success)' : 'var(--color-danger)'}; font-size: 0.85rem;">${ratio}%</strong>
              <span style="font-size: 0.75rem; color: var(--text-muted);">(${h.presentCount}/${h.totalCount})</span>
            </div>
            <div class="stat-progress-bar" style="height: 4px; margin-top: 4px; width: 100px;">
              <div class="stat-progress-fill" style="width: ${ratio}%; background: ${isHealthy ? 'var(--color-success)' : 'var(--color-danger)'};"></div>
            </div>
          </td>
          <td>${lockBadge}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-edit-history-trigger" data-id="${h.id}" data-tt="${h.timetableId}" ${h.canEdit ? '' : 'disabled'} style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Modify Register
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Bind triggers
  document.getElementById('filter-hist-subject').addEventListener('change', drawHistory);
  document.getElementById('filter-hist-date').addEventListener('change', drawHistory);
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-hist-subject').value = 'all';
    document.getElementById('filter-hist-date').value = '';
    drawHistory();
  });

  // Bind change registers click
  document.getElementById('history-logs-rows').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-edit-history-trigger');
    if (!btn) return;

    const historyId = btn.dataset.id;
    const timetableId = btn.dataset.tt;
    
    // Prefill presence logs based on the historical logs
    const activeRecord = history.find(h => h.id === historyId);
    if (activeRecord) {
      currentEditingHistoryId = historyId; // Set active editing record
      loadTakeAttendancePane(timetableId, activeRecord.roster, true);
    }
  });

  drawHistory();
}

// Extra helper
function matchedTTCell(ttId) {
  // simple mock resolver
  return null;
}

// ==========================================
// 3. WEEKLY TIMETABLE GRID FOR FACULTY
// ==========================================
async function renderWeeklyTimetable() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 350px;"></div>`;

  const [timetableRes, subsRes] = await Promise.all([
    apiFetch('/admin/timetable'),
    apiFetch('/admin/subjects')
  ]);

  if (!timetableRes.success || !subsRes.success) return;

  const timetable = timetableRes.data;
  const subjects = subsRes.data;

  // Filter schedule elements where facultyId === current logged-in faculty
  const myClasses = timetable.filter(c => c.facultyId === user.id);

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <h3>My Weekly Lecture Engagements</h3>
      </div>
      <div class="panel-body">
        <div class="table-responsive">
          <div class="timetable-grid" id="faculty-weekly-grid"></div>
        </div>

        <!-- Mobile Timetable -->
        <div class="mobile-timetable-list" id="fac-mobile-tt" style="margin-top: 24px; display: none;"></div>
      </div>
    </div>
  `;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const periods = [
    { num: 1, time: '10:00 - 10:55' },
    { num: 2, time: '11:00 - 11:55' },
    { num: 3, time: '11:55 - 12:50' },
    { num: 4, time: '01:20 - 02:15' },
    { num: 5, time: '02:15 - 03:10' },
    { num: 6, time: '03:20 - 04:15' },
    { num: 7, time: '04:15 - 05:10' }
  ];

  function drawFacultyGrid() {
    const grid = document.getElementById('faculty-weekly-grid');
    let gridHTML = `<div class="timetable-header-cell">Period</div>`;
    days.forEach(day => { gridHTML += `<div class="timetable-header-cell">${day}</div>`; });

    periods.forEach(p => {
      gridHTML += `
        <div class="timetable-row-header">
          <strong>P${p.num}</strong>
          <span style="font-size:0.65rem; font-weight:normal;">${p.time}</span>
        </div>
      `;

      days.forEach(day => {
        // Find if subject booked or if a multi-period slot spans this period
        const cell = myClasses.find(c => {
          const duration = c.duration || 1;
          return c.day === day && p.num >= c.period && p.num < c.period + duration;
        });

        if (cell) {
          const sub = subjects.find(s => s.id === cell.subjectId);
          const isStart = p.num === cell.period;
          const typeLabel = cell.type === 'lab' ? '🔬 Lab' : cell.type === 'tutorial' ? '📖 Tut' : '';

          if (isStart) {
            gridHTML += `
              <div class="timetable-cell" style="background-color: var(--color-accent-subtle); ${cell.type && cell.type !== 'lecture' ? 'border-left: 3px solid var(--color-success);' : ''}">
                <div>
                  <div class="cell-subject" style="color:var(--color-accent);">${sub ? sub.name : 'Class'} ${typeLabel ? `<span style="font-size:0.65rem; font-weight:normal; background:#dcfce7; color:#166534; padding:2px 4px; border-radius:3px; margin-left:4px;">${typeLabel}</span>` : ''}</div>
                  <div class="cell-faculty">🏠 Sem-${cell.semester} (${cell.division})</div>
                </div>
                <div class="cell-room">🚪 Rm ${cell.room}</div>
              </div>
            `;
          } else {
            // Continuation cell
            gridHTML += `
              <div class="timetable-cell" style="opacity: 0.85; background-color: var(--color-accent-subtle); ${cell.type && cell.type !== 'lecture' ? 'border-left: 3px solid var(--color-success);' : ''}">
                <div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">
                  (Continuation of ${sub ? sub.code : 'lecture'})
                </div>
                <div class="cell-room">🚪 Rm ${cell.room}</div>
              </div>
            `;
          }
        } else {
          gridHTML += `
            <div class="timetable-cell empty-cell" style="border:none; background: #fafbfc; pointer-events:none;">
              <span style="font-size:0.65rem; color:var(--text-secondary);">-</span>
            </div>
          `;
        }
      });
    });

    grid.innerHTML = gridHTML;

    // Draw Mobile Card Lists (swipe/accordion view)
    const mobContainer = document.getElementById('fac-mobile-tt');
    let mobHTML = '';

    days.forEach(day => {
      const dayClasses = myClasses.filter(c => c.day === day).sort((a,b) => a.period - b.period);
      mobHTML += `
        <div class="mobile-tt-card">
          <h4 style="border-bottom: 2px solid var(--border-color); padding-bottom: 6px; font-weight:800; color:var(--text-primary); margin-bottom: 8px;">${day}</h4>
          ${dayClasses.length === 0 ? `<p style="font-size:0.8rem; color:var(--text-muted); italic; padding: 4px 0;">No lectures scheduled.</p>` : 
            dayClasses.map(c => {
              const sub = subjects.find(s => s.id === c.subjectId);
              const duration = c.duration || 1;
              const periodText = duration > 1 ? `Period ${c.period}-${c.period + duration - 1}` : `Period ${c.period}`;
              const typeLabel = c.type === 'lab' ? '🔬 Lab' : c.type === 'tutorial' ? '📖 Tut' : '';
              return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom:1px solid #f1f5f9;">
                  <div>
                    <span class="badge badge-primary">${periodText}</span>
                    <strong style="margin-left:6px; font-size:0.85rem;">${sub ? sub.name : 'Subject'} ${typeLabel ? `<span style="font-size:0.65rem; font-weight:normal; background:#dcfce7; color:#166534; padding:2px 4px; border-radius:3px; margin-left:4px;">${typeLabel}</span>` : ''}</strong>
                    <span style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-left:26px;">Sem-${c.semester} (${c.division}) &middot; Room ${c.room}</span>
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>
      `;
    });

    mobContainer.innerHTML = mobHTML;

    // View selector responsive toggle
    if (window.innerWidth <= 768) {
      grid.style.display = 'none';
      mobContainer.style.display = 'flex';
    } else {
      grid.style.display = 'grid';
      mobContainer.style.display = 'none';
    }
  }

  window.addEventListener('resize', drawFacultyGrid);
  drawFacultyGrid();
}

// ==========================================
// MANAGE STUDENTS TAB (FACULTY)
// ==========================================
async function renderStudentsTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 300px;"></div>`;

  const res = await apiFetch('/admin/users');
  if (!res.success) return;

  const allUsers = res.data;
  // Filter students belonging to faculty's department
  const students = allUsers.filter(u => u.role === 'student' && u.department === user.department);

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header" style="flex-wrap: wrap;">
        <h3>${user.department} Department Students Directory</h3>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <input type="text" id="students-search" class="form-control" placeholder="Search by name, roll, email..." style="padding: 6px 12px; font-size: 0.85rem; width: 220px;">
          <select id="filter-student-sem" class="form-control" style="padding: 6px 12px; font-size: 0.85rem;">
            <option value="all">All Semesters</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
            <option value="3">Semester 3</option>
            <option value="4">Semester 4</option>
            <option value="5">Semester 5</option>
            <option value="6">Semester 6</option>
          </select>
          <button id="btn-add-student" class="btn btn-primary">+ Register New Student</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="custom-table" id="students-table">
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Student Name</th>
              <th>Date of Birth (DOB)</th>
              <th>Semester & Batch</th>
              <th style="text-align: right;">Operations</th>
            </tr>
          </thead>
          <tbody id="students-table-rows">
            <!-- Populated via filters -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  function drawStudents() {
    const searchVal = document.getElementById('students-search').value.toLowerCase();
    const semVal = document.getElementById('filter-student-sem').value;

    const filtered = students.filter(s => {
      const matchSearch = (s.name && s.name.toLowerCase().includes(searchVal)) ||
                          (s.rollNumber && s.rollNumber.toLowerCase().includes(searchVal)) ||
                          (s.dob && s.dob.includes(searchVal));
      const matchSem = semVal === 'all' || String(s.semester) === semVal;
      return matchSearch && matchSem;
    });

    const rowsContainer = document.getElementById('students-table-rows');
    if (filtered.length === 0) {
      rowsContainer.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-placeholder-box">
              <div class="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <p>No matching student records found for ${user.department} department.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    rowsContainer.innerHTML = filtered.map(s => `
      <tr>
        <td><span class="roster-roll-badge">${s.rollNumber || 'N/A'}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="avatar" style="width:30px; height:30px; font-size: 0.775rem;">${(s.name || 'S').split(' ').map(n => n[0]).join('').substring(0, 2)}</span>
            <span><strong>${s.name}</strong></span>
          </div>
        </td>
        <td><span style="font-family: monospace; font-weight: 700; color: var(--color-accent);">${s.dob || 'N/A'}</span></td>
        <td><span class="badge badge-it">Sem-${s.semester || 1} / Div-${s.division || 'A'}</span></td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-edit-student" data-id="${s.id}" style="padding: 6px 10px; font-size: 0.8rem;">Edit</button>
          <button class="btn btn-danger btn-delete-student" data-id="${s.id}" style="padding: 6px 10px; font-size: 0.8rem;">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('students-search').addEventListener('input', drawStudents);
  document.getElementById('filter-student-sem').addEventListener('change', drawStudents);
  document.getElementById('btn-add-student').addEventListener('click', openAddStudentModal);

  document.getElementById('students-table-rows').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit-student');
    const deleteBtn = e.target.closest('.btn-delete-student');

    if (editBtn) {
      const sId = editBtn.dataset.id;
      const targetStudent = students.find(s => s.id === sId);
      if (targetStudent) openEditStudentModal(targetStudent);
    }

    if (deleteBtn) {
      const sId = deleteBtn.dataset.id;
      const targetStudent = students.find(s => s.id === sId);
      if (confirm(`Are you sure you want to delete student record for ${targetStudent ? targetStudent.name : 'this student'}?`)) {
        const delRes = await apiFetch(`/admin/users/${sId}`, { method: 'DELETE' });
        if (delRes.success) {
          showToast('Student record deleted successfully', 'success');
          await renderStudentsTab();
        }
      }
    }
  });

  drawStudents();
}

function openAddStudentModal() {
  const batches = getBatchNamesForSemester(4, semesterConfigs["4"] || 2);
  const batchOptions = batches.map(b => `<option value="${b}">${b}</option>`).join('');

  const contentHTML = `
    <div class="form-group">
      <label for="st-name">Student Full Name</label>
      <input type="text" class="form-control" name="name" id="st-name" placeholder="e.g. Aarav Sharma" required>
    </div>
    <div class="form-group">
      <label>Department Stream</label>
      <input type="text" class="form-control" value="${user.department} Engineering" disabled readonly style="background: var(--color-bg-subtle);">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="st-sem">Semester</label>
        <select class="form-control" name="semester" id="st-sem">
          <option value="1">Semester 1</option>
          <option value="2">Semester 2</option>
          <option value="3">Semester 3</option>
          <option value="4" selected>Semester 4</option>
          <option value="5">Semester 5</option>
          <option value="6">Semester 6</option>
        </select>
      </div>
      <div class="form-group">
        <label for="st-div">Batch Assignment</label>
        <select class="form-control" name="division" id="st-div">
          ${batchOptions}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="st-roll">Institutional Roll Number ID</label>
        <input type="text" class="form-control" name="rollNumber" id="st-roll" placeholder="e.g. 23IT045" required style="text-transform: uppercase;">
      </div>
      <div class="form-group">
        <label for="st-dob">Date of Birth (DDMMYYYY)</label>
        <input type="text" class="form-control" name="dob" id="st-dob" placeholder="e.g. 15082004" required maxlength="8" pattern="[0-9]{8}">
      </div>
    </div>
  `;

  openModal('Register New Student Account', contentHTML, async (formData) => {
    const sem = parseInt(formData.get('semester'));
    const payload = {
      name: formData.get('name'),
      role: 'student',
      department: user.department,
      semester: sem,
      division: formData.get('division'),
      rollNumber: formData.get('rollNumber').trim().toUpperCase(),
      dob: formData.get('dob').trim()
    };

    const res = await apiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast(`Student ${payload.name} registered successfully!`, 'success');
      await renderStudentsTab();
      return true;
    }
    return false;
  });

  const semSelect = document.getElementById('st-sem');
  const divSelect = document.getElementById('st-div');
  if (semSelect && divSelect) {
    semSelect.addEventListener('change', () => {
      const selectedSem = parseInt(semSelect.value);
      const maxB = semesterConfigs[String(selectedSem)] || 2;
      const bList = getBatchNamesForSemester(selectedSem, maxB);
      divSelect.innerHTML = bList.map(b => `<option value="${b}">${b}</option>`).join('');
    });
  }
}

function openEditStudentModal(student) {
  const currentSem = student.semester || 4;
  const maxB = semesterConfigs[String(currentSem)] || 2;
  const batches = getBatchNamesForSemester(currentSem, maxB);
  const batchOptions = batches.map(b => `<option value="${b}" ${b === student.division ? 'selected' : ''}>${b}</option>`).join('');

  const contentHTML = `
    <div class="form-group">
      <label for="st-name">Student Full Name</label>
      <input type="text" class="form-control" name="name" id="st-name" value="${student.name}" required>
    </div>
    <div class="form-group">
      <label>Department Stream</label>
      <input type="text" class="form-control" value="${user.department} Engineering" disabled readonly style="background: var(--color-bg-subtle);">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="st-sem">Semester</label>
        <select class="form-control" name="semester" id="st-sem">
          <option value="1" ${currentSem === 1 ? 'selected' : ''}>Semester 1</option>
          <option value="2" ${currentSem === 2 ? 'selected' : ''}>Semester 2</option>
          <option value="3" ${currentSem === 3 ? 'selected' : ''}>Semester 3</option>
          <option value="4" ${currentSem === 4 ? 'selected' : ''}>Semester 4</option>
          <option value="5" ${currentSem === 5 ? 'selected' : ''}>Semester 5</option>
          <option value="6" ${currentSem === 6 ? 'selected' : ''}>Semester 6</option>
        </select>
      </div>
      <div class="form-group">
        <label for="st-div">Batch Assignment</label>
        <select class="form-control" name="division" id="st-div">
          ${batchOptions}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="st-roll">Institutional Roll Number</label>
        <input type="text" class="form-control" name="rollNumber" id="st-roll" value="${student.rollNumber || ''}" required style="text-transform: uppercase;">
      </div>
      <div class="form-group">
        <label for="st-dob">Date of Birth (DDMMYYYY)</label>
        <input type="text" class="form-control" name="dob" id="st-dob" value="${student.dob || ''}" required maxlength="8" pattern="[0-9]{8}">
      </div>
    </div>
  `;

  openModal(`Modify Student: ${student.name}`, contentHTML, async (formData) => {
    const sem = parseInt(formData.get('semester'));
    const payload = {
      name: formData.get('name'),
      department: user.department,
      semester: sem,
      division: formData.get('division'),
      rollNumber: formData.get('rollNumber').trim().toUpperCase(),
      dob: formData.get('dob').trim()
    };

    const res = await apiFetch(`/admin/users/${student.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('Student details updated successfully!', 'success');
      await renderStudentsTab();
      return true;
    }
    return false;
  });

  const semSelect = document.getElementById('st-sem');
  const divSelect = document.getElementById('st-div');
  if (semSelect && divSelect) {
    semSelect.addEventListener('change', () => {
      const selectedSem = parseInt(semSelect.value);
      const maxB = semesterConfigs[String(selectedSem)] || 2;
      const bList = getBatchNamesForSemester(selectedSem, maxB);
      divSelect.innerHTML = bList.map(b => `<option value="${b}">${b}</option>`).join('');
    });
  }
}

// ==========================================
// PROXY LECTURE ALLOCATION & MANAGEMENT
// ==========================================
async function openAssignProxyModal(slotId) {
  const [usersRes, ttRes] = await Promise.all([
    apiFetch('/admin/users'),
    apiFetch('/admin/timetable')
  ]);

  if (!usersRes.success || !ttRes.success) return;

  const currentUid = user.id || user.uid;
  const staff = usersRes.data.filter(u => (u.role === 'faculty' || u.role === 'hod') && u.department === user.department);
  const targetSlot = ttRes.data.find(s => s.id === slotId);

  if (!targetSlot) {
    showToast('Timetable lecture slot details not found.', 'error');
    return;
  }

  if (staff.length === 0) {
    showToast('No other faculty members found in your department to assign as proxy.', 'warning');
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const contentHTML = `
    <div class="form-group">
      <label>Selected Lecture</label>
      <input type="text" class="form-control" value="${targetSlot.subject ? targetSlot.subject.code + ' - ' + targetSlot.subject.name : 'Lecture Slot'} (Period ${targetSlot.period}, Sem-${targetSlot.semester} Batch-${targetSlot.division})" disabled readonly style="background:var(--bg-secondary); font-size:0.85rem;">
      <input type="hidden" name="timetableId" value="${slotId}">
    </div>
    <div class="form-group">
      <label for="proxy-date-input">Target Absence Date</label>
      <input type="date" class="form-control" name="date" id="proxy-date-input" value="${todayStr}" required>
    </div>
    <div class="form-group">
      <label for="proxy-fac-select">Assign Substitute Professor (Proxy)</label>
      <select class="form-control" name="proxyFacultyId" id="proxy-fac-select" required>
        <!-- Populated dynamically -->
      </select>
      <div id="proxy-availability-notice" style="margin-top: 6px;"></div>
    </div>
    <div class="form-group">
      <label for="proxy-reason-input">Reason for Absence / Leave</label>
      <input type="text" class="form-control" name="reason" id="proxy-reason-input" placeholder="e.g. Medical Leave / Personal Leave / Official Duty" required>
    </div>
  `;

  openModal(`Assign Substitute Proxy Lecture`, contentHTML, async (formData) => {
    const proxyFacId = formData.get('proxyFacultyId');
    if (!proxyFacId) {
      showToast('Please select an available substitute professor.', 'error');
      return false;
    }

    const payload = {
      timetableId: formData.get('timetableId'),
      date: formData.get('date'),
      proxyFacultyId: proxyFacId,
      reason: formData.get('reason')
    };

    const res = await apiFetch('/faculty/proxy-assignments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('Proxy substitute lecture assigned successfully!', 'success');
      await renderTodayTimetable();
      return true;
    }
    return false;
  });

  const dateInput = document.getElementById('proxy-date-input');
  const facSelect = document.getElementById('proxy-fac-select');
  const noticeEl = document.getElementById('proxy-availability-notice');

  function refreshFaculty() {
    updateAvailableFaculty(targetSlot, dateInput.value, facSelect, noticeEl, staff, ttRes.data);
  }

  dateInput.addEventListener('input', refreshFaculty);
  dateInput.addEventListener('change', refreshFaculty);
  refreshFaculty();
}

async function renderProxyTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 280px;"></div>`;

  const [proxiesRes, ttRes, usersRes] = await Promise.all([
    apiFetch('/faculty/proxy-assignments'),
    apiFetch('/admin/timetable'),
    apiFetch('/admin/users')
  ]);

  if (!proxiesRes.success) return;

  const proxies = proxiesRes.data;
  const allTimetableSlots = ttRes.data || [];
  const currentUid = user.id || user.uid;
  const myTimetableSlots = allTimetableSlots.filter(s => String(s.facultyId) === String(currentUid));
  const staff = (usersRes.data || []).filter(u => (u.role === 'faculty' || u.role === 'hod') && u.department === user.department);

  container.innerHTML = `
    <!-- Top Executive Banner -->
    <div class="admin-welcome-banner" style="margin-bottom: 20px;">
      <div>
        <h2 class="admin-welcome-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#6366f1;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>Proxy & Substitute Lecture Allocations</span>
        </h2>
        <p class="admin-welcome-subtitle">Delegate your class lectures during leave or conduct proxy sessions for absent colleagues.</p>
      </div>
      <div class="admin-banner-actions">
        <button class="btn btn-primary" id="btn-create-proxy-general" style="display:inline-flex; align-items:center; gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          + Request Substitute Proxy
        </button>
      </div>
    </div>

    <!-- Proxy Assignments Table -->
    <div class="panel-card">
      <div class="panel-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-accent);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <h3 style="margin:0;">Proxy Register Log</h3>
        </div>
        <span class="stat-desc">${user.name} &middot; ${user.department || 'IT'}</span>
      </div>
      <div class="table-responsive">
        <table class="custom-table" id="proxy-table">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Target Date</th>
              <th>Period & Class</th>
              <th>Subject</th>
              <th>Original Professor</th>
              <th>Proxy Substitute</th>
              <th>Reason</th>
              <th>Status</th>
              <th style="text-align: right;">Operations</th>
            </tr>
          </thead>
          <tbody id="proxy-table-rows">
            <!-- Filtered rows -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  const rowsEl = document.getElementById('proxy-table-rows');
  if (proxies.length === 0) {
    rowsEl.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-placeholder-box">
            <div class="empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </div>
            <p>No proxy lecture allocations registered yet.</p>
          </div>
        </td>
      </tr>
    `;
  } else {
    rowsEl.innerHTML = proxies.map((p, idx) => {
      const isOutgoing = p.originalFacultyId === user.uid;
      const roleTag = isOutgoing ? 
        `<span class="badge badge-info" style="font-size:0.7rem;">Delegated Out</span>` :
        `<span class="badge badge-warning" style="font-size:0.7rem;">Assigned to You</span>`;

      const isPending = p.status === 'pending';
      const isApproved = p.status === 'active' || p.status === 'approved';
      const isRejected = p.status === 'rejected';

      let statusBadge = `<span class="badge badge-warning">⏳ Pending HOD</span>`;
      if (isApproved) statusBadge = `<span class="badge badge-success">✓ Approved</span>`;
      if (isRejected) statusBadge = `<span class="badge badge-danger">❌ Rejected</span>`;

      return `
        <tr>
          <td><span style="font-weight:700; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</span></td>
          <td><strong style="font-family:monospace; font-size:0.85rem;">${p.date}</strong> ${roleTag}</td>
          <td><span class="badge badge-primary">P${p.period}</span> <span style="font-size:0.8rem; color:var(--text-secondary);">Sem-${p.semester} (${p.division})</span></td>
          <td><strong>${p.subjectCode}</strong> <span style="font-size:0.8rem; color:var(--text-secondary);">&middot; ${p.subjectName}</span></td>
          <td>${p.originalFacultyName}</td>
          <td><strong>${p.proxyFacultyName}</strong></td>
          <td><span style="font-size:0.825rem; color:var(--text-secondary);">${p.reason || 'Leave'}</span></td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            ${isOutgoing ? `
              <button class="btn btn-danger btn-cancel-proxy" data-id="${p.id}" style="padding:5px 10px; font-size:0.775rem;">
                Revoke Proxy
              </button>
            ` : `<span style="font-size:0.75rem; color:var(--text-muted);">Assigned</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Bind revoke button click
  rowsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-cancel-proxy');
    if (!btn) return;
    const pId = btn.dataset.id;
    if (confirm('Revoke and cancel this substitute proxy assignment?')) {
      const res = await apiFetch(`/faculty/proxy-assignments/${pId}`, { method: 'DELETE' });
      if (res.success) {
        showToast('Proxy assignment revoked', 'success');
        await renderProxyTab();
      }
    }
  });

  // Bind create proxy general button
  document.getElementById('btn-create-proxy-general').addEventListener('click', async () => {
    if (myTimetableSlots.length === 0) {
      showToast('No timetable slots found for your account.', 'error');
      return;
    }

    const otherStaff = staff.filter(u => String(u.id) !== String(currentUid));
    if (otherStaff.length === 0) {
      showToast('No other department faculty available for proxy assignment.', 'warning');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const contentHTML = `
      <div class="form-group">
        <label for="proxy-gen-slot">Select Your Timetable Lecture Slot</label>
        <select class="form-control" name="timetableId" id="proxy-gen-slot" required>
          ${myTimetableSlots.map(s => `<option value="${s.id}">${s.subject ? s.subject.code + ' - ' + s.subject.name : 'Slot'} (${s.day}, Period ${s.period}, Sem-${s.semester} Batch-${s.division})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="proxy-gen-date">Target Absence Date</label>
        <input type="date" class="form-control" name="date" id="proxy-gen-date" value="${todayStr}" required>
      </div>
      <div class="form-group">
        <label for="proxy-gen-fac">Assign Substitute Professor (Proxy)</label>
        <select class="form-control" name="proxyFacultyId" id="proxy-gen-fac" required>
          <!-- Populated dynamically -->
        </select>
        <div id="proxy-gen-availability-notice" style="margin-top: 6px;"></div>
      </div>
      <div class="form-group">
        <label for="proxy-gen-reason">Reason for Absence / Leave</label>
        <input type="text" class="form-control" name="reason" id="proxy-gen-reason" placeholder="e.g. Medical Leave / Personal Leave / Official Duty" required>
      </div>
    `;

    openModal('Request Substitute Proxy Lecture', contentHTML, async (formData) => {
      const proxyFacId = formData.get('proxyFacultyId');
      if (!proxyFacId) {
        showToast('Please select an available substitute professor.', 'error');
        return false;
      }

      const payload = {
        timetableId: formData.get('timetableId'),
        date: formData.get('date'),
        proxyFacultyId: proxyFacId,
        reason: formData.get('reason')
      };

      const res = await apiFetch('/faculty/proxy-assignments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success) {
        showToast('Substitute proxy assignment created successfully!', 'success');
        await renderProxyTab();
        return true;
      }
      return false;
    });

    const slotSelect = document.getElementById('proxy-gen-slot');
    const dateInput = document.getElementById('proxy-gen-date');
    const facSelect = document.getElementById('proxy-gen-fac');
    const noticeEl = document.getElementById('proxy-gen-availability-notice');

    function refreshGenFaculty() {
      const selectedSlotId = slotSelect.value;
      const selectedSlot = myTimetableSlots.find(s => String(s.id) === String(selectedSlotId));
      if (selectedSlot) {
        updateAvailableFaculty(selectedSlot, dateInput.value, facSelect, noticeEl, staff, allTimetableSlots);
      }
    }

    slotSelect.addEventListener('change', refreshGenFaculty);
    dateInput.addEventListener('input', refreshGenFaculty);
    dateInput.addEventListener('change', refreshGenFaculty);
    refreshGenFaculty();
  });
}

// Helper to calculate & filter available faculty for selected slot and date
function updateAvailableFaculty(slot, dateStr, facSelect, availabilityNotice, staff, allTimetableData) {
  if (!slot || !dateStr || !facSelect) return;

  const dateObj = new Date(dateStr + 'T00:00:00');
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dateDay = daysOfWeek[dateObj.getDay()];

  const targetPeriod = parseInt(slot.period);
  const targetDuration = slot.duration || 1;
  const targetRoom = (slot.room || '').toLowerCase().trim();
  const origFacultyId = slot.facultyId || (user ? (user.id || user.uid) : '');

  const availableList = [];

  staff.forEach(f => {
    if (String(f.id) === String(origFacultyId)) return;

    const overlapping = (allTimetableData || []).filter(c => {
      if (String(c.facultyId) !== String(f.id)) return false;
      if (c.day !== dateDay) return false;
      const cPeriod = parseInt(c.period);
      const cDuration = c.duration || 1;
      return (cPeriod < targetPeriod + targetDuration) && (cPeriod + cDuration > targetPeriod);
    });

    if (overlapping.length === 0) {
      availableList.push({
        fac: f,
        type: 'AVAILABLE',
        label: `✓ ${f.name} (Available - No Class scheduled)`
      });
    } else {
      const sameRoom = overlapping.every(c => (c.room || '').toLowerCase().trim() === targetRoom);
      if (sameRoom) {
        availableList.push({
          fac: f,
          type: 'SAME_LOCATION',
          label: `✓ ${f.name} (Co-located - Same Room: ${slot.room || 'Lab'})`
        });
      }
    }
  });

  if (availableList.length > 0) {
    facSelect.innerHTML = availableList.map(item => `<option value="${item.fac.id}">${item.label}</option>`).join('');
    if (availabilityNotice) {
      availabilityNotice.innerHTML = `<span style="color: #166534; font-size: 0.78rem; font-weight: 600; background: #dcfce7; padding: 4px 8px; border-radius: 4px; display: inline-block;">✓ Found ${availableList.length} available substitute professor(s) for ${dateDay} Period ${targetPeriod}.</span>`;
    }
  } else {
    facSelect.innerHTML = `<option value="" disabled selected>No faculty available (all busy in different rooms)</option>`;
    if (availabilityNotice) {
      availabilityNotice.innerHTML = `<span style="color: #dc2626; font-size: 0.78rem; font-weight: 600; background: #fee2e2; padding: 4px 8px; border-radius: 4px; display: inline-block;">⚠️ All department professors are teaching elsewhere on ${dateDay} Period ${targetPeriod}.</span>`;
    }
  }
}
