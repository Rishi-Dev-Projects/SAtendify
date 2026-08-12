// SAtendify Global UI Router and Chrome Manager
import { getCurrentUser, logout } from './auth.js';
import { showToast } from './api.js';

// Setup global layout, sidebar, and headers
export function initializeChrome(activeTab, pageTitle) {
  const user = getCurrentUser();
  if (!user) {
    window.location.replace('login.html');
    return;
  }

  // 1. Render Sidebar
  renderSidebar(user, activeTab);

  // 2. Render Header
  renderHeader(user, pageTitle);

  // 3. Bind Hamburger Events for mobile responsiveness
  bindMobileEvents();
}

function renderSidebar(user, activeTab) {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  // Build Links based on role
  let linksHTML = '';

  if (user.role === 'admin') {
    linksHTML = `
      <li class="nav-item ${activeTab === 'profile' ? 'active' : ''}"><a href="profile.html">My Profile</a></li>
      <li class="nav-item ${activeTab === 'overview' ? 'active' : ''}"><a href="admin.html?tab=overview">Dashboard</a></li>
      <li class="nav-item ${activeTab === 'departments' ? 'active' : ''}"><a href="admin.html?tab=departments">Subjects</a></li>
      <li class="nav-item ${activeTab === 'faculty' ? 'active' : ''}"><a href="admin.html?tab=faculty">Faculty</a></li>
      <li class="nav-item ${activeTab === 'proxies' ? 'active' : ''}"><a href="admin.html?tab=proxies">Proxy Allocations</a></li>
      <li class="nav-item ${activeTab === 'students' ? 'active' : ''}"><a href="admin.html?tab=students">Students</a></li>
      <li class="nav-item ${activeTab === 'timetable' ? 'active' : ''}"><a href="admin.html?tab=timetable">Timetable</a></li>
      <li class="nav-item ${activeTab === 'attendance' ? 'active' : ''}"><a href="admin.html?tab=attendance">Attendance Logs</a></li>
    `;
  } else if (user.role === 'hod') {
    linksHTML = `
      <li class="nav-item ${activeTab === 'profile' ? 'active' : ''}"><a href="profile.html">My Profile</a></li>
      <li class="nav-item ${activeTab === 'overview' ? 'active' : ''}"><a href="hod.html?tab=overview">Dashboard</a></li>
      <li class="nav-item ${activeTab === 'faculty' ? 'active' : ''}"><a href="hod.html?tab=faculty">Faculty</a></li>
      <li class="nav-item ${activeTab === 'proxies' ? 'active' : ''}"><a href="hod.html?tab=proxies">Proxy Allocations</a></li>
      <li class="nav-item ${activeTab === 'students' ? 'active' : ''}"><a href="hod.html?tab=students">Students</a></li>
      <li class="nav-item ${activeTab === 'timetable' ? 'active' : ''}"><a href="hod.html?tab=timetable">Timetable</a></li>
      <li class="nav-item ${activeTab === 'take-attendance' ? 'active' : ''}"><a href="hod.html?tab=take-attendance">Take Attendance</a></li>
      <li class="nav-item ${activeTab === 'attendance' ? 'active' : ''}"><a href="hod.html?tab=attendance">Attendance Logs</a></li>
    `;
  } else if (user.role === 'faculty') {
    linksHTML = `
      <li class="nav-item ${activeTab === 'profile' ? 'active' : ''}"><a href="profile.html">My Profile</a></li>
      <li class="nav-item ${activeTab === 'timetable-today' ? 'active' : ''}"><a href="faculty.html?tab=timetable-today">Today's Classes</a></li>
      <li class="nav-item ${activeTab === 'proxies' ? 'active' : ''}"><a href="faculty.html?tab=proxies">Proxy Allocations</a></li>
      <li class="nav-item ${activeTab === 'students' ? 'active' : ''}"><a href="faculty.html?tab=students">Students</a></li>
      <li class="nav-item ${activeTab === 'history' ? 'active' : ''}"><a href="faculty.html?tab=history">Attendance Logs</a></li>
      <li class="nav-item ${activeTab === 'timetable-weekly' ? 'active' : ''}"><a href="faculty.html?tab=timetable-weekly">Weekly Timetable</a></li>
    `;
  } else if (user.role === 'student') {
    linksHTML = `
      <li class="nav-item ${activeTab === 'profile' ? 'active' : ''}"><a href="profile.html">My Profile</a></li>
      <li class="nav-item ${activeTab === 'overview' || activeTab === 'my-attendance' ? 'active' : ''}"><a href="student.html?tab=overview">Overview Stats</a></li>
      <li class="nav-item ${activeTab === 'subjects' ? 'active' : ''}"><a href="student.html?tab=subjects">Subject Progress</a></li>
      <li class="nav-item ${activeTab === 'attendance-log' ? 'active' : ''}"><a href="student.html?tab=attendance-log">Attendance Logs</a></li>
      <li class="nav-item ${activeTab === 'my-timetable' ? 'active' : ''}"><a href="student.html?tab=my-timetable">Class Schedule</a></li>
    `;
  }

  sidebarContainer.innerHTML = `
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    <aside class="app-sidebar" id="app-sidebar">
      <div class="brand-section">
        <div class="logo-icon">S</div>
        <h1>SAtendify</h1>
        <button class="sidebar-close-btn" id="sidebar-close-btn" aria-label="Close Navigation Drawer">&times;</button>
      </div>
      <ul class="nav-links">
        ${linksHTML}
      </ul>
      <div class="sidebar-footer">
        <button id="sidebar-logout" class="logout-btn">
          Logout
        </button>
      </div>
    </aside>
  `;

  // Bind SPA link clicks to prevent unnecessary full browser reloads
  sidebarContainer.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href) return;
      const url = new URL(href, window.location.origin);
      if (url.pathname === window.location.pathname) {
        e.preventDefault();
        const tab = url.searchParams.get('tab');
        window.history.pushState({}, '', href);

        // Update active link styling
        sidebarContainer.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
        a.parentElement.classList.add('active');

        // Dispatch tabchange event for SPA render
        window.dispatchEvent(new CustomEvent('tabchange', { detail: { tab } }));
      }
    });
  });

  // Bind Logout
  document.getElementById('sidebar-logout').addEventListener('click', async () => {
    if (confirm('Are you sure you want to secure log out of SAtendify?')) {
      await logout();
    }
  });
}

