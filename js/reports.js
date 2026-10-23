// SAtendify Reports & Parent Communication Center
// High-agency frontend module for Admin, HOD, and Faculty
import { apiFetch, showToast } from './api.js';

// SVG Icons (Strictly NO emojis per design standards)
const ICONS = {
  copy: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  check: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  download: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  print: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`,
  filter: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>`,
  alert: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  user: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  calendar: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  arrowLeft: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`
};

// Module state
let currentRole = 'admin';
let metaData = null;
let activeSubView = 'daily'; // 'daily' | 'monthly' | 'subject' | 'dossier'
let cachedMonthlyData = null;
let cachedDailyData = null;
let cachedSubjectData = null;

// Format current date in IST
function getTodayIST() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  return ist.toISOString().split('T')[0];
}

function getCurrentMonthIST() {
  return getTodayIST().substring(0, 7);
}

// Formula Injection sanitizer for CSV export
function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let s = String(val).trim();
  // Prevent CSV Formula Injection
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  // Escape inner double quotes
  s = s.replace(/"/g, '""');
  return `"${s}"`;
}

// Download CSV helper
function downloadCsv(filename, headers, rows) {
  const headerRow = headers.map(sanitizeCsvCell).join(',');
  const dataRows = rows.map(r => r.map(sanitizeCsvCell).join(','));
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Copy to Clipboard with reliable fallback
async function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast(successMsg, 'success');
      return true;
    }
  } catch (e) {
    // Fallback to execCommand
  }
  
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-999999px';
  textarea.style.top = '-999999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg, 'success');
    document.body.removeChild(textarea);
    return true;
  } catch (err) {
    document.body.removeChild(textarea);
    showToast('Failed to copy to clipboard', 'error');
    return false;
  }
}

// =========================================================================
// MAIN ENTRY POINT
// =========================================================================
export async function renderReportsCenter(role = 'admin') {
  currentRole = role;
  const container = document.getElementById('dashboard-content');
  if (!container) return;

  // Render initial loading state
  container.innerHTML = `
    <div class="panel-card" style="padding: 32px; text-align: center;">
      <span class="skeleton-bar" style="width: 250px; height: 28px; margin: 0 auto 16px;"></span>
      <span class="skeleton-bar" style="width: 180px; height: 16px; margin: 0 auto 24px;"></span>
      <span class="skeleton-bar" style="width: 100%; height: 200px;"></span>
    </div>
  `;

  // Fetch meta options
  try {
    const metaRes = await apiFetch('/reports/filters-meta');
    if (metaRes && metaRes.success) {
      metaData = metaRes.data;
    } else {
      showToast('Could not load reports filters', 'error');
      metaData = {
        departments: [currentRole === 'admin' ? 'CE' : 'CE'],
        semesters: [1, 2, 3, 4, 5, 6],
        divisions: ['ALL', '241', '242', '251', '252'],
        subjects: [],
        userRole: currentRole,
        userDepartment: 'CE'
      };
    }
  } catch (e) {
    showToast(e.message || 'Error initializing reports', 'error');
  }

  const urlParams = new URLSearchParams(window.location.search);
  const initialSubView = urlParams.get('subview') || 'daily';
  const initialDate = urlParams.get('date') || getTodayIST();
  const initialMonth = urlParams.get('month') || getCurrentMonthIST();
  const initialDepartment = urlParams.get('department') || (metaData?.userDepartment || (metaData?.departments?.includes('IT') ? 'IT' : metaData?.departments?.[0] || 'IT'));
  const initialSemester = urlParams.get('semester') || '';

  buildReportsShell(container, { initialDate, initialMonth, initialDepartment, initialSemester });
  await switchSubView(initialSubView);
}

// =========================================================================
// SHELL & NAVIGATION BUILDER
// =========================================================================
function buildReportsShell(container, initialParams = {}) {
  const initDate = initialParams.initialDate || getTodayIST();
  const initMonth = initialParams.initialMonth || getCurrentMonthIST();
  const initDept = initialParams.initialDepartment || (metaData?.departments?.includes('IT') ? 'IT' : metaData?.departments?.[0] || 'IT');
  const initSem = initialParams.initialSemester || '';

  container.innerHTML = `
    <div class="reports-center-container" id="reports-center-container">
      
      <!-- Top Title & Navigation Pills -->
      <div class="reports-header-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
        <div>
          <h2 style="margin: 0 0 6px 0; font-size: 1.5rem; font-weight: 700; color: var(--text-dark, #0f172a); letter-spacing: -0.02em;">
            Reports & Parent Communication Center
          </h2>
          <p style="margin: 0; font-size: 0.875rem; color: var(--text-muted, #64748b);">
            Institutional academic registries, low-attendance audits, and parent notices.
          </p>
        </div>

        <!-- Sub-View Navigation Pills -->
        <div class="reports-nav-pills" role="tablist" style="display: flex; gap: 8px; background: #f1f5f9; padding: 4px; border-radius: 10px; border: 1px solid #e2e8f0;">
          <button class="report-nav-pill active" data-subview="daily" id="btn-subview-daily" type="button" style="padding: 8px 16px; border: none; background: #ffffff; color: var(--text-dark, #0f172a); font-size: 0.825rem; font-weight: 600; border-radius: 8px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: all 0.2s;">
            Daily Absentees
          </button>
          <button class="report-nav-pill" data-subview="monthly" id="btn-subview-monthly" type="button" style="padding: 8px 16px; border: none; background: transparent; color: #64748b; font-size: 0.825rem; font-weight: 600; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
            Monthly Summary (<75%)
          </button>
          <button class="report-nav-pill" data-subview="subject" id="btn-subview-subject" type="button" style="padding: 8px 16px; border: none; background: transparent; color: #64748b; font-size: 0.825rem; font-weight: 600; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
            Subject Deficiency
          </button>
        </div>
      </div>

      <!-- Unified Filter Control Bar -->
      <div class="reports-filter-panel" style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 18px 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
        <form id="reports-filter-form" style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end;">
          
          <!-- Department (Locked if HOD or Faculty) -->
          <div class="form-group" style="flex: 1 1 140px; min-width: 130px; margin-bottom: 0;">
            <label style="display: block; font-size: 0.775rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
              Department
            </label>
            <select id="rf-department" class="form-control" style="width: 100%; height: 38px; border-radius: 8px;" ${currentRole !== 'admin' ? 'disabled' : ''}>
              ${(metaData?.departments || ['IT']).map(d => `<option value="${d}" ${d === initDept ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>

          <!-- Semester -->
          <div class="form-group" style="flex: 1 1 110px; min-width: 100px; margin-bottom: 0;">
            <label style="display: block; font-size: 0.775rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
              Semester
            </label>
            <select id="rf-semester" class="form-control" style="width: 100%; height: 38px; border-radius: 8px;">
              <option value="" ${!initSem ? 'selected' : ''}>All Semesters</option>
              ${(metaData?.semesters || [1,2,3,4,5,6]).map(s => `<option value="${s}" ${String(s) === String(initSem) ? 'selected' : ''}>Sem ${s}</option>`).join('')}
            </select>
          </div>

          <!-- Division / Batch -->
          <div class="form-group" style="flex: 1 1 120px; min-width: 110px; margin-bottom: 0;">
            <label style="display: block; font-size: 0.775rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
              Division / Batch
            </label>
            <select id="rf-division" class="form-control" style="width: 100%; height: 38px; border-radius: 8px;">
              <option value="ALL">All Batches</option>
              ${(metaData?.divisions || ['241', '242', '251', '252']).filter(d => d !== 'ALL').map(d => `<option value="${d}">Batch ${d}</option>`).join('')}
            </select>
          </div>

          <!-- Date Selector (Used for Daily Absentee) -->
          <div class="form-group" id="rf-group-date" style="flex: 1 1 140px; min-width: 130px; margin-bottom: 0;">
            <label style="display: block; font-size: 0.775rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
              Date
            </label>
            <input type="date" id="rf-date" class="form-control" style="width: 100%; height: 38px; border-radius: 8px;" value="${initDate}">
          </div>

          <!-- Month Selector (Used for Monthly Report) -->
          <div class="form-group" id="rf-group-month" style="flex: 1 1 140px; min-width: 130px; margin-bottom: 0; display: none;">
            <label style="display: block; font-size: 0.775rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
              Reporting Month
            </label>
            <input type="month" id="rf-month" class="form-control" style="width: 100%; height: 38px; border-radius: 8px;" value="${initMonth}">
          </div>

          <!-- Calculation Mode Selector (Monthly vs Cumulative) -->
          <div class="form-group" id="rf-group-mode" style="flex: 1 1 140px; min-width: 130px; margin-bottom: 0; display: none;">
            <label style="display: block; font-size: 0.775rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
              Period Scope
            </label>
            <select id="rf-mode" class="form-control" style="width: 100%; height: 38px; border-radius: 8px;">
              <option value="monthly" selected>Calendar Month</option>
              <option value="cumulative">Cumulative to Month</option>
            </select>
          </div>

          <!-- Submit / Refresh Button -->
          <div class="form-group" style="margin-bottom: 0; flex: 0 0 auto;">
            <button type="submit" class="btn btn-primary" id="btn-fetch-report" style="height: 38px; padding: 0 20px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; font-weight: 600;">
              ${ICONS.filter} Apply Filters
            </button>
          </div>

        </form>
      </div>

      <!-- Main Dynamic Sub-View Workspace -->
      <div id="reports-subview-workspace"></div>

    </div>
  `;

  // Bind nav pills
  container.querySelectorAll('.report-nav-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const sub = btn.getAttribute('data-subview');
      switchSubView(sub);
    });
  });

  // Bind filter submit
  const form = document.getElementById('reports-filter-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      loadActiveSubViewData();
    });
  }
}

