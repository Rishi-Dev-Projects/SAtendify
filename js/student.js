// SAtendify Student Dashboard Controller
import { guardRoute } from './auth.js';
import { initializeChrome } from './main.js';
import { apiFetch, showToast } from './api.js';

// Route guard validation
const user = guardRoute(['student']);
if (user) {
  window.addEventListener('DOMContentLoaded', () => initStudentDashboard());
  window.addEventListener('popstate', () => initStudentDashboard());
  window.addEventListener('tabchange', (e) => initStudentDashboard(e.detail ? e.detail.tab : null));
}

// Chart pointers to clean up on reload/redraw
let subjectChartInstance = null;
let trendChartInstance = null;

async function initStudentDashboard(forcedTab = null) {
  const urlParams = new URLSearchParams(window.location.search);
  const activeTab = forcedTab || urlParams.get('tab') || 'overview';

  initializeChrome(activeTab, getPageTitleForTab(activeTab));

  switch (activeTab) {
    case 'overview':
    case 'my-attendance':
      await renderStudentOverviewTab();
      break;
    case 'subjects':
      await renderStudentSubjectsTab();
      break;
    case 'attendance-log':
      await renderStudentAttendanceLogTab();
      break;
    case 'my-timetable':
      await renderStudentTimetableGrid();
      break;
    default:
      await renderStudentOverviewTab();
  }
}

function getPageTitleForTab(tab) {
  switch (tab) {
    case 'overview':
    case 'my-attendance': return 'Overview Stats';
    case 'subjects': return 'Subject Progress';
    case 'attendance-log': return 'Attendance Logs';
    case 'my-timetable': return 'Class Schedule';
    default: return 'Student Portal';
  }
}

function getStudentProfileBannerSkeleton() {
  return `
    <div class="panel-card skeleton-card" style="margin-bottom: 24px; padding: 22px 28px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; border: none; border-radius: var(--radius-lg);">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
        <div style="display: flex; align-items: center; gap: 18px;">
          <div class="skeleton-pulse" style="width: 52px; height: 52px; border-radius: 50%; background: rgba(255,255,255,0.12);"></div>
          <div>
            <div class="skeleton-pulse" style="width: 180px; height: 22px; border-radius: 6px; background: rgba(255,255,255,0.15); margin-bottom: 8px;"></div>
            <div class="skeleton-pulse" style="width: 260px; height: 14px; border-radius: 4px; background: rgba(255,255,255,0.1);"></div>
          </div>
        </div>
        <div class="skeleton-pulse" style="width: 140px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.12);"></div>
      </div>
    </div>
  `;
}

function getOverviewSkeleton() {
  return `
    ${getStudentProfileBannerSkeleton()}
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 24px;">
      ${[1, 2, 3, 4].map(() => `
        <div class="panel-card" style="padding: 24px; background: var(--bg-secondary);">
          <div class="skeleton-pulse" style="width: 100px; height: 14px; border-radius: 4px; margin-bottom: 12px; background: var(--border-color);"></div>
          <div class="skeleton-pulse" style="width: 70px; height: 32px; border-radius: 6px; margin-bottom: 8px; background: var(--border-color);"></div>
          <div class="skeleton-pulse" style="width: 130px; height: 12px; border-radius: 4px; background: var(--border-color);"></div>
        </div>
      `).join('')}
    </div>
    <div class="panel-card" style="padding: 20px; margin-bottom: 24px; background: var(--bg-secondary);">
      <div class="skeleton-pulse" style="width: 220px; height: 16px; border-radius: 4px; margin-bottom: 8px; background: var(--border-color);"></div>
      <div class="skeleton-pulse" style="width: 90%; height: 14px; border-radius: 4px; background: var(--border-color);"></div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="panel-card" style="padding: 24px; background: var(--bg-secondary);">
        <div class="skeleton-pulse" style="width: 160px; height: 18px; border-radius: 4px; margin-bottom: 20px; background: var(--border-color);"></div>
        <div class="skeleton-pulse" style="width: 100%; height: 180px; border-radius: 8px; background: var(--border-color);"></div>
      </div>
      <div class="panel-card" style="padding: 24px; background: var(--bg-secondary);">
        <div class="skeleton-pulse" style="width: 160px; height: 18px; border-radius: 4px; margin-bottom: 20px; background: var(--border-color);"></div>
        <div class="skeleton-pulse" style="width: 100%; height: 180px; border-radius: 8px; background: var(--border-color);"></div>
      </div>
    </div>
  `;
}