function renderHeader(user, pageTitle) {
  const headerContainer = document.getElementById('header-container');
  if (!headerContainer) return;

  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  // Format Department Badge HTML
  let deptBadge = '';
  if (user.department) {
    const deptClass = `badge-${user.department.toLowerCase()}`;
    deptBadge = `<span class="badge ${deptClass}" style="margin-right: 8px;">Dept: ${user.department}</span>`;
  }

  headerContainer.innerHTML = `
    <header class="app-header">
      <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1 1 auto; overflow: hidden;">
        <button class="hamburger-menu" id="hamburger-menu" aria-label="Open Navigation Drawer">☰</button>
        <div class="page-title" style="min-width: 0; flex: 1 1 auto; overflow: hidden;">
          <h2 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;" title="${pageTitle}">${pageTitle}</h2>
        </div>
      </div>
      <a href="profile.html" class="user-profile-badge clickable-profile-badge" title="View Full Profile" style="flex-shrink: 0; text-decoration: none; cursor: pointer; transition: all 0.2s ease;">
        ${deptBadge}
        <div class="profile-info">
          <div class="profile-name" style="font-weight: 700;">${user.name}</div>
          <div class="profile-role" style="text-transform: capitalize; color: var(--color-accent); font-weight: 600;">${user.role} &bull; Profile &rarr;</div>
        </div>
        <div class="avatar" style="box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);">${initials}</div>
      </a>
    </header>
  `;
}