// Switch between report subviews
async function switchSubView(subview) {
  activeSubView = subview;

  // Update pills UI
  document.querySelectorAll('.report-nav-pill').forEach(b => {
    const isTarget = b.getAttribute('data-subview') === subview;
    b.classList.toggle('active', isTarget);
    if (isTarget) {
      b.style.background = '#ffffff';
      b.style.color = 'var(--text-dark, #0f172a)';
      b.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
    } else {
      b.style.background = 'transparent';
      b.style.color = '#64748b';
      b.style.boxShadow = 'none';
    }
  });

  // Toggle filter fields visibility based on subview
  const dateGrp = document.getElementById('rf-group-date');
  const monthGrp = document.getElementById('rf-group-month');
  const modeGrp = document.getElementById('rf-group-mode');

  if (subview === 'daily') {
    if (dateGrp) dateGrp.style.display = 'block';
    if (monthGrp) monthGrp.style.display = 'none';
    if (modeGrp) modeGrp.style.display = 'none';
  } else if (subview === 'monthly') {
    if (dateGrp) dateGrp.style.display = 'none';
    if (monthGrp) monthGrp.style.display = 'block';
    if (modeGrp) modeGrp.style.display = 'block';
  } else if (subview === 'subject') {
    if (dateGrp) dateGrp.style.display = 'none';
    if (monthGrp) monthGrp.style.display = 'none';
    if (modeGrp) modeGrp.style.display = 'none';
  }

  await loadActiveSubViewData();
}

