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
// GLOBAL AUTOMATIC ABSENTEE REPORT MODAL
// ==========================================
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
        <td><span class="badge badge-warning" style="font-family:monospace; font-size:0.8rem; font-weight:700;">${std.rollNumber || 'N/A'}</span></td>
        <td><strong style="color:var(--text-primary);">${std.name}</strong></td>
        <td><span style="font-size:0.825rem; color:var(--text-secondary);">${std.mobile || std.email || 'N/A'}</span></td>
      </tr>
    `).join('');
  }

  const modalHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- REPORT HEADER CARD -->
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: #ffffff; border-radius: var(--radius-lg); padding: 20px; box-shadow: 0 4px 12px rgba(79,70,229,0.25);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <span class="badge" style="background: rgba(255,255,255,0.2); color: #ffffff; font-size: 0.725rem; text-transform: uppercase; font-weight: 700; padding: 3px 8px; margin-bottom: 6px; display: inline-block;">Official Session Absentee Audit</span>
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #ffffff;">${report.subjectName || 'Course Lecture'}</h3>
            <div style="font-size: 0.85rem; opacity: 0.9; margin-top: 2px;">Subject Code: <strong>${report.subjectCode || 'N/A'}</strong> &middot; Room: <strong>${report.room || 'N/A'}</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; font-weight: 700; font-family: monospace; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 6px;">${report.date}</div>
            <div style="font-size: 0.75rem; opacity: 0.85; margin-top: 4px;">Period ${report.period} &middot; Sem-${report.semester} (${report.division})</div>
          </div>
        </div>
      </div>

      <!-- METRICS GRID -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 12px 14px; text-align: center;">
          <div style="font-size: 0.725rem; font-weight: 700; color: #166534; text-transform: uppercase;">Present Students</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #15803d; margin-top: 2px;">${presentCount} <span style="font-size: 0.8rem; font-weight: 600; opacity: 0.8;">(${presentPct}%)</span></div>
        </div>
        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: var(--radius-md); padding: 12px 14px; text-align: center;">
          <div style="font-size: 0.725rem; font-weight: 700; color: #991b1b; text-transform: uppercase;">Absent Students</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #dc2626; margin-top: 2px;">${absentCount} <span style="font-size: 0.8rem; font-weight: 600; opacity: 0.8;">(${absentPct}%)</span></div>
        </div>
        <div style="background: #fefce8; border: 1px solid #fde047; border-radius: var(--radius-md); padding: 12px 14px; text-align: center;">
          <div style="font-size: 0.725rem; font-weight: 700; color: #854d0e; text-transform: uppercase;">On Approved Leave</div>
          <div style="font-size: 1.4rem; font-weight: 800; color: #ca8a04; margin-top: 2px;">${leaveCount} <span style="font-size: 0.8rem; font-weight: 600; opacity: 0.8;">(${leavePct}%)</span></div>
        </div>
      </div>

      <!-- ABSENTEE ROSTER TABLE -->
      <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
        <div style="padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h4 style="margin: 0; font-size: 0.925rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            Official Absentee List (${absentCount})
          </h4>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Generated: ${report.generatedAt || 'Today'}</span>
        </div>
        
        <div class="table-responsive" style="max-height: 240px; overflow-y: auto;">
          <table class="custom-table" style="margin: 0;">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Roll Number</th>
                <th>Student Name</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              ${absentRowsHTML}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  if (window.openModal) {
    window.openModal('Generated Session Absentee Report', modalHTML, null, {
      maxWidth: '680px',
      hideCancel: true,
      customFooter: `
        <button type="button" class="btn btn-secondary" id="btn-close-report-modal" style="font-weight: 600;">Close</button>
        <button type="button" class="btn btn-primary" id="btn-print-report-modal" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print / Download PDF
        </button>
      `
    });

    setTimeout(() => {
      const printBtn = document.getElementById('btn-print-report-modal');
      const closeBtn = document.getElementById('btn-close-report-modal');
      if (closeBtn && window.closeModal) closeBtn.onclick = () => window.closeModal();
      if (printBtn) printBtn.onclick = () => window.print();
    }, 50);
  }
}
window.showAbsenteeReportModal = showAbsenteeReportModal;