function bindMobileEvents() {
  const menuBtn = document.getElementById('hamburger-menu');
  const closeBtn = document.getElementById('sidebar-close-btn');
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  const openDrawer = () => {
    if (sidebar) sidebar.classList.add('show-mobile');
    if (backdrop) backdrop.classList.add('show');
  };

  const closeDrawer = () => {
    if (sidebar) sidebar.classList.remove('show-mobile');
    if (backdrop) backdrop.classList.remove('show');
  };

  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (sidebar && sidebar.classList.contains('show-mobile')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDrawer();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeDrawer();
    });
  }

  // Close when tapping links inside drawer on mobile
  if (sidebar) {
    sidebar.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 992) {
          closeDrawer();
        }
      });
    });
  }
}

// ==========================================
// ==========================================
// GLOBAL AUTOMATIC ABSENTEE REPORT & EXCEL EXPORT
// ==========================================
export function exportReportToExcel(report) {
  if (!report) return;

  const total = report.totalStudents || ((report.presentCount || 0) + (report.absentCount || 0) + (report.leaveCount || 0)) || 1;
  const presentCount = report.presentCount || 0;
  const absentCount = report.absentCount || 0;
  const leaveCount = report.leaveCount || 0;
  const presentPct = Math.round((presentCount / total) * 100);

  const rows = [
    ["SAtendify Academic Management System - Official Session Attendance Audit"],
    ["Generated On:", report.generatedAt || new Date().toLocaleString()],
    ["Date of Session:", report.date],
    ["Period Slot:", `Period ${report.period}`],
    ["Department Stream:", `${report.department || 'General'} Engineering`],
    ["Class Details:", `Semester ${report.semester} (Division ${report.division})`],
    ["Subject:", `${report.subjectCode || ''} - ${report.subjectName || ''}`],
    ["Classroom / Lab Room:", report.room || 'N/A'],
    ["Total Enrolled Roster:", total],
    ["Present Students Count:", presentCount],
    ["Absent Students Count:", absentCount],
    ["Leave Students Count:", leaveCount],
    ["Overall Presence Ratio:", `${presentPct}%`],
    [""],
    ["OFFICIAL ABSENTEE ROSTER"],
    ["S.No.", "Roll Number", "Student Name", "Attendance Status", "Contact Number", "Email Address"]
  ];

  const absentList = report.absentStudents || [];
  if (absentList.length === 0) {
    rows.push(["-", "-", "100% Attendance Recorded - No Absentees", "PRESENT", "-", "-"]);
  } else {
    absentList.forEach((std, idx) => {
      rows.push([
        idx + 1,
        `"${std.rollNumber || ''}"`,
        `"${std.name || ''}"`,
        "ABSENT",
        `"${std.mobile || ''}"`,
        `"${std.email || ''}"`
      ]);
    });
  }

  const fullList = report.fullRoster || [];
  if (fullList.length > 0) {
    rows.push([""]);
    rows.push(["FULL CLASS ATTENDANCE REGISTRY LOG"]);
    rows.push(["S.No.", "Roll Number", "Student Name", "Attendance Status", "Contact Number", "Email Address"]);
    fullList.forEach((std, idx) => {
      rows.push([
        idx + 1,
        `"${std.rollNumber || ''}"`,
        `"${std.name || ''}"`,
        (std.status || 'present').toUpperCase(),
        `"${std.mobile || ''}"`,
        `"${std.email || ''}"`
      ]);
    });
  }

  const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const cleanSubject = (report.subjectCode || 'Session').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute("download", `SAtendify_Absentee_Report_${cleanSubject}_${report.date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
window.exportReportToExcel = exportReportToExcel;

export function showAbsenteeReportModal(report) {
  if (!report) return;

  const total = report.totalStudents || ((report.presentCount || 0) + (report.absentCount || 0) + (report.leaveCount || 0)) || 1;
  const presentCount = report.presentCount || 0;
  const absentCount = report.absentCount || 0;
  const leaveCount = report.leaveCount || 0;

  const presentPct = Math.round((presentCount / total) * 100);
  const absentPct = Math.round((absentCount / total) * 100);
  const leavePct = Math.round((leaveCount / total) * 100);

  const absentList = report.absentStudents || [];
  const fullList = report.fullRoster || [];

  let absentRowsHTML = '';
  if (absentList.length === 0) {
    absentRowsHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding: 24px; color: #166534; background: #f0fdf4;">
          <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 4px;">🎉 100% Attendance Recorded!</div>
          <div style="font-size: 0.85rem; color: #15803d;">All ${total} enrolled students were present for this lecture session.</div>
        </td>
      </tr>
    `;
  } else {
    absentRowsHTML = absentList.map((std, idx) => `
      <tr>
        <td><span style="font-weight:700; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</span></td>
        <td><span class="badge badge-danger" style="font-family:monospace; font-size:0.8rem; font-weight:700;">${std.rollNumber || 'N/A'}</span></td>
        <td><strong style="color:var(--text-primary);">${std.name}</strong></td>
        <td><span style="font-size:0.825rem; color:var(--text-secondary);">${std.mobile || std.email || 'N/A'}</span></td>
      </tr>
    `).join('');
  }

  let fullRowsHTML = fullList.map((std, idx) => {
    const isP = std.status === 'present';
    const isA = std.status === 'absent';
    const badgeClass = isP ? 'badge-success' : isA ? 'badge-danger' : 'badge-warning';
    const label = isP ? '✓ PRESENT' : isA ? '❌ ABSENT' : '⏳ LEAVE';
    return `
      <tr>
        <td><span style="font-weight:700; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</span></td>
        <td><span class="badge" style="font-family:monospace; font-size:0.8rem; font-weight:700; background:var(--bg-secondary);">${std.rollNumber || 'N/A'}</span></td>
        <td><strong style="color:var(--text-primary);">${std.name}</strong></td>
        <td><span class="badge ${badgeClass}" style="font-size:0.725rem;">${label}</span></td>
      </tr>
    `;
  }).join('');

  const modalHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- INSTITUTIONAL EXECUTIVE HEADER -->
      <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: #ffffff; border-radius: var(--radius-lg); padding: 20px; box-shadow: 0 4px 14px rgba(30,27,75,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span class="badge" style="background: rgba(255,255,255,0.2); color: #ffffff; font-size: 0.725rem; text-transform: uppercase; font-weight: 700; padding: 3px 8px;">Official Session Audit Report</span>
              <span class="badge" style="background: rgba(99,102,241,0.3); color: #c7d2fe; font-size: 0.725rem; font-weight: 600; padding: 3px 8px;">${report.department || 'Engineering'} Stream</span>
            </div>
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff;">${report.subjectName || 'Course Session'}</h3>
            <div style="font-size: 0.85rem; opacity: 0.9; margin-top: 3px;">Course Code: <strong>${report.subjectCode || 'N/A'}</strong> &middot; Room: <strong>${report.room || 'N/A'}</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; font-weight: 700; font-family: monospace; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 6px; display: inline-block;">${report.date}</div>
            <div style="font-size: 0.75rem; opacity: 0.85; margin-top: 4px;">Period ${report.period} &middot; Sem-${report.semester} (${report.division})</div>
          </div>
        </div>
      </div>

      <!-- METRICS STATS BAR -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 12px 14px; text-align: center;">
          <div style="font-size: 0.725rem; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Present Students</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #15803d; margin-top: 2px;">${presentCount} <span style="font-size: 0.8rem; font-weight: 600; opacity: 0.85;">(${presentPct}%)</span></div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: var(--radius-md); padding: 12px 14px; text-align: center;">
          <div style="font-size: 0.725rem; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Absent Students</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #dc2626; margin-top: 2px;">${absentCount} <span style="font-size: 0.8rem; font-weight: 600; opacity: 0.85;">(${absentPct}%)</span></div>
        </div>
        <div style="background: #fefce8; border: 1px solid #fde047; border-radius: var(--radius-md); padding: 12px 14px; text-align: center;">
          <div style="font-size: 0.725rem; font-weight: 700; color: #854d0e; text-transform: uppercase; letter-spacing: 0.5px;">On Approved Leave</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #ca8a04; margin-top: 2px;">${leaveCount} <span style="font-size: 0.8rem; font-weight: 600; opacity: 0.85;">(${leavePct}%)</span></div>
        </div>
      </div>

      <!-- TAB SELECTION -->
      <div style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); padding-bottom: 8px;">
        <button type="button" class="btn btn-secondary report-tab-btn active" id="tab-absentee-view" style="font-weight: 700; font-size: 0.825rem; padding: 6px 14px; border-radius: var(--radius-sm);">
          📋 Absentee Roster (${absentCount})
        </button>
        <button type="button" class="btn btn-secondary report-tab-btn" id="tab-fullroster-view" style="font-weight: 700; font-size: 0.825rem; padding: 6px 14px; border-radius: var(--radius-sm);">
          📜 Full Class Registry (${total})
        </button>
      </div>

      <!-- ROSTER TABLE CONTAINERS -->
      <div id="pane-absentee-view" style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
        <div class="table-responsive" style="max-height: 240px; overflow-y: auto;">
          <table class="custom-table" style="margin: 0;">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Roll Number</th>
                <th>Student Name</th>
                <th>Contact Details</th>
              </tr>
            </thead>
            <tbody>
              ${absentRowsHTML}
            </tbody>
          </table>
        </div>
      </div>

      <div id="pane-fullroster-view" style="display: none; background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
        <div class="table-responsive" style="max-height: 240px; overflow-y: auto;">
          <table class="custom-table" style="margin: 0;">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Roll Number</th>
                <th>Student Name</th>
                <th>Attendance Status</th>
              </tr>
            </thead>
            <tbody>
              ${fullRowsHTML}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  const openModalFn = window.openModal || (typeof openModal === 'function' ? openModal : null);
  if (openModalFn) {
    openModalFn('Official Session Absentee Audit Report', modalHTML, null, {
      maxWidth: '720px',
      hideCancel: true,
      customFooter: `
        <button type="button" class="btn btn-secondary" id="btn-close-report-modal" style="font-weight: 600;">Close</button>
        <button type="button" class="btn btn-secondary" id="btn-print-report-modal" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print Document
        </button>
        <button type="button" class="btn btn-primary" id="btn-excel-report-modal" style="background: #16a34a; border-color: #16a34a; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; box-shadow: 0 2px 6px rgba(22,163,74,0.3);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8"></path><path d="M8 17h8"></path><path d="M10 9h4"></path></svg>
          Download Excel Sheet (.xlsx / .csv)
        </button>
      `
    });

    setTimeout(() => {
      const printBtn = document.getElementById('btn-print-report-modal');
      const excelBtn = document.getElementById('btn-excel-report-modal');
      const closeBtn = document.getElementById('btn-close-report-modal');
      const tabAbsent = document.getElementById('tab-absentee-view');
      const tabFull = document.getElementById('tab-fullroster-view');
      const paneAbsent = document.getElementById('pane-absentee-view');
      const paneFull = document.getElementById('pane-fullroster-view');

      if (closeBtn && window.closeModal) closeBtn.onclick = () => window.closeModal();
      if (printBtn) printBtn.onclick = () => window.print();
      if (excelBtn) excelBtn.onclick = () => exportReportToExcel(report);

      if (tabAbsent && tabFull && paneAbsent && paneFull) {
        tabAbsent.onclick = () => {
          tabAbsent.classList.add('active');
          tabFull.classList.remove('active');
          paneAbsent.style.display = 'block';
          paneFull.style.display = 'none';
        };
        tabFull.onclick = () => {
          tabFull.classList.add('active');
          tabAbsent.classList.remove('active');
          paneFull.style.display = 'block';
          paneAbsent.style.display = 'none';
        };
      }
    }, 50);
  }
}
window.showAbsenteeReportModal = showAbsenteeReportModal;
