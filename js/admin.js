// SAtendify Admin Dashboard Controller
import { guardRoute } from './auth.js';
import { initializeChrome } from './main.js';
import { apiFetch, showToast } from './api.js';

// Route guard validation
const user = guardRoute(['admin']);
if (user) {
  window.addEventListener('DOMContentLoaded', () => initAdminDashboard());
  window.addEventListener('popstate', () => initAdminDashboard());
  window.addEventListener('tabchange', (e) => initAdminDashboard(e.detail ? e.detail.tab : null));
}

// Global modal elements reference
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

async function initAdminDashboard(forcedTab = null) {
  // Bind modal DOM references
  modalBackdrop = document.getElementById('admin-modal');
  modalTitle = document.getElementById('modal-panel-title');
  modalClose = document.getElementById('modal-close');
  modalCancel = document.getElementById('modal-cancel-btn');
  modalForm = document.getElementById('modal-form-element');
  modalContent = document.getElementById('modal-form-content');

  // Fetch semester configurations
  const configRes = await apiFetch('/admin/semester-config');
  if (configRes.success) {
    semesterConfigs = configRes.data;
  }

  // Modal exit bindings
  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);
  modalForm.addEventListener('submit', handleModalSubmit);

  // Parse active tab parameter
  const urlParams = new URLSearchParams(window.location.search);
  const activeTab = forcedTab || urlParams.get('tab') || 'overview';

  // Render navbar navigation chrome
  initializeChrome(activeTab, getPageTitleForTab(activeTab));

  // Load relevant view modules
  switch (activeTab) {
    case 'overview':
      await renderOverviewTab();
      break;
    case 'departments':
      await renderDepartmentsTab();
      break;
    case 'faculty':
      await renderFacultyTab();
      break;
    case 'students':
      await renderStudentsTab();
      break;
    case 'users':
      await renderFacultyTab();
      break;
    case 'timetable':
      await renderTimetableTab();
      break;
    case 'attendance':
      await renderAttendanceTab();
      break;
    default:
      await renderOverviewTab();
  }
}

function getPageTitleForTab(tab) {
  switch (tab) {
    case 'overview': return 'Dashboard';
    case 'departments': return 'Subjects';
    case 'faculty': return 'Faculty';
    case 'students': return 'Students';
    case 'users': return 'Academic Registers';
    case 'timetable': return 'Timetable';
    case 'attendance': return 'Attendance Logs';
    default: return 'Dashboard';
  }
}

// Modal Utility functions
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

    if (success) {
      closeModal();
    }
  }
}

// Chart pointers to prevent canvas re-use exceptions
let adminDeptChartInstance = null;
let adminTrendChartInstance = null;

// ==========================================
// 1. OVERVIEW TAB CONTROLLER (Executive Dashboard)
// ==========================================
async function renderOverviewTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 260px;"></div>`;

  const res = await apiFetch('/admin/analytics');
  if (!res.success) return;

  const data = res.data;

  container.innerHTML = `
    <!-- Top Executive Welcome & Action Banner -->
    <div class="admin-welcome-banner">
      <div>
        <h2 class="admin-welcome-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#6366f1;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          <span>Executive Academic Console</span>
        </h2>
        <p class="admin-welcome-subtitle">Real-time institutional attendance metrics, stream compliance & system operations</p>
      </div>
      <div class="admin-banner-actions">
        <a href="admin.html?tab=faculty" class="btn btn-secondary" style="background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.25); display:inline-flex; align-items:center; gap:6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          Manage Faculty
        </a>
        <a href="admin.html?tab=students" class="btn btn-secondary" style="background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.25); display:inline-flex; align-items:center; gap:6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          Student Directory
        </a>
        <a href="admin.html?tab=timetable" class="btn btn-primary" style="box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); display:inline-flex; align-items:center; gap:6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Timetable Builder
        </a>
      </div>
    </div>

    <!-- Executive KPI Metric Cards -->
    <div class="stats-grid">
      <div class="stat-card-executive">
        <div class="stat-card-top">
          <div class="stat-card-value-group">
            <span class="stat-label">Total Student Enrollment</span>
            <span class="stat-value">${data.totalStudents}</span>
          </div>
          <div class="stat-card-icon stat-icon-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
        </div>
        <div>
          <span class="badge badge-primary">Active Roster</span>
          <span class="stat-desc" style="display:block; margin-top:4px;">Across 5 Engineering Streams</span>
        </div>
      </div>

      <div class="stat-card-executive">
        <div class="stat-card-top">
          <div class="stat-card-value-group">
            <span class="stat-label">Academic Faculty & HODs</span>
            <span class="stat-value">${data.totalFaculty}</span>
          </div>
          <div class="stat-card-icon stat-icon-purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
        </div>
        <div>
          <span class="badge badge-success">Assigned Staff</span>
          <span class="stat-desc" style="display:block; margin-top:4px;">Teaching & Department Heads</span>
        </div>
      </div>

      <div class="stat-card-executive">
        <div class="stat-card-top">
          <div class="stat-card-value-group">
            <span class="stat-label">Active Course Modules</span>
            <span class="stat-value">${data.totalSubjects}</span>
          </div>
          <div class="stat-card-icon stat-icon-amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
        </div>
        <div>
          <span class="badge badge-warning">Curriculum Subjects</span>
          <span class="stat-desc" style="display:block; margin-top:4px;">Semesters 1 - 6 Catalog</span>
        </div>
      </div>

      <div class="stat-card-executive">
        <div class="stat-card-top">
          <div class="stat-card-value-group">
            <span class="stat-label">Today's Regularity Rate</span>
            <span class="stat-value" style="color: ${data.averageAttendanceToday >= 75 ? 'var(--color-success)' : 'var(--color-danger)'};">${data.averageAttendanceToday}%</span>
          </div>
          <div class="stat-card-icon stat-icon-emerald">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
          </div>
        </div>
        <div>
          <div class="stat-progress-bar">
            <div class="stat-progress-fill" style="width: ${Math.min(100, data.averageAttendanceToday)}%; background: ${data.averageAttendanceToday >= 75 ? 'var(--color-success)' : 'var(--color-danger)'};"></div>
          </div>
          <span class="stat-desc" style="display:block; margin-top:6px;">Target Threshold: 75.0%</span>
        </div>
      </div>
    </div>

    <!-- Interactive Visual Analytics Section -->
    <div class="admin-charts-grid">
      <div class="panel-card">
        <div class="panel-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-accent);"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            <h3 style="margin:0;">Departmental Attendance Regularity</h3>
          </div>
          <span class="badge badge-primary">Current Semester</span>
        </div>
        <div class="panel-body" style="padding: 20px;">
          <canvas id="admin-dept-chart" style="max-height: 260px; width: 100%;"></canvas>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-success);"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            <h3 style="margin:0;">Weekly Institutional Regularity Index</h3>
          </div>
          <span class="badge badge-success">6-Week Trend</span>
        </div>
        <div class="panel-body" style="padding: 20px;">
          <canvas id="admin-trend-chart" style="max-height: 260px; width: 100%;"></canvas>
        </div>
      </div>
    </div>

    <!-- Department Operations & Compliance Table -->
    <div class="panel-card">
      <div class="panel-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-secondary);"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line><line x1="9" y1="18" x2="15" y2="18"></line></svg>
          <h3 style="margin:0;">Stream Performance & Department Compliance Roster</h3>
        </div>
        <span class="stat-desc">Filtered across active engineering departments</span>
      </div>
      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Department Stream</th>
              <th>Enrolled Students</th>
              <th>Attendance Ratio</th>
              <th>Progress Meter</th>
              <th style="text-align: right;">Compliance Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.deptBreakdown.map(dept => {
              const isHealthy = dept.averageAttendance >= 75;
              const statusText = isHealthy ? 'Compliant (≥75%)' : 'Under 75% Defaulter Warning';
              const statusClass = isHealthy ? 'badge-success' : 'badge-danger';
              const badgeClass = `badge-${dept.department.toLowerCase()}`;
              return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span class="badge ${badgeClass}" style="padding: 6px 12px; font-weight: 800;">${dept.department}</span>
                      <strong>${dept.department} Engineering</strong>
                    </div>
                  </td>
                  <td><strong>${dept.studentCount}</strong> Candidates</td>
                  <td><strong style="color: ${isHealthy ? 'var(--color-success)' : 'var(--color-danger)'};">${dept.averageAttendance}%</strong></td>
                  <td style="min-width: 140px;">
                    <div class="stat-progress-bar">
                      <div class="stat-progress-fill" style="width: ${Math.min(100, dept.averageAttendance)}%; background: ${isHealthy ? 'var(--color-success)' : 'var(--color-danger)'};"></div>
                    </div>
                  </td>
                  <td style="text-align: right;"><span class="badge ${statusClass}">${statusText}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    </div>
  `;

  // Draw ChartJS visual graphs
  renderAdminCharts(data.deptBreakdown);
}