function getSubjectsSkeleton() {
  return `
    ${getStudentProfileBannerSkeleton()}
    <div class="panel-card" style="padding: 24px; background: var(--bg-secondary);">
      <div class="skeleton-pulse" style="width: 240px; height: 20px; border-radius: 4px; margin-bottom: 24px; background: var(--border-color);"></div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
        ${[1, 2, 3, 4].map(() => `
          <div class="panel-card" style="padding: 20px; background: var(--bg-primary); border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <div class="skeleton-pulse" style="width: 140px; height: 18px; border-radius: 4px; background: var(--border-color);"></div>
              <div class="skeleton-pulse" style="width: 45px; height: 22px; border-radius: 12px; background: var(--border-color);"></div>
            </div>
            <div class="skeleton-pulse" style="width: 180px; height: 14px; border-radius: 4px; margin-bottom: 16px; background: var(--border-color);"></div>
            <div class="skeleton-pulse" style="width: 100%; height: 8px; border-radius: 4px; margin-bottom: 16px; background: var(--border-color);"></div>
            <div style="display: flex; justify-content: flex-end;">
              <div class="skeleton-pulse" style="width: 90px; height: 30px; border-radius: 6px; background: var(--border-color);"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function getAttendanceLogSkeleton() {
  return `
    ${getStudentProfileBannerSkeleton()}
    <div class="panel-card" style="padding: 24px; background: var(--bg-secondary);">
      <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
        <div class="skeleton-pulse" style="width: 220px; height: 24px; border-radius: 4px; background: var(--border-color);"></div>
        <div style="display: flex; gap: 12px;">
          <div class="skeleton-pulse" style="width: 160px; height: 36px; border-radius: 6px; background: var(--border-color);"></div>
          <div class="skeleton-pulse" style="width: 140px; height: 36px; border-radius: 6px; background: var(--border-color);"></div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${[1, 2, 3, 4, 5].map(() => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; border-bottom: 1px solid var(--border-color);">
            <div class="skeleton-pulse" style="width: 110px; height: 16px; border-radius: 4px; background: var(--border-color);"></div>
            <div class="skeleton-pulse" style="width: 80px; height: 20px; border-radius: 10px; background: var(--border-color);"></div>
            <div class="skeleton-pulse" style="width: 160px; height: 16px; border-radius: 4px; background: var(--border-color);"></div>
            <div class="skeleton-pulse" style="width: 120px; height: 14px; border-radius: 4px; background: var(--border-color);"></div>
            <div class="skeleton-pulse" style="width: 85px; height: 24px; border-radius: 12px; background: var(--border-color);"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function getTimetableSkeleton() {
  return `
    <div class="panel-card" style="padding: 24px; background: var(--bg-secondary);">
      <div class="skeleton-pulse" style="width: 220px; height: 22px; border-radius: 4px; margin-bottom: 24px; background: var(--border-color);"></div>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px;">
        ${Array.from({ length: 28 }).map(() => `
          <div class="skeleton-pulse" style="height: 65px; border-radius: 8px; background: var(--border-color);"></div>
        `).join('')}
      </div>
    </div>
  `;
}

function formatDOB(dobStr) {
  if (!dobStr) return 'N/A';
  const clean = dobStr.replace(/\D/g, '');
  if (clean.length === 8) {
    const day = clean.substring(0, 2);
    const month = clean.substring(2, 4);
    const year = clean.substring(4, 8);
    return `${day}/${month}/${year}`;
  }
  return dobStr;
}

function renderStudentProfileBanner(studentInfo, stats) {
  const isEligible = stats.overallPercentage >= 75;
  const initials = (studentInfo.name || 'Student').split(' ').map(n => n[0]).join('').substring(0, 2);
  const displayDOB = formatDOB(studentInfo.dob || user.dob);

  return `
    <div class="panel-card" style="margin-bottom: 24px; padding: 22px 28px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; border: none; border-radius: var(--radius-lg);">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
        <div style="display: flex; align-items: center; gap: 18px;">
          <div style="width: 52px; height: 52px; background: var(--color-accent); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800; border: 2px solid rgba(255,255,255,0.25);">
            ${initials}
          </div>
          <div>
            <h2 style="font-size: 1.35rem; font-weight: 800; color: #ffffff; margin: 0;">${studentInfo.name}</h2>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px; font-size: 0.85rem; color: #94a3b8; flex-wrap: wrap;">
              <span>Roll: <strong style="color:#f8fafc;">${studentInfo.rollNumber || 'N/A'}</strong></span>
              <span>&middot;</span>
              <span>DOB: <strong style="color:#f8fafc;">${displayDOB}</strong></span>
              <span>&middot;</span>
              <span class="badge badge-it" style="background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.25);">${studentInfo.department}</span>
              <span>&middot;</span>
              <span>Semester ${studentInfo.semester} (Batch ${studentInfo.division})</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          ${isEligible ? `
            <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 8px 16px; border-radius: 8px; color: #34d399; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <span>🟢 Exam Eligible</span>
              <span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.775rem;">${stats.overallPercentage}%</span>
            </div>
          ` : `
            <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px 16px; border-radius: 8px; color: #f87171; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <span>🚨 Attendance Warning</span>
              <span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.775rem;">${stats.overallPercentage}%</span>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 1. OVERVIEW & STATS TAB
// ==========================================
async function renderStudentOverviewTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = getOverviewSkeleton();

  const res = await apiFetch('/student/attendance');
  if (!res.success) return;

  const data = res.data;
  const stats = data.stats;
  const subjects = data.subjectBreakdown;
  const trend = data.weeklyTrend;

  container.innerHTML = `
    ${renderStudentProfileBanner(data.studentInfo, stats)}

    <!-- KPI Metric Cards Grid -->
    <div class="metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-label">Overall Attendance</div>
        <div class="stat-value ${stats.overallPercentage < 75 ? 'text-danger' : 'text-success'}" style="font-size: 1.85rem; font-weight: 800;">
          ${stats.overallPercentage}%
        </div>
        <div class="stat-description" style="font-size: 0.775rem; color: var(--text-secondary); margin-top: 4px;">Requirement: 75.0%</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Attended Lectures</div>
        <div class="stat-value text-success" style="font-size: 1.85rem; font-weight: 800;">
          ${stats.attendedClasses} <span style="font-size: 0.9rem; font-weight: normal; color: var(--text-secondary);">/ ${stats.totalClasses}</span>
        </div>
        <div class="stat-description" style="font-size: 0.775rem; color: var(--text-secondary); margin-top: 4px;">Present sessions logged</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Missed Lectures</div>
        <div class="stat-value text-danger" style="font-size: 1.85rem; font-weight: 800;">
          ${stats.missedClasses}
        </div>
        <div class="stat-description" style="font-size: 0.775rem; color: var(--text-secondary); margin-top: 4px;">Unexcused absences</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Approved Leaves</div>
        <div class="stat-value text-warning" style="font-size: 1.85rem; font-weight: 800;">
          ${stats.leaveClasses}
        </div>
        <div class="stat-description" style="font-size: 0.775rem; color: var(--text-secondary); margin-top: 4px;">Sanctioned leave slots</div>
      </div>
    </div>

    <!-- Exam Clearance Notice Bar -->
    <div class="panel-card" style="margin-bottom: 24px; padding: 18px 24px; border-left: 4px solid ${stats.overallPercentage < 75 ? 'var(--color-danger)' : 'var(--color-success)'}; background: ${stats.overallPercentage < 75 ? 'var(--color-danger-subtle)' : 'var(--color-success-subtle)'};">
      ${stats.overallPercentage < 75 ? `
        <h4 style="color: #991b1b; font-weight: 700; font-size: 0.95rem; margin: 0 0 4px 0;">🚨 Action Required: Attendance Deficit Warning</h4>
        <p style="color: #b91c1c; font-size: 0.85rem; margin: 0;">Your current score of <strong>${stats.overallPercentage}%</strong> is below the institutional 75% threshold. Please meet your HOD or Subject Faculty to clarify condonations.</p>
      ` : `
        <h4 style="color: #065f46; font-weight: 700; font-size: 0.95rem; margin: 0 0 4px 0;">🟢 Exam Eligibility Verified</h4>
        <p style="color: #047857; font-size: 0.85rem; margin: 0;">Your cumulative attendance ratio of <strong>${stats.overallPercentage}%</strong> complies with examination board criteria.</p>
      `}
    </div>

    <!-- Charts Row Grid -->
    <div class="charts-row-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="panel-card">
        <div class="panel-header">
          <h3>Subject Attendance Ratios (%)</h3>
        </div>
        <div class="panel-body">
          <canvas id="subj-chart" style="max-height: 220px;"></canvas>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <h3>Semester Term Attendance Curve</h3>
        </div>
        <div class="panel-body">
          <canvas id="trend-chart" style="max-height: 220px;"></canvas>
        </div>
      </div>
    </div>
  `;

  loadChartJSGraphs(subjects, trend);
}

// ==========================================
// 2. SUBJECT PROGRESS TAB
// ==========================================
async function renderStudentSubjectsTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = getSubjectsSkeleton();

  const res = await apiFetch('/student/attendance');
  if (!res.success) return;

  const data = res.data;
  const subjects = data.subjectBreakdown;

  container.innerHTML = `
    ${renderStudentProfileBanner(data.studentInfo, data.stats)}

    <div class="panel-card">
      <div class="panel-header">
        <h3>Enrolled Subject Roster & Ratios</h3>
      </div>
      <div class="panel-body">
        ${subjects.length === 0 ? `
          <div class="empty-placeholder-box">
            <div class="empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            </div>
            <p>No subject courses registered for your semester profile.</p>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
            ${subjects.map(sb => {
              const isLow = sb.percentage < 75;
              const badgeClass = isLow ? 'badge-danger' : 'badge-success';
              return `
                <div class="panel-card" style="padding: 20px; background: var(--bg-primary); border: 1px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px;">
                      <div>
                        <span class="badge badge-primary" style="margin-bottom: 4px; font-size: 0.75rem;">${sb.code}</span>
                        <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin: 0;">${sb.name}</h4>
                      </div>
                      <span class="badge ${badgeClass}" style="font-size: 0.85rem; font-weight: 700;">${sb.percentage}%</span>
                    </div>

                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">👨‍🏫 Lecturer: <strong>${sb.facultyName}</strong></p>

                    <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
                      <span>Attended Lectures</span>
                      <span>${sb.attended} / ${sb.total} sessions</span>
                    </div>

                    <div class="meter-progress-track" style="height: 8px; background: var(--border-color); border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
                      <div class="meter-progress-bar" style="width: ${sb.percentage}%; height: 100%; background: ${isLow ? 'var(--color-danger)' : 'var(--color-success)'}; transition: width 0.4s ease;"></div>
                    </div>
                  </div>

                  <div style="text-align: right;">
                    <a href="student.html?tab=attendance-log&subject=${sb.code}" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem; text-decoration: none; display: inline-block;">
                      View Logs &rarr;
                    </a>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

// ==========================================
// 3. ATTENDANCE LOGS TAB (HISTORICAL LEDGER)
// ==========================================
async function renderStudentAttendanceLogTab() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = getAttendanceLogSkeleton();

  const res = await apiFetch('/student/attendance');
  if (!res.success) return;

  const data = res.data;
  const subjects = data.subjectBreakdown;

  // Flatten all logs across all subjects into one historical list
  let allLogs = [];
  subjects.forEach(sb => {
    (sb.historyLog || []).forEach(log => {
      allLogs.push({
        subjectCode: sb.code,
        subjectName: sb.name,
        facultyName: sb.facultyName,
        date: log.date,
        period: log.period,
        status: log.status
      });
    });
  });

  // Sort logs chronologically descending (latest dates first)
  allLogs.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.period - a.period;
  });

  const urlParams = new URLSearchParams(window.location.search);
  const initialSubjFilter = urlParams.get('subject') || 'all';

  container.innerHTML = `
    ${renderStudentProfileBanner(data.studentInfo, data.stats)}

    <div class="panel-card">
      <div class="panel-header" style="flex-wrap: wrap;">
        <h3>Historical Attendance Ledger</h3>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <input type="text" id="log-search" class="form-control" placeholder="Search date or period..." style="padding: 6px 12px; font-size: 0.85rem; width: 180px;">
          <select id="filter-log-subject" class="form-control" style="padding: 6px 12px; font-size: 0.85rem;">
            <option value="all">All Enrolled Courses</option>
            ${subjects.map(sb => `<option value="${sb.code}" ${initialSubjFilter === sb.code ? 'selected' : ''}>${sb.code} - ${sb.name}</option>`).join('')}
          </select>
          <select id="filter-log-status" class="form-control" style="padding: 6px 12px; font-size: 0.85rem;">
            <option value="all">All Statuses</option>
            <option value="present">🟢 Present Only</option>
            <option value="absent">🔴 Absent Only</option>
            <option value="leave">🟡 On Leave Only</option>
          </select>
          <button id="btn-export-log-csv" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;">📥 Export CSV</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="custom-table" id="logs-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Period Slot</th>
              <th>Course Subject</th>
              <th>Faculty Professor</th>
              <th style="text-align: right;">Presence Status</th>
            </tr>
          </thead>
          <tbody id="logs-table-rows">
            <!-- Populated dynamically -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  function drawLogs() {
    const searchVal = document.getElementById('log-search').value.toLowerCase();
    const subjVal = document.getElementById('filter-log-subject').value;
    const statusVal = document.getElementById('filter-log-status').value;

    const filtered = allLogs.filter(l => {
      const matchSearch = (l.date && l.date.toLowerCase().includes(searchVal)) ||
                          (l.subjectName && l.subjectName.toLowerCase().includes(searchVal)) ||
                          (l.subjectCode && l.subjectCode.toLowerCase().includes(searchVal)) ||
                          (`period ${l.period}`.includes(searchVal));
      const matchSubj = subjVal === 'all' || l.subjectCode === subjVal;
      const matchStatus = statusVal === 'all' || l.status === statusVal;
      return matchSearch && matchSubj && matchStatus;
    });

    const rowsContainer = document.getElementById('logs-table-rows');
    if (filtered.length === 0) {
      rowsContainer.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-placeholder-box">
              <div class="empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </div>
              <p>No historical attendance logs match the selected filters.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    rowsContainer.innerHTML = filtered.map(l => {
      const stBadge = l.status === 'present' ?
        '<span class="badge badge-success" style="padding: 4px 10px;">🟢 Present</span>' :
        l.status === 'leave' ?
        '<span class="badge badge-warning" style="padding: 4px 10px;">🟡 On Leave</span>' :
        '<span class="badge badge-danger" style="padding: 4px 10px;">🔴 Absent</span>';

      return `
        <tr>
          <td><strong style="font-family: monospace;">📅 ${l.date}</strong></td>
          <td><span class="badge badge-primary">Period ${l.period}</span></td>
          <td>
            <strong>${l.subjectCode}</strong>
            <span style="font-size: 0.8rem; color: var(--text-secondary); display: block;">${l.subjectName}</span>
          </td>
          <td><span style="font-size: 0.85rem; color: var(--text-secondary);">👨‍🏫 ${l.facultyName}</span></td>
          <td style="text-align: right;">${stBadge}</td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('log-search').addEventListener('input', drawLogs);
  document.getElementById('filter-log-subject').addEventListener('change', drawLogs);
  document.getElementById('filter-log-status').addEventListener('change', drawLogs);

  document.getElementById('btn-export-log-csv').addEventListener('click', () => {
    showToast('Exporting attendance ledger CSV...', 'success');
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Date,Period,Subject Code,Subject Name,Faculty,Status\n"
      + allLogs.map(l => `"${l.date}","Period ${l.period}","${l.subjectCode}","${l.subjectName}","${l.facultyName}","${l.status.toUpperCase()}"`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", encodedUri);
    downloadLink.setAttribute("download", `SAtendify_Log_Sem${data.studentInfo.semester}_${data.studentInfo.rollNumber}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  });

  drawLogs();
}

function loadChartJSGraphs(subjects, trend) {
  if (subjectChartInstance) subjectChartInstance.destroy();
  if (trendChartInstance) trendChartInstance.destroy();

  const subjCtx = document.getElementById('subj-chart');
  if (subjCtx) {
    subjectChartInstance = new Chart(subjCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: subjects.map(s => s.code),
        datasets: [{
          label: 'Attendance %',
          data: subjects.map(s => s.percentage),
          backgroundColor: subjects.map(s => s.percentage < 75 ? 'rgba(239, 68, 68, 0.75)' : 'rgba(37, 99, 235, 0.75)'),
          borderColor: subjects.map(s => s.percentage < 75 ? 'rgb(239, 68, 68)' : 'rgb(37, 99, 235)'),
          borderWidth: 1.5,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: value => value + '%' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  const trendCtx = document.getElementById('trend-chart');
  if (trendCtx) {
    trendChartInstance = new Chart(trendCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: trend.map(t => t.week),
        datasets: [{
          label: 'Averaged Attendance %',
          data: trend.map(t => t.percentage),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: 'rgb(16, 185, 129)',
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 40, max: 100, ticks: { callback: value => value + '%' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

// ==========================================
// 4. CLASS TIMETABLE GRID
// ==========================================
async function renderStudentTimetableGrid() {
  const container = document.getElementById('dashboard-content');
  container.innerHTML = getTimetableSkeleton();

  const res = await apiFetch('/student/timetable');
  if (!res.success) return;

  const timetable = res.data;

  container.innerHTML = `
    <div class="panel-card">
      <div class="panel-header">
        <h3>Class Weekly Lecture Schedule</h3>
      </div>
      <div class="panel-body">
        <div class="table-responsive">
          <div class="timetable-grid" id="student-weekly-grid"></div>
        </div>

        <div class="mobile-timetable-list" id="student-mobile-tt" style="margin-top: 24px; display: none;"></div>
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

  function drawGrid() {
    const grid = document.getElementById('student-weekly-grid');
    if (!grid) return;

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
        const cell = timetable.find(c => {
          const duration = c.duration || 1;
          return c.day === day && p.num >= c.period && p.num < c.period + duration;
        });

        if (cell) {
          const isStart = p.num === cell.period;
          const typeLabel = cell.type === 'lab' ? '🔬 Lab' : cell.type === 'tutorial' ? '📖 Tut' : '';

          if (isStart) {
            gridHTML += `
              <div class="timetable-cell" style="background-color: var(--color-accent-subtle); ${cell.type && cell.type !== 'lecture' ? 'border-left: 3px solid var(--color-success);' : ''}">
                <div>
                  <div class="cell-subject" style="color:var(--color-accent);">${cell.subject ? cell.subject.name : 'Class'} ${typeLabel ? `<span style="font-size:0.65rem; font-weight:normal; background:#dcfce7; color:#166534; padding:2px 4px; border-radius:3px; margin-left:4px;">${typeLabel}</span>` : ''}</div>
                  <div class="cell-faculty">👨‍🏫 ${cell.facultyName.replace('Prof. ', '').replace('Dr. ', '')}</div>
                </div>
                <div class="cell-room">🚪 Rm ${cell.room}</div>
              </div>
            `;
          } else {
            gridHTML += `
              <div class="timetable-cell" style="opacity: 0.85; background-color: var(--color-accent-subtle); ${cell.type && cell.type !== 'lecture' ? 'border-left: 3px solid var(--color-success);' : ''}">
                <div style="font-size:0.75rem; color:var(--text-secondary); font-style:italic;">
                  (Continuation of ${cell.subject ? cell.subject.code : 'lecture'})
                </div>
                <div class="cell-room">🚪 Rm ${cell.room}</div>
              </div>
            `;
          }
        } else {
          gridHTML += `
            <div class="timetable-cell empty-cell" style="border:none; background: #fafbfc; pointer-events:none;">
              <span style="font-size:0.65rem; color:var(--text-secondary); font-style:italic;">-</span>
            </div>
          `;
        }
      });
    });

    grid.innerHTML = gridHTML;

    const mobContainer = document.getElementById('student-mobile-tt');
    if (mobContainer) {
      let mobHTML = '';
      days.forEach(day => {
        const dayClasses = timetable.filter(c => c.day === day).sort((a,b) => a.period - b.period);
        mobHTML += `
          <div class="mobile-tt-card">
            <h4 style="border-bottom: 2px solid var(--border-color); padding-bottom: 6px; font-weight:800; color:var(--text-primary); margin-bottom: 8px;">${day}</h4>
            ${dayClasses.length === 0 ? `<p style="font-size:0.8rem; color:var(--text-muted); italic; padding: 4px 0;">No lectures scheduled today.</p>` :
              dayClasses.map(c => {
                const duration = c.duration || 1;
                const periodText = duration > 1 ? `P${c.period}-P${c.period + duration - 1}` : `P${c.period}`;
                const typeLabel = c.type === 'lab' ? '🔬 Lab' : c.type === 'tutorial' ? '📖 Tut' : '';
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom:1px solid #f1f5f9;">
                    <div>
                      <span class="badge badge-primary">${periodText}</span>
                      <strong style="margin-left:6px; font-size:0.85rem;">${c.subject ? c.subject.name : 'Subject'} ${typeLabel ? `<span style="font-size:0.65rem; font-weight:normal; background:#dcfce7; color:#166534; padding:2px 4px; border-radius:3px; margin-left:4px;">${typeLabel}</span>` : ''}</strong>
                      <span style="display:block; font-size:0.75rem; color:var(--text-secondary); margin-left:26px;">${c.facultyName} &middot; Room ${c.room}</span>
                    </div>
                  </div>
                `;
              }).join('')
            }
          </div>
        `;
      });
      mobContainer.innerHTML = mobHTML;

      if (window.innerWidth <= 768) {
        grid.style.display = 'none';
        mobContainer.style.display = 'flex';
      } else {
        grid.style.display = 'grid';
        mobContainer.style.display = 'none';
      }
    }
  }

  window.addEventListener('resize', drawGrid);
  drawGrid();
}