// Load data for whichever subview is active
async function loadActiveSubViewData() {
  const workspace = document.getElementById('reports-subview-workspace');
  if (!workspace) return;

  workspace.innerHTML = `
    <div style="background: white; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 48px; text-align: center;">
      <span class="skeleton-bar" style="width: 240px; height: 24px; margin: 0 auto 12px;"></span>
      <span class="skeleton-bar" style="width: 160px; height: 16px; margin: 0 auto 24px;"></span>
      <span class="skeleton-bar" style="width: 100%; height: 160px;"></span>
    </div>
  `;

  if (activeSubView === 'daily') {
    await renderDailyAbsenteeView(workspace);
  } else if (activeSubView === 'monthly') {
    await renderMonthlySummaryView(workspace);
  } else if (activeSubView === 'subject') {
    await renderSubjectDeficiencyView(workspace);
  }
}

// Helper to read current filter values
function getFilterValues() {
  const deptEl = document.getElementById('rf-department');
  const semEl = document.getElementById('rf-semester');
  const divEl = document.getElementById('rf-division');
  const dateEl = document.getElementById('rf-date');
  const monthEl = document.getElementById('rf-month');
  const modeEl = document.getElementById('rf-mode');

  return {
    department: deptEl ? deptEl.value : 'CE',
    semester: semEl ? semEl.value : '',
    division: divEl ? divEl.value : 'ALL',
    date: dateEl ? dateEl.value : getTodayIST(),
    month: monthEl ? monthEl.value : getCurrentMonthIST(),
    mode: modeEl ? modeEl.value : 'monthly'
  };
}


