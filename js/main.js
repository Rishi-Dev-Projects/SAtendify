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
      <li class="nav-item ${activeTab === 'overview' ? 'active' : ''}"><a href="admin.html?tab=overview">Dashboard</a></li>
      <li class="nav-item ${activeTab === 'departments' ? 'active' : ''}"><a href="admin.html?tab=departments">Subjects</a></li>
      <li class="nav-item ${activeTab === 'faculty' ? 'active' : ''}"><a href="admin.html?tab=faculty">Faculty</a></li>
      <li class="nav-item ${activeTab === 'students' ? 'active' : ''}"><a href="admin.html?tab=students">Students</a></li>
      <li class="nav-item ${activeTab === 'timetable' ? 'active' : ''}"><a href="admin.html?tab=timetable">Timetable</a></li>
      <li class="nav-item ${activeTab === 'attendance' ? 'active' : ''}"><a href="admin.html?tab=attendance">Attendance Logs</a></li>
    `;
  } else if (user.role === 'hod') {
    linksHTML = `
      <li class="nav-item ${activeTab === 'overview' ? 'active' : ''}"><a href="hod.html?tab=overview">Dashboard</a></li>
      <li class="nav-item ${activeTab === 'faculty' ? 'active' : ''}"><a href="hod.html?tab=faculty">Faculty Assignments</a></li>
      <li class="nav-item ${activeTab === 'proxies' ? 'active' : ''}"><a href="hod.html?tab=proxies">Proxy Allocations</a></li>
      <li class="nav-item ${activeTab === 'students' ? 'active' : ''}"><a href="hod.html?tab=students">Students</a></li>
      <li class="nav-item ${activeTab === 'timetable' ? 'active' : ''}"><a href="hod.html?tab=timetable">Timetable</a></li>
      <li class="nav-item ${activeTab === 'take-attendance' ? 'active' : ''}"><a href="hod.html?tab=take-attendance">Take Attendance</a></li>
      <li class="nav-item ${activeTab === 'attendance' ? 'active' : ''}"><a href="hod.html?tab=attendance">Attendance Logs</a></li>
    `;
  } else if (user.role === 'faculty') {
    linksHTML = `
      <li class="nav-item ${activeTab === 'timetable-today' ? 'active' : ''}"><a href="faculty.html?tab=timetable-today">Today's Classes</a></li>
      <li class="nav-item ${activeTab === 'proxies' ? 'active' : ''}"><a href="faculty.html?tab=proxies">Proxy Allocations</a></li>
      <li class="nav-item ${activeTab === 'students' ? 'active' : ''}"><a href="faculty.html?tab=students">Students</a></li>
      <li class="nav-item ${activeTab === 'history' ? 'active' : ''}"><a href="faculty.html?tab=history">Attendance Logs</a></li>
      <li class="nav-item ${activeTab === 'timetable-weekly' ? 'active' : ''}"><a href="faculty.html?tab=timetable-weekly">Weekly Timetable</a></li>
    `;
  } else if (user.role === 'student') {
    linksHTML = `
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
      <div class="user-profile-badge" style="flex-shrink: 0;">
        ${deptBadge}
        <div class="profile-info">
          <div class="profile-name">${user.name}</div>
          <div class="profile-role">${user.role}</div>
        </div>
        <div class="avatar">${initials}</div>
      </div>
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