function renderAdminCharts(deptBreakdown) {
  if (adminDeptChartInstance) adminDeptChartInstance.destroy();
  if (adminTrendChartInstance) adminTrendChartInstance.destroy();

  const deptCtx = document.getElementById('admin-dept-chart');
  if (deptCtx && typeof Chart !== 'undefined') {
    const labels = deptBreakdown.map(d => `${d.department} Eng`);
    const values = deptBreakdown.map(d => d.averageAttendance);
    const colors = values.map(v => v >= 75 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)');

    adminDeptChartInstance = new Chart(deptCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Regularity (%)',
          data: values,
          backgroundColor: colors,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` Regularity: ${context.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: (val) => `${val}%` }
          }
        }
      }
    });
  }

  const trendCtx = document.getElementById('admin-trend-chart');
  if (trendCtx && typeof Chart !== 'undefined') {
    const avgCalc = Math.round(deptBreakdown.reduce((a, b) => a + b.averageAttendance, 0) / (deptBreakdown.length || 1));
    adminTrendChartInstance = new Chart(trendCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6'],
        datasets: [{
          label: 'Institutional Avg (%)',
          data: [88, 91, 85, 93, 89, avgCalc || 92],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            min: 60,
            max: 100,
            ticks: { callback: (val) => `${val}%` }
          }
        }
      }
    });
  }
}

// ==========================================
// 2. DEPARTMENTS & SUBJECTS TAB
// ==========================================
async function renderDepartmentsTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 260px;"></div>`;

  const [deptsRes, subsRes] = await Promise.all([
    apiFetch('/admin/departments'),
    apiFetch('/admin/subjects')
  ]);

  if (!deptsRes.success || !subsRes.success) return;

  const depts = deptsRes.data;
  const subjects = subsRes.data;

  container.innerHTML = `
    <!-- Full Width Panel: Courses/Subjects Table CRUD -->
    <div class="panel-card">
      <div class="panel-header">
        <h3>Courses/Subjects</h3>
        <button id="btn-add-subject" class="btn btn-primary">+ Register New Subject</button>
      </div>
      
      <div class="table-responsive">
        <table class="custom-table" id="subjects-list-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Subject Title</th>
              <th>Department</th>
              <th>Semester</th>
              <th style="text-align: right;">Operations</th>
            </tr>
          </thead>
          <tbody>
            ${subjects.map(s => `
              <tr id="sub-row-${s.id}">
                <td><span class="roster-roll-badge">${s.code}</span></td>
                <td><strong>${s.name}</strong></td>
                <td><span class="badge badge-${s.department.toLowerCase()}">${s.department}</span></td>
                <td>Sem - ${s.semester}</td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-edit-subj" data-id="${s.id}" style="padding: 6px 10px; font-size: 0.8rem;">Edit</button>
                  <button class="btn btn-danger btn-delete-subj" data-id="${s.id}" style="padding: 6px 10px; font-size: 0.8rem;">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind register subject event
  document.getElementById('btn-add-subject').addEventListener('click', openSubjectRegisterModal);

  // Edit / Delete bindings
  const table = document.getElementById('subjects-list-table');
  table.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit-subj');
    const deleteBtn = e.target.closest('.btn-delete-subj');

    if (editBtn) {
      const subId = editBtn.dataset.id;
      const targetSub = subjects.find(s => s.id === subId);
      if (targetSub) openSubjectEditModal(targetSub);
    }

    if (deleteBtn) {
      const subId = deleteBtn.dataset.id;
      if (confirm('Delete this Subject registers? It will break associated weekly timetables.')) {
        const delRes = await apiFetch(`/admin/subjects/${subId}`, { method: 'DELETE' });
        if (delRes.success) {
          showToast('Subject deleted successfully', 'success');
          await renderDepartmentsTab();
        }
      }
    }
  });
}

function openSubjectRegisterModal() {
  const contentHTML = `
    <div class="form-group">
      <label for="subj-code">Subject Code</label>
      <input type="text" class="form-control" name="code" id="subj-code" placeholder="e.g. IT402" required>
    </div>
    <div class="form-group">
      <label for="subj-name">Subject Name</label>
      <input type="text" class="form-control" name="name" id="subj-name" placeholder="e.g. Computer Networks" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="subj-dept">Department</label>
        <select class="form-control" name="department" id="subj-dept">
          <option value="IT">IT</option>
          <option value="CE">CE</option>
          <option value="ME">ME</option>
          <option value="CH">CH</option>
          <option value="EE">EE</option>
        </select>
      </div>
      <div class="form-group">
        <label for="subj-sem">Semester</label>
        <select class="form-control" name="semester" id="subj-sem">
          <option value="1">Semester 1</option>
          <option value="2">Semester 2</option>
          <option value="3">Semester 3</option>
          <option value="4" selected>Semester 4</option>
          <option value="5">Semester 5</option>
          <option value="6">Semester 6</option>
        </select>
      </div>
    </div>
  `;

  openModal('Register New Course Subject', contentHTML, async (formData) => {
    const payload = {
      code: formData.get('code').toUpperCase(),
      name: formData.get('name'),
      department: formData.get('department'),
      semester: parseInt(formData.get('semester'))
    };

    const res = await apiFetch('/admin/subjects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('New subject registered successfully!', 'success');
      await renderDepartmentsTab();
      return true;
    }
    return false;
  });
}