// =========================================================================
// SUB-VIEW 1: DAILY LECTURE-WISE ABSENTEE REPORT
// =========================================================================
async function renderDailyAbsenteeView(workspace) {
  const filters = getFilterValues();
  const queryParams = new URLSearchParams();
  queryParams.set('date', filters.date);
  if (filters.department) queryParams.set('department', filters.department);
  if (filters.semester) queryParams.set('semester', filters.semester);
  if (filters.division) queryParams.set('division', filters.division);

  try {
    const res = await apiFetch(`/reports/daily-absentee?${queryParams.toString()}`);
    if (!res || !res.success) {
      workspace.innerHTML = `<div class="empty-state"><h3>Unable to load absentee records</h3><p>${res?.error || 'Server error'}</p></div>`;
      return;
    }

    cachedDailyData = res.data;
    const { sessions, totalSessions, totalAbsences, uniqueAbsentCount, date } = res.data;

    if (!sessions || sessions.length === 0) {
      workspace.innerHTML = `
        <div style="background: white; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 48px; text-align: center;">
          <h3 style="margin: 0 0 8px 0; font-size: 1.15rem; color: #1e293b;">No Attendance Sessions Found</h3>
          <p style="margin: 0; font-size: 0.875rem; color: #64748b;">
            No lecture or lab sessions were submitted for ${date} matching the selected department/semester filters.
          </p>
        </div>
      `;
      return;
    }

    // Metric Summary Cards
    const metricsHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size: 0.775rem; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">
            Lectures Conducted
          </div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #0f172a; font-family: monospace;">
            ${totalSessions}
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size: 0.775rem; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">
            Unique Absent Students
          </div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #e11d48; font-family: monospace;">
            ${uniqueAbsentCount}
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size: 0.775rem; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">
            Total Session Absences
          </div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #d97706; font-family: monospace;">
            ${totalAbsences}
          </div>
        </div>
      </div>
    `;

    // Export Action Bar
    const exportBarHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <div style="font-size: 0.9rem; font-weight: 600; color: #334155;">
          Attendance Sessions for ${date} (${sessions.length} Recorded)
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary" id="btn-export-daily-csv" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.825rem; font-weight: 600; height: 36px; padding: 0 14px; border-radius: 8px;">
            ${ICONS.download} Export Absentees CSV
          </button>
        </div>
      </div>
    `;

    // Sessions Cards Grid
    const sessionsHTML = sessions.map((s, idx) => {
      const absentRoster = s.absentStudents || [];
      const hasAbsentees = absentRoster.length > 0;

      return `
        <div class="panel-card" style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          
          <!-- Session Header Row -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 0.775rem;">Period ${s.period}</span>
                <span class="badge" style="background: #f1f5f9; color: #475569; font-weight: 600; font-size: 0.775rem;">${s.type.toUpperCase()}</span>
                <span class="badge" style="background: #f8fafc; color: #64748b; font-size: 0.775rem; border: 1px solid #e2e8f0;">${s.displayDivision}</span>
              </div>
              <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #0f172a;">
                ${s.subjectCode} - ${s.subjectName}
              </h3>
              <div style="font-size: 0.825rem; color: #64748b; margin-top: 4px;">
                Faculty: <strong style="color: #334155;">${s.facultyName}</strong> | Department: ${s.department} Sem ${s.semester}
              </div>
            </div>

            <!-- Attendance Stats Badges & WhatsApp Copy -->
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span style="font-size: 0.825rem; color: #15803d; background: #dcfce7; padding: 4px 10px; border-radius: 6px; font-weight: 600;">
                Present: ${s.presentCount}
              </span>
              <span style="font-size: 0.825rem; color: #b91c1c; background: #fee2e2; padding: 4px 10px; border-radius: 6px; font-weight: 600;">
                Absent: ${s.absentCount}
              </span>
              <button class="btn btn-outline btn-copy-wa" data-session-index="${idx}" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; height: 34px; padding: 0 12px; border-radius: 6px; font-weight: 600; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; cursor: pointer;">
                ${ICONS.copy} Copy WhatsApp Notice
              </button>
            </div>
          </div>

          <!-- Absent Students Table / List -->
          <div style="margin-top: 16px;">
            ${!hasAbsentees ? `
              <div style="padding: 12px; background: #f0fdf4; border-radius: 8px; color: #166534; font-size: 0.85rem; font-weight: 500;">
                100% Attendance recorded for this session. No absentees.
              </div>
            ` : `
              <div class="table-responsive" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                  <thead>
                    <tr style="border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 0.775rem; text-transform: uppercase;">
                      <th style="padding: 8px 12px; font-weight: 600;">#</th>
                      <th style="padding: 8px 12px; font-weight: 600;">Roll Number</th>
                      <th style="padding: 8px 12px; font-weight: 600;">Student Name</th>
                      <th style="padding: 8px 12px; font-weight: 600;">Parent / Student Contact</th>
                      <th style="padding: 8px 12px; font-weight: 600; text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${absentRoster.map((st, i) => `
                      <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 12px; color: #94a3b8; font-family: monospace;">${i + 1}</td>
                        <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; font-family: monospace;">${st.rollNumber}</td>
                        <td style="padding: 10px 12px; color: #334155; font-weight: 500;">${st.name}</td>
                        <td style="padding: 10px 12px; color: #475569; font-family: monospace;">${st.mobile}</td>
                        <td style="padding: 10px 12px; text-align: right;">
                          <button class="btn btn-outline btn-view-dossier" data-student-id="${st.studentId}" style="font-size: 0.775rem; padding: 4px 10px; border-radius: 6px; cursor: pointer;">
                            View Dossier
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

        </div>
      `;
    }).join('');

    workspace.innerHTML = metricsHTML + exportBarHTML + sessionsHTML;

    // Bind WhatsApp Copy buttons
    workspace.querySelectorAll('.btn-copy-wa').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-session-index'), 10);
        const session = sessions[idx];
        if (session && session.whatsappNotice) {
          copyToClipboard(session.whatsappNotice, `Copied WhatsApp notice for Period ${session.period} (${session.subjectCode})`);
        }
      });
    });

    // Bind View Dossier buttons
    workspace.querySelectorAll('.btn-view-dossier').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-student-id');
        openStudentDossierModal(sid);
      });
    });

    // Bind CSV Export button
    const csvBtn = document.getElementById('btn-export-daily-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', () => {
        exportDailyAbsenteesToCSV(sessions, date);
      });
    }

  } catch (err) {
    workspace.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

// Daily CSV Export Helper
function exportDailyAbsenteesToCSV(sessions, date) {
  const headers = ['Date', 'Period', 'Type', 'Department', 'Semester', 'Division', 'Subject Code', 'Subject Name', 'Faculty Name', 'Roll Number', 'Student Name', 'Parent Mobile'];
  const rows = [];

  sessions.forEach(s => {
    (s.absentStudents || []).forEach(st => {
      rows.push([
        date,
        s.period,
        s.type,
        s.department,
        s.semester,
        s.displayDivision,
        s.subjectCode,
        s.subjectName,
        s.facultyName,
        st.rollNumber,
        st.name,
        st.mobile
      ]);
    });
  });

  if (rows.length === 0) {
    showToast('No absentees to export for this date', 'warning');
    return;
  }

  downloadCsv(`SAtendify_Daily_Absentees_${date}.csv`, headers, rows);
  showToast(`Exported ${rows.length} absentee entries to CSV`, 'success');
}


// =========================================================================
// SUB-VIEW 2: MONTHLY OVERALL LOW-ATTENDANCE REPORT (< 75%)
// =========================================================================
async function renderMonthlySummaryView(workspace) {
  const filters = getFilterValues();
  const queryParams = new URLSearchParams();
  queryParams.set('month', filters.month);
  if (filters.department) queryParams.set('department', filters.department);
  if (filters.semester) queryParams.set('semester', filters.semester);
  if (filters.division) queryParams.set('division', filters.division);
  queryParams.set('mode', filters.mode);
  queryParams.set('threshold', '75.0');

  try {
    const res = await apiFetch(`/reports/monthly-summary?${queryParams.toString()}`);
    if (!res || !res.success) {
      workspace.innerHTML = `<div class="empty-state"><h3>Unable to load monthly summary</h3><p>${res?.error || 'Server error'}</p></div>`;
      return;
    }

    cachedMonthlyData = res.data;
    const { students, totalStudentsEvaluated, lowAttendanceCount, cohortAverage, reportingPeriod, mode } = res.data;

    // Filter toggle state inside view (All Students vs Only Deficient < 75%)
    let showOnlyDeficient = true;

    function renderTableRows() {
      const filteredList = showOnlyDeficient ? students.filter(s => s.isDeficient) : students;
      
      if (filteredList.length === 0) {
        return `
          <tr>
            <td colspan="9" style="text-align: center; padding: 32px; color: #64748b;">
              ${showOnlyDeficient ? 'No students with attendance below 75% found in this cohort.' : 'No students found.'}
            </td>
          </tr>
        `;
      }

      return filteredList.map((st, idx) => {
        let badgeHTML = '';
        if (st.percentage === null || st.total === 0) {
          badgeHTML = `<span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.775rem; background: #f1f5f9; color: #64748b;">No Attendance Data</span>`;
        } else {
          let badgeColor = '#16a34a';
          let badgeBg = '#dcfce7';
          if (st.category === 'critical') {
            badgeColor = '#e11d48';
            badgeBg = '#ffe4e6';
          } else if (st.category === 'warning') {
            badgeColor = '#d97706';
            badgeBg = '#fef3c7';
          }
          badgeHTML = `<span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.825rem; font-family: monospace; background: ${badgeBg}; color: ${badgeColor};">${st.percentage}%</span>`;
        }

        return `
          <tr style="border-bottom: 1px solid #f1f5f9; ${st.isDeficient ? 'background: #fffbfa;' : ''}">
            <td style="padding: 12px; color: #94a3b8; font-family: monospace;">${idx + 1}</td>
            <td style="padding: 12px; font-weight: 700; color: #0f172a; font-family: monospace;">${st.rollNumber}</td>
            <td style="padding: 12px; font-weight: 600; color: #334155;">${st.name}</td>
            <td style="padding: 12px; color: #64748b; font-family: monospace;">${st.department} Sem ${st.semester} (${st.division})</td>
            <td style="padding: 12px; color: #475569; font-family: monospace;">${st.parentMobile}</td>
            <td style="padding: 12px; text-align: center; font-family: monospace;">${st.present}</td>
            <td style="padding: 12px; text-align: center; font-family: monospace;">${st.total}</td>
            <td style="padding: 12px; text-align: center;">
              ${badgeHTML}
            </td>
            <td style="padding: 12px; text-align: right;">
              <button class="btn btn-outline btn-dossier" data-sid="${st.studentId}" style="font-size: 0.775rem; padding: 5px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                Notice / Dossier
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    const html = `
      <!-- Metric Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size: 0.775rem; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">
            Cohort Evaluated
          </div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #0f172a; font-family: monospace;">
            ${totalStudentsEvaluated} Students
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size: 0.775rem; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">
            Deficient (< 75%)
          </div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #e11d48; font-family: monospace;">
            ${lowAttendanceCount} Students
          </div>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size: 0.775rem; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;">
            Class Average
          </div>
          <div style="font-size: 1.75rem; font-weight: 700; color: ${cohortAverage !== null && cohortAverage < 75 ? '#d97706' : '#16a34a'}; font-family: monospace;">
            ${cohortAverage !== null ? `${cohortAverage}%` : '<span style="font-size: 1rem; color: #64748b;">No Attendance Data</span>'}
          </div>
        </div>
      </div>

      <!-- Table Panel -->
      <div class="panel-card" style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
        
        <!-- Header & Action Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="margin: 0 0 4px 0; font-size: 1.15rem; font-weight: 700; color: #0f172a;">
              Attendance Audit Roster
            </h3>
            <div style="font-size: 0.85rem; color: #64748b;">
              Reporting Period: <strong style="color: #0f172a;">${reportingPeriod}</strong> (${mode === 'monthly' ? 'Calendar Month' : 'Cumulative'})
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <!-- Filter View Toggle -->
            <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: #475569; cursor: pointer; user-select: none;">
              <input type="checkbox" id="chk-deficient-only" checked style="width: 16px; height: 16px; accent-color: var(--primary-color, #2563eb);">
              <span>Show Deficient Only (< 75%)</span>
            </label>

            <!-- CSV Export -->
            <button class="btn btn-secondary" id="btn-export-monthly-csv" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.825rem; font-weight: 600; height: 36px; padding: 0 14px; border-radius: 8px;">
              ${ICONS.download} Export CSV
            </button>
          </div>
        </div>

        <!-- Student Table -->
        <div class="table-responsive" style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 0.775rem; text-transform: uppercase;">
                <th style="padding: 10px 12px; font-weight: 600;">#</th>
                <th style="padding: 10px 12px; font-weight: 600;">Roll Number</th>
                <th style="padding: 10px 12px; font-weight: 600;">Student Name</th>
                <th style="padding: 10px 12px; font-weight: 600;">Cohort</th>
                <th style="padding: 10px 12px; font-weight: 600;">Parent Mobile</th>
                <th style="padding: 10px 12px; font-weight: 600; text-align: center;">Attended</th>
                <th style="padding: 10px 12px; font-weight: 600; text-align: center;">Total</th>
                <th style="padding: 10px 12px; font-weight: 600; text-align: center;">Attendance %</th>
                <th style="padding: 10px 12px; font-weight: 600; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="monthly-table-body">
              ${renderTableRows()}
            </tbody>
          </table>
        </div>

      </div>
    `;

    workspace.innerHTML = html;

    // Bind Deficient Toggle
    const chk = document.getElementById('chk-deficient-only');
    const tbody = document.getElementById('monthly-table-body');
    if (chk && tbody) {
      chk.addEventListener('change', () => {
        showOnlyDeficient = chk.checked;
        tbody.innerHTML = renderTableRows();
        bindDossierButtons(tbody);
      });
    }

    // Bind Dossier Buttons
    bindDossierButtons(workspace);

    // Bind CSV Export
    const csvBtn = document.getElementById('btn-export-monthly-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', () => {
        const rows = students.map(st => [
          st.rollNumber,
          st.name,
          st.department,
          st.semester,
          st.division,
          st.parentMobile,
          st.present,
          st.absent,
          st.leave,
          st.total,
          st.percentage !== null ? st.percentage + '%' : 'No Attendance Data',
          st.percentage !== null ? (st.isDeficient ? 'Deficient (<75%)' : 'Satisfactory') : 'No Attendance Data'
        ]);
        const headers = ['Roll Number', 'Student Name', 'Department', 'Semester', 'Division', 'Parent Mobile', 'Present', 'Absent', 'Leave', 'Total Lectures', 'Attendance %', 'Status'];
        downloadCsv(`SAtendify_Attendance_Report_${filters.month}.csv`, headers, rows);
        showToast('Monthly summary exported to CSV', 'success');
      });
    }

  } catch (err) {
    workspace.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

function bindDossierButtons(container) {
  container.querySelectorAll('.btn-dossier').forEach(btn => {
    btn.addEventListener('click', () => {
      const sid = btn.getAttribute('data-sid');
      openStudentDossierModal(sid);
    });
  });
}


// =========================================================================
// SUB-VIEW 3: SUBJECT-WISE ATTENDANCE DEFICIENCY REPORT
// =========================================================================
async function renderSubjectDeficiencyView(workspace) {
  const filters = getFilterValues();
  const queryParams = new URLSearchParams();
  if (filters.department) queryParams.set('department', filters.department);
  if (filters.semester) queryParams.set('semester', filters.semester);
  if (filters.division) queryParams.set('division', filters.division);
  queryParams.set('threshold', '75.0');

  try {
    const res = await apiFetch(`/reports/subject-deficiency?${queryParams.toString()}`);
    if (!res || !res.success) {
      workspace.innerHTML = `<div class="empty-state"><h3>Unable to load subject breakdown</h3><p>${res?.error || 'Server error'}</p></div>`;
      return;
    }

    cachedSubjectData = res.data;
    const { subjects, department, semester } = res.data;

    if (!subjects || subjects.length === 0) {
      workspace.innerHTML = `
        <div style="background: white; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 48px; text-align: center;">
          <h3 style="margin: 0 0 8px 0; color: #1e293b;">No Curriculum Subjects Found</h3>
          <p style="margin: 0; color: #64748b;">No subjects mapped for ${department} Semester ${semester || 'All'}.</p>
        </div>
      `;
      return;
    }

    const html = `
      <div style="margin-bottom: 24px;">
        <h3 style="margin: 0 0 6px 0; font-size: 1.25rem; font-weight: 700; color: #0f172a;">
          Subject-wise Attendance Deficiency Audit
        </h3>
        <p style="margin: 0; font-size: 0.85rem; color: #64748b;">
          Breakdown of students falling below 75% attendance in individual academic subjects.
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 24px;">
        ${subjects.map(sub => `
          <div class="panel-card" style="background: #ffffff; border: 1px solid var(--border-color, #e2e8f0); border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            
            <!-- Subject Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span class="badge" style="background: #e2e8f0; color: #0f172a; font-weight: 700; font-family: monospace;">${sub.subjectCode}</span>
                  <span class="badge" style="background: #f1f5f9; color: #64748b;">Sem ${sub.semester}</span>
                </div>
                <h4 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #0f172a;">
                  ${sub.subjectName}
                </h4>
                <div style="font-size: 0.825rem; color: #64748b; margin-top: 4px;">
                  Faculty In-Charge: <strong style="color: #334155;">${sub.facultyName}</strong> | Conducted: ${sub.lecturesConducted} Lectures
                </div>
              </div>

              <!-- Metrics -->
              <div style="display: flex; gap: 12px; align-items: center;">
                <div style="text-align: right;">
                  <div style="font-size: 0.775rem; color: #64748b; text-transform: uppercase;">Class Avg</div>
                  <div style="font-size: 1.15rem; font-weight: 700; font-family: monospace; color: ${sub.subjectAverage !== null && sub.subjectAverage < 75 ? '#d97706' : '#16a34a'};">
                    ${sub.subjectAverage !== null ? `${sub.subjectAverage}%` : 'No Attendance Data'}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 0.775rem; color: #64748b; text-transform: uppercase;">Deficient (< 75%)</div>
                  <div style="font-size: 1.15rem; font-weight: 700; font-family: monospace; color: ${sub.deficientCount > 0 ? '#e11d48' : '#16a34a'};">
                    ${sub.deficientCount} Students
                  </div>
                </div>
              </div>
            </div>

            <!-- Deficient Students Table -->
            <div style="margin-top: 16px;">
              ${sub.deficientCount === 0 ? `
                <div style="padding: 12px; background: #f0fdf4; border-radius: 8px; color: #166534; font-size: 0.85rem; font-weight: 500;">
                  No attendance deficiencies found for ${sub.subjectName}. All enrolled students maintain >= 75%.
                </div>
              ` : `
                <div class="table-responsive" style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                    <thead>
                      <tr style="border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 0.775rem; text-transform: uppercase;">
                        <th style="padding: 8px 12px;">Roll Number</th>
                        <th style="padding: 8px 12px;">Student Name</th>
                        <th style="padding: 8px 12px;">Batch</th>
                        <th style="padding: 8px 12px;">Parent Mobile</th>
                        <th style="padding: 8px 12px; text-align: center;">Attended / Total</th>
                        <th style="padding: 8px 12px; text-align: center;">Percentage</th>
                        <th style="padding: 8px 12px; text-align: right;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sub.deficientStudents.map(st => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                          <td style="padding: 8px 12px; font-weight: 700; color: #0f172a; font-family: monospace;">${st.rollNumber}</td>
                          <td style="padding: 8px 12px; font-weight: 500; color: #334155;">${st.name}</td>
                          <td style="padding: 8px 12px; color: #64748b;">${st.division}</td>
                          <td style="padding: 8px 12px; color: #475569; font-family: monospace;">${st.parentMobile}</td>
                          <td style="padding: 8px 12px; text-align: center; font-family: monospace;">${st.attended} / ${st.total}</td>
                          <td style="padding: 8px 12px; text-align: center;">
                            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.8rem; font-family: monospace; background: #fee2e2; color: #b91c1c;">
                              ${st.percentage}%
                            </span>
                          </td>
                          <td style="padding: 8px 12px; text-align: right;">
                            <button class="btn btn-outline btn-dossier" data-sid="${st.studentId}" style="font-size: 0.75rem; padding: 3px 10px; border-radius: 4px; cursor: pointer;">
                              Notice
                            </button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>

          </div>
        `).join('')}
      </div>
    `;

    workspace.innerHTML = html;
    bindDossierButtons(workspace);

  } catch (err) {
    workspace.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${err.message}</p></div>`;
  }
}


// =========================================================================
// SUB-VIEW 4: INDIVIDUAL STUDENT DOSSIER & PRINTABLE PARENT ACKNOWLEDGEMENT
// =========================================================================
async function openStudentDossierModal(studentId) {
  let modalWin = document.getElementById('reports-modal-overlay');
  if (!modalWin) {
    modalWin = document.createElement('div');
    modalWin.id = 'reports-modal-overlay';
    modalWin.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 20px; box-sizing: border-box;
    `;
    document.body.appendChild(modalWin);
  }

  modalWin.style.display = 'flex';
  modalWin.innerHTML = `
    <div style="background: white; border-radius: 14px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative;">
      <div style="text-align: center; padding: 32px;">
        <span class="skeleton-bar" style="width: 200px; height: 24px; margin: 0 auto 12px;"></span>
        <span class="skeleton-bar" style="width: 100%; height: 200px;"></span>
      </div>
    </div>
  `;

  try {
    const res = await apiFetch(`/reports/student-dossier/${studentId}`);
    if (!res || !res.success) {
      modalWin.innerHTML = `
        <div style="background: white; border-radius: 14px; max-width: 500px; width: 100%; padding: 24px; text-align: center;">
          <h3 style="color: #e11d48; margin-top: 0;">Access Denied</h3>
          <p style="color: #64748b;">${res?.error || 'Unable to load student record'}</p>
          <button class="btn btn-secondary" onclick="document.getElementById('reports-modal-overlay').style.display='none'">Close</button>
        </div>
      `;
      return;
    }

    const { student, attendance, subjectBreakdown, monthlyTrend, recentHistory, parentNotice } = res.data;

    modalWin.innerHTML = `
      <div class="reports-modal-container" style="background: white; border-radius: 14px; max-width: 850px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); position: relative;">
        
        <!-- Modal Top Bar -->
        <div class="modal-top-bar" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: #ffffff; z-index: 10;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: 700; font-size: 1.1rem; color: #0f172a;">Student Attendance Dossier</span>
            <span class="badge ${attendance.overallPercentage !== null ? (attendance.overallPercentage < 75 ? 'badge-danger' : 'badge-success') : ''}" style="font-weight: 700; font-family: monospace;">
              ${attendance.overallPercentage !== null ? `${attendance.overallPercentage}% Cumulative` : 'No Attendance Data'}
            </span>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-primary" id="btn-print-parent-notice" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.825rem; height: 34px; padding: 0 14px; border-radius: 6px; font-weight: 600;">
              ${ICONS.print} Print Parent Notice
            </button>
            <button class="btn btn-secondary" id="btn-close-dossier" style="border: none; background: #f1f5f9; color: #475569; width: 34px; height: 34px; border-radius: 6px; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              &times;
            </button>
          </div>
        </div>

        <!-- Printable Document Area -->
        <div id="printable-parent-notice" style="padding: 28px 32px;">
          
          <!-- College Header (For Formal Print Notice) -->
          <div class="official-college-header" style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 4px 0; font-size: 1.35rem; font-weight: 800; color: #0f172a; letter-spacing: -0.01em;">
              ${parentNotice.collegeName}
            </h2>
            <h4 style="margin: 0 0 6px 0; font-size: 1rem; font-weight: 600; color: #475569;">
              ${parentNotice.departmentName}
            </h4>
            <div style="font-size: 0.8rem; color: #64748b; font-weight: 500;">
              Ref: <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${parentNotice.refNumber}</span> | Date: ${parentNotice.noticeDate}
            </div>
            <div style="display: inline-block; margin-top: 10px; padding: 4px 16px; background: #0f172a; color: #ffffff; border-radius: 4px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
              Formal Intimation of Attendance Deficiency & Parent Acknowledgement
            </div>
          </div>

          <!-- Student Particulars Card -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 0.85rem;">
              <div>
                <span style="color: #64748b; display: block; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Student Name</span>
                <strong style="color: #0f172a; font-size: 0.95rem;">${student.name}</strong>
              </div>
              <div>
                <span style="color: #64748b; display: block; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Roll Number / Enrollment</span>
                <strong style="color: #0f172a; font-family: monospace;">${student.rollNumber}</strong>
              </div>
              <div>
                <span style="color: #64748b; display: block; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Department & Semester</span>
                <strong style="color: #0f172a;">${student.department} / Semester ${student.semester}</strong>
              </div>
              <div>
                <span style="color: #64748b; display: block; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Division / Batch</span>
                <strong style="color: #0f172a;">Batch ${student.division}</strong>
              </div>
              <div>
                <span style="color: #64748b; display: block; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Parent Contact</span>
                <strong style="color: #0f172a; font-family: monospace;">${student.parentMobile}</strong>
              </div>
              <div>
                <span style="color: #64748b; display: block; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Overall Attendance</span>
                <strong style="color: ${attendance.overallPercentage !== null ? (attendance.overallPercentage < 75 ? '#e11d48' : '#16a34a') : '#64748b'}; font-family: monospace; font-size: 1.05rem;">
                  ${attendance.overallPercentage !== null ? `${attendance.overallPercentage}% (${attendance.attended} / ${attendance.conducted})` : 'No Attendance Data (0 conducted)'}
                </strong>
              </div>
            </div>
          </div>

          <!-- Official Academic Notice Paragraph -->
          <div style="padding: 14px 18px; background: #fff1f2; border-left: 4px solid #e11d48; border-radius: 4px; margin-bottom: 24px; font-size: 0.85rem; line-height: 1.5; color: #881337;">
            <strong>ATTENDANCE DEFICIENCY NOTICE:</strong> ${parentNotice.warningStatement}
            Please review the subject-wise breakdown below. Failure to maintain 75% attendance will lead to detention from university examinations.
          </div>

          <!-- Subject-wise Attendance Table -->
          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.03em;">
              Subject-wise Cumulative Academic Registry
            </h4>
            <div class="table-responsive" style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left; border: 1px solid #e2e8f0;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; color: #334155; font-size: 0.775rem; text-transform: uppercase;">
                    <th style="padding: 8px 12px; border-right: 1px solid #e2e8f0;">Subject Code</th>
                    <th style="padding: 8px 12px; border-right: 1px solid #e2e8f0;">Subject Name</th>
                    <th style="padding: 8px 12px; border-right: 1px solid #e2e8f0;">Faculty</th>
                    <th style="padding: 8px 12px; text-align: center; border-right: 1px solid #e2e8f0;">Conducted</th>
                    <th style="padding: 8px 12px; text-align: center; border-right: 1px solid #e2e8f0;">Attended</th>
                    <th style="padding: 8px 12px; text-align: center; border-right: 1px solid #e2e8f0;">Percentage</th>
                    <th style="padding: 8px 12px; text-align: center;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${subjectBreakdown.map(sb => `
                    <tr style="border-bottom: 1px solid #e2e8f0; ${sb.isDeficient ? 'background: #fff8f8;' : ''}">
                      <td style="padding: 8px 12px; font-family: monospace; font-weight: 600; border-right: 1px solid #e2e8f0;">${sb.code}</td>
                      <td style="padding: 8px 12px; border-right: 1px solid #e2e8f0; font-weight: 500;">${sb.name}</td>
                      <td style="padding: 8px 12px; border-right: 1px solid #e2e8f0; color: #475569;">${sb.facultyName}</td>
                      <td style="padding: 8px 12px; text-align: center; font-family: monospace; border-right: 1px solid #e2e8f0;">${sb.total}</td>
                      <td style="padding: 8px 12px; text-align: center; font-family: monospace; border-right: 1px solid #e2e8f0;">${sb.attended}</td>
                      <td style="padding: 8px 12px; text-align: center; font-family: monospace; font-weight: 700; color: ${sb.percentage !== null ? (sb.isDeficient ? '#e11d48' : '#16a34a') : '#64748b'}; border-right: 1px solid #e2e8f0;">
                        ${sb.percentage !== null ? `${sb.percentage}%` : 'No Attendance Data'}
                      </td>
                      <td style="padding: 8px 12px; text-align: center;">
                        <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: ${sb.percentage !== null ? (sb.isDeficient ? '#e11d48' : '#16a34a') : '#64748b'};">
                          ${sb.percentage !== null ? (sb.isDeficient ? 'DEFICIENT' : 'ELIGIBLE') : 'NO ATTENDANCE DATA'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Formal Blank Physical Signature Lines (Crucial for Printed Parent Acknowledgement) -->
          <div class="physical-signature-section" style="margin-top: 48px; padding-top: 24px; border-top: 1px dashed #cbd5e1;">
            <p style="font-size: 0.8rem; color: #475569; margin-bottom: 36px; line-height: 1.4;">
              <strong>Parent Declaration:</strong> I hereby acknowledge receipt of this official attendance statement for my ward. I have noted the current attendance deficiency and have counseled my ward to attend all scheduled classes regularly.
            </p>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center; font-size: 0.8rem;">
              <div>
                <div style="border-bottom: 1px solid #475569; height: 40px; margin-bottom: 6px;"></div>
                <div style="font-weight: 600; color: #0f172a;">Student Signature</div>
                <div style="font-size: 0.725rem; color: #64748b;">Date: ___________</div>
              </div>

              <div>
                <div style="border-bottom: 1px solid #475569; height: 40px; margin-bottom: 6px;"></div>
                <div style="font-weight: 600; color: #0f172a;">Parent / Guardian Signature</div>
                <div style="font-size: 0.725rem; color: #64748b;">Contact: ___________</div>
              </div>

              <div>
                <div style="border-bottom: 1px solid #475569; height: 40px; margin-bottom: 6px;"></div>
                <div style="font-weight: 600; color: #0f172a;">Faculty / Mentor</div>
                <div style="font-size: 0.725rem; color: #64748b;">Signature</div>
              </div>

              <div>
                <div style="border-bottom: 1px solid #475569; height: 40px; margin-bottom: 6px;"></div>
                <div style="font-weight: 600; color: #0f172a;">Head of Department (HOD)</div>
                <div style="font-size: 0.725rem; color: #64748b;">Seal & Signature</div>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;

    // Bind Close
    const closeBtn = document.getElementById('btn-close-dossier');
    if (closeBtn) closeBtn.onclick = () => { modalWin.style.display = 'none'; };

    // Bind Print
    const printBtn = document.getElementById('btn-print-parent-notice');
    if (printBtn) {
      printBtn.onclick = () => {
        document.body.classList.add('printing-parent-notice');
        window.print();
      };
    }
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-parent-notice');
    }, { once: true });

  } catch (err) {
    modalWin.innerHTML = `
      <div style="background: white; border-radius: 14px; max-width: 500px; width: 100%; padding: 24px; text-align: center;">
        <h3 style="color: #e11d48;">Error</h3>
        <p style="color: #64748b;">${err.message}</p>
        <button class="btn btn-secondary" onclick="document.getElementById('reports-modal-overlay').style.display='none'">Close</button>
      </div>
    `;
  }
}