function openSubjectEditModal(sub) {
  const contentHTML = `
    <div class="form-group">
      <label for="subj-code">Subject Code</label>
      <input type="text" class="form-control" name="code" id="subj-code" value="${sub.code}" required>
    </div>
    <div class="form-group">
      <label for="subj-name">Subject Name</label>
      <input type="text" class="form-control" name="name" id="subj-name" value="${sub.name}" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="subj-dept">Department</label>
        <select class="form-control" name="department" id="subj-dept">
          <option value="IT" ${sub.department === 'IT' ? 'selected' : ''}>IT</option>
          <option value="CE" ${sub.department === 'CE' ? 'selected' : ''}>CE</option>
          <option value="ME" ${sub.department === 'ME' ? 'selected' : ''}>ME</option>
          <option value="CH" ${sub.department === 'CH' ? 'selected' : ''}>CH</option>
          <option value="EE" ${sub.department === 'EE' ? 'selected' : ''}>EE</option>
        </select>
      </div>
      <div class="form-group">
        <label for="subj-sem">Semester</label>
        <select class="form-control" name="semester" id="subj-sem">
          <option value="1" ${sub.semester === 1 ? 'selected' : ''}>Semester 1</option>
          <option value="2" ${sub.semester === 2 ? 'selected' : ''}>Semester 2</option>
          <option value="3" ${sub.semester === 3 ? 'selected' : ''}>Semester 3</option>
          <option value="4" ${sub.semester === 4 ? 'selected' : ''}>Semester 4</option>
          <option value="5" ${sub.semester === 5 ? 'selected' : ''}>Semester 5</option>
          <option value="6" ${sub.semester === 6 ? 'selected' : ''}>Semester 6</option>
        </select>
      </div>
    </div>
  `;

  openModal(`Modify: ${sub.name}`, contentHTML, async (formData) => {
    const payload = {
      code: formData.get('code').toUpperCase(),
      name: formData.get('name'),
      department: formData.get('department'),
      semester: parseInt(formData.get('semester'))
    };

    const res = await apiFetch(`/admin/subjects/${sub.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('Subject registers updated!', 'success');
      await renderDepartmentsTab();
      return true;
    }
    return false;
  });
}

// ==========================================
// 3. MANAGE FACULTY & STAFF DIRECTORY
// ==========================================
async function renderFacultyTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 300px;"></div>`;

  const res = await apiFetch('/admin/users');
  if (!res.success) return;

  const staff = res.data.filter(u => u.role === 'faculty' || u.role === 'hod');

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header" style="flex-wrap: wrap;">
        <h3>Faculty & HOD Staff Directory</h3>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <input type="text" id="faculty-search" class="form-control" placeholder="Search by name, email, staff ID..." style="padding: 6px 12px; font-size: 0.85rem; width: 220px;">
          <select id="filter-faculty-dept" class="form-control" style="padding: 6px 12px; font-size: 0.85rem;">
            <option value="all">All Departments</option>
            <option value="IT">IT Department</option>
            <option value="CE">CE Department</option>
            <option value="ME">ME Department</option>
            <option value="CH">CH Department</option>
            <option value="EE">EE Department</option>
          </select>
          <select id="filter-faculty-role" class="form-control" style="padding: 6px 12px; font-size: 0.85rem;">
            <option value="all">All Roles</option>
            <option value="hod">HODs Only</option>
            <option value="faculty">Faculty Only</option>
          </select>
          <button id="btn-add-faculty" class="btn btn-primary">+ Register New Staff</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="custom-table" id="faculty-table">
          <thead>
            <tr>
              <th>Staff Name</th>
              <th>Email Address</th>
              <th>Role</th>
              <th>Department Stream</th>
              <th style="text-align: right;">Operations</th>
            </tr>
          </thead>
          <tbody id="faculty-table-rows">
            <!-- Populated via filters -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  function drawFaculty() {
    const searchVal = document.getElementById('faculty-search').value.toLowerCase();
    const deptVal = document.getElementById('filter-faculty-dept').value;
    const roleVal = document.getElementById('filter-faculty-role').value;

    const filtered = staff.filter(f => {
      const matchSearch = (f.name && f.name.toLowerCase().includes(searchVal)) ||
                          (f.email && f.email.toLowerCase().includes(searchVal));
      const matchDept = deptVal === 'all' || f.department === deptVal;
      const matchRole = roleVal === 'all' || f.role === roleVal;
      return matchSearch && matchDept && matchRole;
    });

    const rowsContainer = document.getElementById('faculty-table-rows');
    if (filtered.length === 0) {
      rowsContainer.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-placeholder-box">
              <div class="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <p>No faculty/staff members found matching the selected filters.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    rowsContainer.innerHTML = filtered.map(f => {
      const showPromote = f.role === 'faculty';
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="avatar" style="width:30px; height:30px; font-size: 0.775rem;">${(f.name || 'F').split(' ').map(n => n[0]).join('').substring(0, 2)}</span>
              <span><strong>${f.name}</strong></span>
            </div>
          </td>
          <td><span style="font-family: monospace; color: var(--text-secondary);">${f.email}</span></td>
          <td><span class="badge ${f.role === 'hod' ? 'badge-warning' : 'badge-success'}">${f.role.toUpperCase()}</span></td>
          <td><span class="badge badge-${(f.department || 'it').toLowerCase()}">${f.department || 'GEN'}</span></td>
          <td style="text-align: right;">
            ${showPromote ? `<button class="btn btn-secondary btn-promote-hod" data-id="${f.id}" style="padding: 6px 10px; font-size: 0.8rem; border-color: var(--color-warning); color: #d97706; background-color: var(--color-warning-subtle);">Make HOD</button>` : ''}
            <button class="btn btn-secondary btn-edit-faculty" data-id="${f.id}" style="padding: 6px 10px; font-size: 0.8rem;">Edit</button>
            <button class="btn btn-danger btn-delete-faculty" data-id="${f.id}" style="padding: 6px 10px; font-size: 0.8rem;">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('faculty-search').addEventListener('input', drawFaculty);
  document.getElementById('filter-faculty-dept').addEventListener('change', drawFaculty);
  document.getElementById('filter-faculty-role').addEventListener('change', drawFaculty);
  document.getElementById('btn-add-faculty').addEventListener('click', openAddFacultyModal);

  document.getElementById('faculty-table-rows').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit-faculty');
    const deleteBtn = e.target.closest('.btn-delete-faculty');
    const promoteBtn = e.target.closest('.btn-promote-hod');

    if (promoteBtn) {
      const fId = promoteBtn.dataset.id;
      const targetFac = staff.find(f => f.id === fId);
      if (confirm(`Are you sure you want to promote ${targetFac ? targetFac.name : 'this faculty'} to HOD of ${targetFac ? targetFac.department : ''} department?`)) {
        const promoteRes = await apiFetch(`/admin/users/${fId}`, {
          method: 'PUT',
          body: JSON.stringify({ role: 'hod' })
        });
        if (promoteRes.success) {
          showToast(`Promoted ${targetFac ? targetFac.name : 'Faculty'} to HOD!`, 'success');
          await renderFacultyTab();
        }
      }
    }

    if (editBtn) {
      const fId = editBtn.dataset.id;
      const targetFac = staff.find(f => f.id === fId);
      if (targetFac) openEditFacultyModal(targetFac);
    }

    if (deleteBtn) {
      const fId = deleteBtn.dataset.id;
      const targetFac = staff.find(f => f.id === fId);
      if (confirm(`Are you sure you want to delete staff account for ${targetFac ? targetFac.name : 'this faculty'}?`)) {
        const delRes = await apiFetch(`/admin/users/${fId}`, { method: 'DELETE' });
        if (delRes.success) {
          showToast('Faculty record deleted successfully', 'success');
          await renderFacultyTab();
        }
      }
    }
  });

  drawFaculty();
}

function openAddFacultyModal() {
  const contentHTML = `
    <div class="form-group">
      <label for="f-name">Staff Full Name</label>
      <input type="text" class="form-control" name="name" id="f-name" placeholder="e.g. Dr. Rajesh Verma" required>
    </div>
    <div class="form-group">
      <label for="f-email">Academic Email</label>
      <input type="email" class="form-control" name="email" id="f-email" placeholder="e.g. r.verma@satendify.edu" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="f-role">System Role</label>
        <select class="form-control" name="role" id="f-role">
          <option value="faculty">Faculty Teacher</option>
          <option value="hod">HOD (Head of Department)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="f-dept">Department Stream</label>
        <select class="form-control" name="department" id="f-dept">
          <option value="IT">IT (Information Technology)</option>
          <option value="CE">CE (Computer Engineering)</option>
          <option value="ME">ME (Mechanical Engineering)</option>
          <option value="CH">CH (Chemical Engineering)</option>
          <option value="EE">EE (Electrical Engineering)</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label for="f-phone">Contact Phone</label>
      <input type="text" class="form-control" name="phone" id="f-phone" placeholder="e.g. +91 98765 43210">
    </div>
  `;

  openModal('Register New Faculty / Staff Member', contentHTML, async (formData) => {
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      department: formData.get('department'),
      phone: formData.get('phone')
    };

    const res = await apiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast(`Faculty member ${payload.name} registered!`, 'success');
      await renderFacultyTab();
      return true;
    }
    return false;
  });
}

function openEditFacultyModal(usr) {
  const contentHTML = `
    <div class="form-group">
      <label for="f-name">Staff Full Name</label>
      <input type="text" class="form-control" name="name" id="f-name" value="${usr.name}" required>
    </div>
    <div class="form-group">
      <label for="f-email">Academic Email</label>
      <input type="email" class="form-control" name="email" id="f-email" value="${usr.email}" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="f-role">Role</label>
        <select class="form-control" name="role" id="f-role">
          <option value="faculty" ${usr.role === 'faculty' ? 'selected' : ''}>Faculty Teacher</option>
          <option value="hod" ${usr.role === 'hod' ? 'selected' : ''}>HOD (Head of Department)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="f-dept">Department Stream</label>
        <select class="form-control" name="department" id="f-dept">
          <option value="IT" ${usr.department === 'IT' ? 'selected' : ''}>IT</option>
          <option value="CE" ${usr.department === 'CE' ? 'selected' : ''}>CE</option>
          <option value="ME" ${usr.department === 'ME' ? 'selected' : ''}>ME</option>
          <option value="CH" ${usr.department === 'CH' ? 'selected' : ''}>CH</option>
          <option value="EE" ${usr.department === 'EE' ? 'selected' : ''}>EE</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label for="f-phone">Contact Phone</label>
      <input type="text" class="form-control" name="phone" id="f-phone" value="${usr.phone || ''}">
    </div>
  `;

  openModal(`Edit Faculty Profile: ${usr.name}`, contentHTML, async (formData) => {
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      department: formData.get('department'),
      phone: formData.get('phone')
    };

    const res = await apiFetch(`/admin/users/${usr.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('Faculty profile updated successfully!', 'success');
      await renderFacultyTab();
      return true;
    }
    return false;
  });
}

// ==========================================
// 4. MANAGE STUDENTS DIRECTORY (ADMIN)
// ==========================================
async function renderStudentsTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 300px;"></div>`;

  const res = await apiFetch('/admin/users');
  if (!res.success) return;

  const students = res.data.filter(u => u.role === 'student');

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header" style="flex-wrap: wrap;">
        <h3>Institutional Students Directory</h3>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <input type="text" id="students-search" class="form-control" placeholder="Search by name, roll, email..." style="padding: 6px 12px; font-size: 0.85rem; width: 200px;">
          <select id="filter-student-dept" class="form-control" style="padding: 6px 12px; font-size: 0.85rem;">
            <option value="all">All Departments</option>
            <option value="IT">IT Department</option>
            <option value="CE">CE Department</option>
            <option value="ME">ME Department</option>
            <option value="CH">CH Department</option>
            <option value="EE">EE Department</option>
          </select>
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
              <th>Department Stream</th>
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
    const deptVal = document.getElementById('filter-student-dept').value;
    const semVal = document.getElementById('filter-student-sem').value;

    const filtered = students.filter(s => {
      const matchSearch = (s.name && s.name.toLowerCase().includes(searchVal)) ||
                          (s.rollNumber && s.rollNumber.toLowerCase().includes(searchVal)) ||
                          (s.dob && s.dob.includes(searchVal));
      const matchDept = deptVal === 'all' || s.department === deptVal;
      const matchSem = semVal === 'all' || String(s.semester) === semVal;
      return matchSearch && matchDept && matchSem;
    });

    const rowsContainer = document.getElementById('students-table-rows');
    if (filtered.length === 0) {
      rowsContainer.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-placeholder-box">
              <div class="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <p>No student records found matching the selected filters.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    rowsContainer.innerHTML = filtered.map(s => `
      <tr>
        <td>
          <span class="roster-roll-badge">${s.rollNumber || 'N/A'}</span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="avatar" style="width:30px; height:30px; font-size: 0.775rem;">${(s.name || 'S').split(' ').map(n => n[0]).join('').substring(0, 2)}</span>
            <span><strong>${s.name}</strong></span>
          </div>
        </td>
        <td><span style="font-family: monospace; font-weight: 700; color: var(--color-accent);">${s.dob || 'N/A'}</span></td>
        <td><span class="badge badge-${(s.department || 'it').toLowerCase()}">${s.department}</span></td>
        <td><span class="badge badge-it">Sem-${s.semester || 1} / Div-${s.division || 'A'}</span></td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-edit-student" data-id="${s.id}" style="padding: 6px 10px; font-size: 0.8rem;">Edit</button>
          <button class="btn btn-danger btn-delete-student" data-id="${s.id}" style="padding: 6px 10px; font-size: 0.8rem;">Delete</button>
        </td>
      </tr>
    `).join('');
  }

  document.getElementById('students-search').addEventListener('input', drawStudents);
  document.getElementById('filter-student-dept').addEventListener('change', drawStudents);
  document.getElementById('filter-student-sem').addEventListener('change', drawStudents);
  document.getElementById('btn-add-student').addEventListener('click', openAddAdminStudentModal);

  document.getElementById('students-table-rows').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit-student');
    const deleteBtn = e.target.closest('.btn-delete-student');

    if (editBtn) {
      const sId = editBtn.dataset.id;
      const targetStudent = students.find(s => s.id === sId);
      if (targetStudent) openEditAdminStudentModal(targetStudent);
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

function openAddAdminStudentModal() {
  const batches = getBatchNamesForSemester(4, semesterConfigs["4"] || 2);
  const batchOptions = batches.map(b => `<option value="${b}">${b}</option>`).join('');

  const contentHTML = `
    <div class="form-group">
      <label for="st-name">Student Full Name</label>
      <input type="text" class="form-control" name="name" id="st-name" placeholder="e.g. Aarav Sharma" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="st-dept">Department Stream</label>
        <select class="form-control" name="department" id="st-dept">
          <option value="IT">IT (Information Technology)</option>
          <option value="CE">CE (Computer Engineering)</option>
          <option value="ME">ME (Mechanical Engineering)</option>
          <option value="CH">CH (Chemical Engineering)</option>
          <option value="EE">EE (Electrical Engineering)</option>
        </select>
      </div>
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
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="st-div">Batch Assignment</label>
        <select class="form-control" name="division" id="st-div">
          ${batchOptions}
        </select>
      </div>
      <div class="form-group">
        <label for="st-roll">Institutional Roll Number ID</label>
        <input type="text" class="form-control" name="rollNumber" id="st-roll" placeholder="e.g. 23IT045" required style="text-transform: uppercase;">
      </div>
    </div>
    <div class="form-group">
      <label for="st-dob">Date of Birth (DDMMYYYY) — Login Credentials</label>
      <input type="text" class="form-control" name="dob" id="st-dob" placeholder="e.g. 15082004" required maxlength="8" pattern="[0-9]{8}">
      <span style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Format: 8 digits DDMMYYYY. Used for Student Portal Authentication.</span>
    </div>
  `;

  openModal('Register New Student Account', contentHTML, async (formData) => {
    const sem = parseInt(formData.get('semester'));
    const payload = {
      name: formData.get('name'),
      role: 'student',
      department: formData.get('department'),
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

function openEditAdminStudentModal(student) {
  const currentSem = student.semester || 4;
  const maxB = semesterConfigs[String(currentSem)] || 2;
  const batches = getBatchNamesForSemester(currentSem, maxB);
  const batchOptions = batches.map(b => `<option value="${b}" ${b === student.division ? 'selected' : ''}>${b}</option>`).join('');

  const contentHTML = `
    <div class="form-group">
      <label for="st-name">Student Full Name</label>
      <input type="text" class="form-control" name="name" id="st-name" value="${student.name}" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="st-dept">Department Stream</label>
        <select class="form-control" name="department" id="st-dept">
          <option value="IT" ${student.department === 'IT' ? 'selected' : ''}>IT</option>
          <option value="CE" ${student.department === 'CE' ? 'selected' : ''}>CE</option>
          <option value="ME" ${student.department === 'ME' ? 'selected' : ''}>ME</option>
          <option value="CH" ${student.department === 'CH' ? 'selected' : ''}>CH</option>
          <option value="EE" ${student.department === 'EE' ? 'selected' : ''}>EE</option>
        </select>
      </div>
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
    </div>
    <div class="form-row">
      <div class="form-group">
        <label for="st-div">Batch Assignment</label>
        <select class="form-control" name="division" id="st-div">
          ${batchOptions}
        </select>
      </div>
      <div class="form-group">
        <label for="st-roll">Institutional Roll Number</label>
        <input type="text" class="form-control" name="rollNumber" id="st-roll" value="${student.rollNumber || ''}" required style="text-transform: uppercase;">
      </div>
    </div>
    <div class="form-group">
      <label for="st-dob">Date of Birth (DDMMYYYY) — Login Credentials</label>
      <input type="text" class="form-control" name="dob" id="st-dob" value="${student.dob || ''}" required maxlength="8" pattern="[0-9]{8}">
      <span style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Format: 8 digits DDMMYYYY. Managed by institution admin.</span>
    </div>
  `;

  openModal(`Modify Student: ${student.name}`, contentHTML, async (formData) => {
    const sem = parseInt(formData.get('semester'));
    const payload = {
      name: formData.get('name'),
      department: formData.get('department'),
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
// 4. TIMETABLE BUILDER GRIDS
// ==========================================
async function renderTimetableTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 400px;"></div>`;

  // Fetch full data arrays used to select items inside timetable builder
  const [timetableRes, subsRes, usersRes] = await Promise.all([
    apiFetch('/admin/timetable'),
    apiFetch('/admin/subjects'),
    apiFetch('/admin/users')
  ]);

  if (!timetableRes.success || !subsRes.success || !usersRes.success) return;

  const timetable = timetableRes.data;
  const subjects = subsRes.data;
  const users = usersRes.data;

  // Filter lists of departments/semesters
  const depts = ['IT', 'CE', 'ME', 'CH', 'EE'];
  const sems = [1, 2, 3, 4, 5, 6];

  // Inject Controls header and dynamic grid table skeleton
  container.innerHTML = `
    <div class="timetable-builder-controls">
      <div class="form-group">
        <label for="tt-dept-select">Select Stream</label>
        <select class="form-control" id="tt-dept-select">
          ${depts.map(d => `<option value="${d}">${d} Department</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="tt-sem-select">Selected Semester</label>
        <select class="form-control" id="tt-sem-select">
          ${sems.map(s => `<option value="${s}" ${s === 5 ? 'selected' : ''}>Semester ${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="min-width: 120px;">
        <label for="tt-batches-config">Semester Batches</label>
        <select class="form-control" id="tt-batches-config">
          <option value="2">2 Batches</option>
          <option value="3">3 Batches</option>
        </select>
      </div>
      <div class="form-group">
        <label for="tt-div-select">Select Batch</label>
        <select class="form-control" id="tt-div-select">
          <!-- Populated dynamically -->
        </select>
      </div>
      <button class="btn btn-primary" id="btn-refresh-grid" style="margin-left:auto;">Refresh Grid</button>
    </div>

    <!-- Active Class Card Indicator -->
    <div class="panel-card">
      <div class="panel-header">
        <h3 id="timetable-title-label">Timetable Grid</h3>
      </div>
      <div class="panel-body">
        <div class="table-responsive">
          <!-- Calendar Timetable Grid -->
          <div class="timetable-grid" id="timetable-cells-grid">
            <!-- Generated dynamically -->
          </div>
        </div>

        <!-- Mobile view fallback -->
        <div class="mobile-timetable-list" id="mobile-timetable-cards" style="margin-top: 24px; display: none;">
          <!-- Generated for mobile viewport support -->
        </div>

      </div>
    </div>
  `;

  // Draw actual visual grid representation
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

  function drawTimetableGrid() {
    const dept = document.getElementById('tt-dept-select').value;
    const sem = parseInt(document.getElementById('tt-sem-select').value);
    const div = document.getElementById('tt-div-select').value;

    document.getElementById('timetable-title-label').textContent = `${dept} Department — Semester ${sem} (Batch ${div}) Academic Schedule`;

    // Filter elements in timetable matching selectors (lectures apply to all batches of the semester)
    const gridData = timetable.filter(c => c.department === dept && c.semester === sem && (c.division === div || c.type === 'lecture' || !c.type));

    const gridElement = document.getElementById('timetable-cells-grid');

    // Header top row (Days)
    let gridHTML = `<div class="timetable-header-cell">Period</div>`;
    days.forEach(day => {
      gridHTML += `<div class="timetable-header-cell">${day}</div>`;
    });

    // Populate rows (Period-wise)
    periods.forEach(p => {
      gridHTML += `
        <div class="timetable-row-header">
          <strong>P${p.num}</strong>
          <span style="font-size:0.65rem; font-weight:normal;">${p.time}</span>
        </div>
      `;

      days.forEach(day => {
        // Find if subject booked or if a multi-period slot spans this period
        const cellVal = gridData.find(c => {
          const duration = c.duration || 1;
          return c.day === day && p.num >= c.period && p.num < c.period + duration;
        });

        if (cellVal) {
          const sub = subjects.find(s => s.id === cellVal.subjectId);
          const fac = users.find(u => u.id === cellVal.facultyId);
          const isStart = p.num === cellVal.period;
          const typeLabel = cellVal.type === 'lab' ? '🔬 Lab' : cellVal.type === 'tutorial' ? '📖 Tut' : '';

          if (isStart) {
            gridHTML += `
              <div class="timetable-cell" id="tt-cell-${cellVal.id}" style="${cellVal.type && cellVal.type !== 'lecture' ? 'background: #f0fdf4; border-left: 3px solid var(--color-success);' : ''}">
                <div>
                  <button class="cell-action-delete" data-id="${cellVal.id}">&times;</button>
                  <div class="cell-subject">${sub ? sub.name : 'Unknown'} ${typeLabel ? `<span style="font-size:0.7rem; font-weight:normal; background:#dcfce7; color:#166534; padding:2px 4px; border-radius:3px; margin-left:4px;">${typeLabel}</span>` : ''}</div>
                  <div class="cell-faculty">👨‍🏫 ${fac ? fac.name.replace('Prof. ', '').replace('Dr. ', '') : 'Faculty'}</div>
                </div>
                <div class="cell-room">🚪 ${cellVal.room}</div>
              </div>
            `;
          } else {
            // Continuation cell
            gridHTML += `
              <div class="timetable-cell" id="tt-cell-${cellVal.id}-cont" style="opacity: 0.85; ${cellVal.type && cellVal.type !== 'lecture' ? 'background: #f0fdf4; border-left: 3px solid var(--color-success);' : ''}">
                <div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">
                  (Continuation of ${sub ? sub.code : 'lecture'})
                </div>
                <div class="cell-room">🚪 ${cellVal.room}</div>
              </div>
            `;
          }
        } else {
          gridHTML += `
            <div class="timetable-cell empty-cell">
              <button class="btn-schedule-trigger" data-day="${day}" data-period="${p.num}">+ Assign</button>
            </div>
          `;
        }
      });
    });

    gridElement.innerHTML = gridHTML;

    // Draw Mobile Card Lists (swipe/accordion view)
    const mobContainer = document.getElementById('mobile-timetable-cards');
    let mobHTML = '';

    days.forEach(day => {
      const dayClasses = gridData.filter(c => c.day === day).sort((a, b) => a.period - b.period);

      mobHTML += `
        <div class="mobile-tt-card">
          <h4 style="border-bottom: 2px solid var(--border-color); padding-bottom: 6px; font-weight:800; color:var(--text-primary); margin-bottom: 8px;">${day}</h4>
          ${dayClasses.length === 0 ? `<p style="font-size:0.8rem; color:var(--text-muted); italic; padding: 4px 0;">No lectures scheduled today.</p>` :
          dayClasses.map(c => {
            const sub = subjects.find(s => s.id === c.subjectId);
            const fac = users.find(u => u.id === c.facultyId);
            const duration = c.duration || 1;
            const periodText = duration > 1 ? `P${c.period}-P${c.period + duration - 1}` : `P${c.period}`;
            const typeLabel = c.type === 'lab' ? '🔬 Lab' : c.type === 'tutorial' ? '📖 Tut' : '';
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom:1px solid #f1f5f9;">
                  <div>
                    <span class="badge badge-primary">${periodText}</span>
                    <strong style="margin-left:6px; font-size:0.85rem;">${sub ? sub.name : 'Subject'} ${typeLabel ? `<span style="font-size:0.65rem; font-weight:normal; background:#dcfce7; color:#166534; padding:2px 4px; border-radius:3px; margin-left:4px;">${typeLabel}</span>` : ''}</strong>
                    <span style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-left:26px;">${fac ? fac.name : 'Faculty'} | Room ${c.room}</span>
                  </div>
                  <button class="btn btn-secondary btn-mob-delete" data-id="${c.id}" style="padding:4px 8px; font-size:0.75rem; color:var(--color-danger); border-color:var(--color-danger-subtle);">Delete</button>
                </div>
              `;
          }).join('')
        }
        </div>
      `;
    });

    mobContainer.innerHTML = mobHTML;

    // Toggle responsive views inside CSS triggers in javascript
    if (window.innerWidth <= 768) {
      gridElement.style.display = 'none';
      mobContainer.style.display = 'flex';
    } else {
      gridElement.style.display = 'grid';
      mobContainer.style.display = 'none';
    }
  }

  function updateBatchOptions() {
    const sem = parseInt(document.getElementById('tt-sem-select').value);
    const configuredBatches = semesterConfigs[sem] || 2;
    document.getElementById('tt-batches-config').value = configuredBatches;

    const batchSelect = document.getElementById('tt-div-select');
    const prevVal = batchSelect.value;
    const batchNames = getBatchNamesForSemester(sem, configuredBatches);
    
    batchSelect.innerHTML = batchNames.map(b => `<option value="${b}">${b}</option>`).join('');
    if (batchNames.includes(prevVal)) {
      batchSelect.value = prevVal;
    } else {
      batchSelect.value = batchNames[0] || '';
    }
  }

  // Bind selector changes
  document.getElementById('tt-dept-select').addEventListener('change', drawTimetableGrid);
  document.getElementById('tt-sem-select').addEventListener('change', () => {
    updateBatchOptions();
    drawTimetableGrid();
  });
  document.getElementById('tt-batches-config').addEventListener('change', async (e) => {
    const sem = document.getElementById('tt-sem-select').value;
    const val = parseInt(e.target.value);
    const res = await apiFetch('/admin/semester-config', {
      method: 'POST',
      body: JSON.stringify({ semester: sem, batches: val })
    });
    if (res.success) {
      semesterConfigs[sem] = val;
      updateBatchOptions();
      drawTimetableGrid();
      showToast(`Updated Semester ${sem} to have ${val} batches.`, 'success');
    }
  });
  document.getElementById('tt-div-select').addEventListener('change', drawTimetableGrid);
  document.getElementById('btn-refresh-grid').addEventListener('click', drawTimetableGrid);

  // Resize listener for table grid responsiveness
  window.addEventListener('resize', drawTimetableGrid);

  updateBatchOptions();

  // Handle cell schedules trigger adding
  const containerPanel = document.getElementById('dashboard-content');

  containerPanel.addEventListener('click', async (e) => {
    const trigger = e.target.closest('.btn-schedule-trigger');
    const deleteBtn = e.target.closest('.cell-action-delete') || e.target.closest('.btn-mob-delete');

    if (trigger) {
      const dayName = trigger.dataset.day;
      const periodNum = parseInt(trigger.dataset.period);

      const targetDept = document.getElementById('tt-dept-select').value;
      const targetSem = parseInt(document.getElementById('tt-sem-select').value);
      const targetDiv = document.getElementById('tt-div-select').value;

      // Filter sub/faculty matches
      const eligibleSubjects = subjects.filter(s => s.department === targetDept && s.semester === targetSem);
      const eligibleFaculty = users.filter(u => (u.role === 'faculty' || u.role === 'hod') && u.department === targetDept);

      if (eligibleSubjects.length === 0) {
        showToast(`No subjects are registered for Department ${targetDept} - Semester ${targetSem}. Register subjects first!`, 'error');
        return;
      }

      const contentHTML = `
        <div class="form-row">
          <div class="form-group">
            <label>Day</label>
            <input type="text" class="form-control" name="day" value="${dayName}" readonly>
          </div>
          <div class="form-group">
            <label>Period Slot</label>
            <input type="text" class="form-control" name="period" value="${periodNum}" readonly>
          </div>
        </div>
        <div class="form-group">
          <label for="cell-type-select">Session Type</label>
          <select class="form-control" name="type" id="cell-type-select">
            <option value="lecture">Lecture (1 Period)</option>
            <option value="lab">Practical Lab (2 Periods)</option>
            <option value="tutorial">Tutorial (2 Periods)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="cell-fac-select">Assign Faculty Professor</label>
          <select class="form-control" name="facultyId" id="cell-fac-select">
            ${eligibleFaculty.map(f => `<option value="${f.id}">${f.name} (${f.role.toUpperCase()})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="cell-sub-select">Allocate Subject</label>
          <select class="form-control" name="subjectId" id="cell-sub-select">
            <!-- Populated dynamically -->
          </select>
        </div>
        <div class="form-group">
          <label for="cell-room-input">Room Allocation Number</label>
          <input type="text" class="form-control" name="room" id="cell-room-input" placeholder="e.g. Lab 102 / Classroom 304" required>
        </div>
      `;

      openModal('Schedule Timetable Slot', contentHTML, async (formData) => {
        const type = formData.get('type');
        const duration = (type === 'lab' || type === 'tutorial') ? 2 : 1;

        if (periodNum + duration - 1 > 7) {
          showToast('Error: Lab/Tutorial session exceeds the maximum number of daily periods (7).', 'error');
          return false;
        }

        const payload = {
          department: targetDept,
          semester: targetSem,
          division: targetDiv,
          day: formData.get('day'),
          period: parseInt(formData.get('period')),
          type: type,
          duration: duration,
          subjectId: formData.get('subjectId'),
          facultyId: formData.get('facultyId'),
          room: formData.get('room')
        };

        const postRes = await apiFetch('/admin/timetable', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        if (postRes.success) {
          showToast('Schedule slot booked successfully without conflict!', 'success');

          // Re-fetch latest timetable so all synced batch lectures update in real time
          const refreshRes = await apiFetch('/admin/timetable', { skipCache: true });
          if (refreshRes.success) {
            timetable = refreshRes.data;
          }
          drawTimetableGrid();
          return true;
        }
        return false;
      });

      // Bind dynamic subject filtering based on selected faculty
      const facSelect = document.getElementById('cell-fac-select');
      const subSelect = document.getElementById('cell-sub-select');
      if (facSelect && subSelect) {
        const updateSubjects = () => {
          const selectedFacId = facSelect.value;
          const selectedFac = users.find(u => u.id === selectedFacId);
          const assignedSubIds = selectedFac ? (selectedFac.assignedSubjects || selectedFac.subjects || []) : [];
          const filtered = eligibleSubjects.filter(s => assignedSubIds.includes(s.id));
          if (filtered.length === 0) {
            subSelect.innerHTML = `<option value="">No subjects assigned to this faculty</option>`;
          } else {
            subSelect.innerHTML = filtered.map(s => `<option value="${s.id}">${s.code} - ${s.name}</option>`).join('');
          }
        };
        facSelect.addEventListener('change', updateSubjects);
        updateSubjects(); // Initial filter
      }
    }

    if (deleteBtn) {
      const cellId = deleteBtn.dataset.id;
      if (confirm('Delete this scheduled class item? This clears the student attendance calendar link.')) {
        const delRes = await apiFetch(`/admin/timetable/${cellId}`, { method: 'DELETE' });
        if (delRes.success) {
          showToast('Lecture slot unscheduled', 'success');
          const refreshRes = await apiFetch('/admin/timetable', { skipCache: true });
          if (refreshRes.success) {
            timetable = refreshRes.data;
          } else {
            const tIndex = timetable.findIndex(c => c.id === cellId);
            if (tIndex > -1) timetable.splice(tIndex, 1);
          }
          drawTimetableGrid();
        }
      }
    }
  });

  drawTimetableGrid();
}

// ==========================================
// 5. ATTENDANCE LOGS AUDITING & EDITING VIEW
// ==========================================
async function renderAttendanceTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = `<div class="skeleton-bar" style="width: 100%; height: 260px;"></div>`;

  const [historyRes, deptsRes, subsRes] = await Promise.all([
    apiFetch('/admin/attendance-logs'),
    apiFetch('/admin/departments'),
    apiFetch('/admin/subjects')
  ]);

  if (!historyRes.success || !deptsRes.success || !subsRes.success) return;

  const history = historyRes.data;
  const depts = deptsRes.data.map(d => d.id || d);
  const subjects = subsRes.data;

  const facultySet = new Set();
  history.forEach(h => {
    if (h.facultyName) facultySet.add(h.facultyName);
  });
  const facultyList = Array.from(facultySet).sort();

  container.innerHTML = `
    <!-- Top Executive Banner -->
    <div class="admin-welcome-banner" style="margin-bottom: 20px;">
      <div>
        <h2 class="admin-welcome-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#6366f1;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <span>Institutional Attendance Audit Registers</span>
        </h2>
        <p class="admin-welcome-subtitle">Global institution attendance logs, session auditing across departments, and register modifications.</p>
      </div>
      <div class="admin-banner-actions">
        <div style="display:flex; gap:10px; align-items:center;">
          <span class="badge badge-primary" style="padding: 8px 14px; font-size:0.85rem;">${history.length} Total Audit Logs</span>
          <span class="badge badge-success" style="padding: 8px 14px; font-size:0.85rem;">All Stream Departments</span>
        </div>
      </div>
    </div>

    <!-- Filter Controls Card -->
    <div class="panel-card" style="margin-bottom: 20px; padding: 18px 22px;">
      <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-end;">
        <div class="form-group" style="flex: 1 1 150px; margin: 0;">
          <label for="filter-hist-dept" style="font-size: 0.775rem; font-weight: 700; color: var(--text-muted);">Department</label>
          <select class="form-control" id="filter-hist-dept" style="font-size: 0.85rem;">
            <option value="all">All Departments</option>
            ${depts.map(d => `<option value="${d}">${d} Department</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex: 1 1 200px; margin: 0;">
          <label for="filter-hist-subject" style="font-size: 0.775rem; font-weight: 700; color: var(--text-muted);">Course Subject</label>
          <select class="form-control" id="filter-hist-subject" style="font-size: 0.85rem;">
            <option value="all">All Subjects</option>
            ${subjects.map(s => `<option value="${s.id}" data-dept="${s.department}">${s.code} - ${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex: 1 1 180px; margin: 0;">
          <label for="filter-hist-faculty" style="font-size: 0.775rem; font-weight: 700; color: var(--text-muted);">Faculty Professor</label>
          <select class="form-control" id="filter-hist-faculty" style="font-size: 0.85rem;">
            <option value="all">All Faculty</option>
            ${facultyList.map(f => `<option value="${f}">${f}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="flex: 1 1 150px; margin: 0;">
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
          <h3 style="margin:0;">Session Attendance Logs Calendar</h3>
        </div>
        <span class="stat-desc">Institutional Audit Trail</span>
      </div>
      <div class="table-responsive">
        <table class="custom-table" id="history-logs-table">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Date</th>
              <th>Slot</th>
              <th>Dept</th>
              <th>Class Details</th>
              <th>Faculty Member</th>
              <th>Subject Course</th>
              <th>Attendance Ratio</th>
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

  const deptSelect = document.getElementById('filter-hist-dept');
  const subjectSelect = document.getElementById('filter-hist-subject');
  const facultySelect = document.getElementById('filter-hist-faculty');
  const dateInput = document.getElementById('filter-hist-date');

  deptSelect.addEventListener('change', () => {
    const dept = deptSelect.value;
    Array.from(subjectSelect.options).forEach(opt => {
      if (opt.value === 'all') return;
      const optDept = opt.dataset.dept;
      if (dept === 'all' || optDept === dept) {
        opt.style.display = 'block';
      } else {
        opt.style.display = 'none';
      }
    });
    const selectedOpt = subjectSelect.options[subjectSelect.selectedIndex];
    if (selectedOpt && selectedOpt.style.display === 'none') {
      subjectSelect.value = 'all';
    }
    drawHistory();
  });

  function drawHistory() {
    const deptVal = deptSelect.value;
    const subVal = subjectSelect.value;
    const facVal = facultySelect.value;
    const dateVal = dateInput.value;

    const filtered = history.filter(h => {
      const matchDept = deptVal === 'all' || h.department === deptVal;
      const selectedSubObj = subjects.find(s => s.id === subVal);
      const matchSubject = subVal === 'all' || (selectedSubObj && h.subjectCode === selectedSubObj.code);
      const matchFaculty = facVal === 'all' || h.facultyName === facVal;
      const matchDate = !dateVal || h.date === dateVal;

      return matchDept && matchSubject && matchFaculty && matchDate;
    });

    const rowsEl = document.getElementById('history-logs-rows');
    if (filtered.length === 0) {
      rowsEl.innerHTML = `
        <tr>
          <td colspan="9">
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
      const ratio = h.totalCount > 0 ? Math.round((h.presentCount / h.totalCount) * 100) : 0;
      const isHealthy = ratio >= 75;

      return `
        <tr>
          <td><span style="font-weight: 700; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</span></td>
          <td><strong style="font-family: monospace; font-size: 0.85rem;">${h.date}</strong></td>
          <td><span class="badge badge-primary">P${h.period}</span></td>
          <td><span class="badge badge-${(h.department || 'it').toLowerCase()}">${h.department}</span></td>
          <td><span class="badge badge-it">Sem-${h.semester} (${h.division})</span></td>
          <td><strong>${h.facultyName}</strong></td>
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
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-edit-history-trigger" data-id="${h.id}" data-tt="${h.timetableId}" style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 5px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Modify Register
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Bind triggers
  subjectSelect.addEventListener('change', drawHistory);
  facultySelect.addEventListener('change', drawHistory);
  dateInput.addEventListener('change', drawHistory);

  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    deptSelect.value = 'all';
    subjectSelect.value = 'all';
    facultySelect.value = 'all';
    dateInput.value = '';

    // Reset subject visibility
    Array.from(subjectSelect.options).forEach(opt => {
      opt.style.display = 'block';
    });

    drawHistory();
  });

  // Bind modify click
  document.getElementById('history-logs-rows').addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-edit-history-trigger');
    if (!btn) return;

    const historyId = btn.dataset.id;
    const timetableId = btn.dataset.tt;

    const activeRecord = history.find(h => h.id === historyId);
    if (activeRecord) {
      await openRosterEditModal(activeRecord, timetableId);
    }
  });

  drawHistory();
}

async function openRosterEditModal(log, timetableId) {
  // 1. Fetch roster for timetable cell
  const rosterRes = await apiFetch(`/faculty/roster/${timetableId}`);
  if (!rosterRes.success) return;

  const rosterData = rosterRes.data;
  const students = rosterData.roster;

  // Build current roster presence mapping
  const presenceState = {};
  students.forEach(s => {
    presenceState[s.id] = log.roster[s.id] || 'present';
  });

  // Roster modal HTML
  let rosterHTML = `
    <div style="margin-bottom: 16px;">
      <h4 style="font-weight:700; font-size: 1.1rem; margin-bottom: 4px;">${log.subjectCode} — ${log.subjectName}</h4>
      <p style="font-size:0.8rem; color:var(--text-secondary);">Date: ${log.date} | Period: ${log.period} | Class: Sem-${log.semester} Div-${log.division}</p>
    </div>
    
    <!-- Quick Actions -->
    <div style="display: flex; gap: 8px; margin-bottom: 16px; background: var(--bg-primary); padding: 8px 12px; border-radius: var(--radius-sm); justify-content: flex-end;">
      <button type="button" class="btn btn-secondary" style="padding: 6px 10px; font-size: 0.775rem;" id="modal-mark-present">All Present</button>
      <button type="button" class="btn btn-secondary" style="padding: 6px 10px; font-size: 0.775rem;" id="modal-mark-absent">All Absent</button>
    </div>

    <!-- Student Rows -->
    <div class="roster-list-container" id="modal-roster-rows" style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
      ${students.map(std => {
    const currentStatus = presenceState[std.id];
    return `
          <div class="roster-card-row ${currentStatus}-selected" id="modal-row-${std.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border: 1.5px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 2px;">
            <div class="roster-student-details" style="display: flex; align-items: center; gap: 8px;">
              <span class="roster-roll-badge" style="font-family: monospace; font-weight:700; color: var(--text-secondary); background: var(--bg-primary); padding: 4px 6px; border-radius: var(--radius-sm); font-size: 0.8rem;">${std.rollNumber}</span>
              <span class="roster-student-name" style="font-weight: 600; font-size: 0.925rem;">${std.name}</span>
            </div>
            
            <input type="hidden" name="student-${std.id}" id="modal-input-${std.id}" value="${currentStatus}">
            
            <!-- Presence Selector -->
            <div class="presence-selector" style="display: inline-flex; background-color: var(--bg-primary); border: 1px solid var(--border-color); padding: 2px; border-radius: var(--radius-round); width: 220px;">
              <button type="button" class="presence-btn p-present ${currentStatus === 'present' ? 'active' : ''}" data-id="${std.id}" data-status="present" style="font-size: 0.75rem; padding: 6px 10px;">P</button>
              <button type="button" class="presence-btn p-leave ${currentStatus === 'leave' ? 'active' : ''}" data-id="${std.id}" data-status="leave" style="font-size: 0.75rem; padding: 6px 10px;">L</button>
              <button type="button" class="presence-btn p-absent ${currentStatus === 'absent' ? 'active' : ''}" data-id="${std.id}" data-status="absent" style="font-size: 0.75rem; padding: 6px 10px;">A</button>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;

  openModal('Modify Attendance Register', rosterHTML, async (formData) => {
    const updatedRoster = {};
    students.forEach(std => {
      updatedRoster[std.id] = formData.get(`student-${std.id}`);
    });

    const payload = {
      timetableId: timetableId,
      date: log.date,
      roster: updatedRoster
    };

    const res = await apiFetch('/faculty/attendance', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      showToast('Attendance log updated successfully!', 'success');
      await renderAttendanceTab();
      return true;
    }
    return false;
  });

  // Attach interactive clicks to selector buttons within the modal window
  const modalRosterEl = document.getElementById('modal-roster-rows');
  modalRosterEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.presence-btn');
    if (!btn) return;

    const stdId = btn.dataset.id;
    const status = btn.dataset.status;

    // Update hidden input
    document.getElementById(`modal-input-${stdId}`).value = status;

    // Update row highlighting
    const row = document.getElementById(`modal-row-${stdId}`);
    row.className = `roster-card-row ${status}-selected`;

    // Update button active states
    const selector = btn.parentElement;
    selector.querySelectorAll('.presence-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  // Attach modal quick actions
  document.getElementById('modal-mark-present').addEventListener('click', () => {
    students.forEach(s => {
      document.getElementById(`modal-input-${s.id}`).value = 'present';
      const row = document.getElementById(`modal-row-${s.id}`);
      row.className = 'roster-card-row present-selected';

      const sel = row.querySelector('.presence-selector');
      sel.querySelectorAll('.presence-btn').forEach(b => b.classList.remove('active'));
      sel.querySelector('.p-present').classList.add('active');
    });
  });

  document.getElementById('modal-mark-absent').addEventListener('click', () => {
    students.forEach(s => {
      document.getElementById(`modal-input-${s.id}`).value = 'absent';
      const row = document.getElementById(`modal-row-${s.id}`);
      row.className = 'roster-card-row absent-selected';

      const sel = row.querySelector('.presence-selector');
      sel.querySelectorAll('.presence-btn').forEach(b => b.classList.remove('active'));
      sel.querySelector('.p-absent').classList.add('active');
    });
  });
}
