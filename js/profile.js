import { guardRoute, logout } from './auth.js';
import { initializeChrome } from './main.js';
import { apiFetch, showToast } from './api.js';

// Route guard for all authenticated roles
const user = guardRoute(['admin', 'hod', 'faculty', 'student']);

if (user) {
  window.addEventListener('DOMContentLoaded', initProfilePage);
}

function formatDOB(dobStr) {
  if (!dobStr) return 'N/A';
  const clean = dobStr.replace(/[^0-9]/g, '');
  if (clean.length === 8) {
    const dd = clean.substring(0, 2);
    const mm = clean.substring(2, 4);
    const yyyy = clean.substring(4, 8);
    return `${dd}/${mm}/${yyyy}`;
  }
  return dobStr;
}

async function initProfilePage() {
  initializeChrome('profile', 'My User Profile');

  // Bind Back to Dashboard button
  const backBtn = document.getElementById('btn-back-dashboard');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      let targetDashboard = 'login.html';
      if (user.role === 'admin') targetDashboard = 'admin.html';
      else if (user.role === 'hod') targetDashboard = 'hod.html';
      else if (user.role === 'faculty') targetDashboard = 'faculty.html';
      else if (user.role === 'student') targetDashboard = 'student.html';
      window.location.href = targetDashboard;
    });
  }

  // Bind Logout
  const logoutBtn = document.getElementById('btn-profile-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to log out of SAtendify?')) {
        await logout();
      }
    });
  }

  // Populate hero initial data from session
  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
  document.getElementById('hero-avatar').textContent = initials;
  document.getElementById('hero-name').textContent = user.name || 'User Profile';
  document.getElementById('hero-role-badge').textContent = (user.role || 'USER').toUpperCase();
  document.getElementById('hero-subtext').textContent = user.department ? `${user.department} Department &bull; SAtendify Portal` : 'SAtendify Portal Member';

  // Fetch enriched profile from API
  const res = await apiFetch('/auth/me');
  const profile = (res && res.success) ? res.data : user;

  // Render Account Identity Card
  document.getElementById('val-name').textContent = profile.name || 'N/A';
  document.getElementById('val-email').textContent = profile.email || 'N/A';
  document.getElementById('val-role').textContent = profile.role ? profile.role.toUpperCase() : 'N/A';
  document.getElementById('val-dept').textContent = profile.department ? `${profile.department} Department` : 'General';
  document.getElementById('val-status').textContent = (profile.status || 'Active').toUpperCase();

  // Render Role-Specific Card
  renderRoleCard(profile);
}

function renderRoleCard(profile) {
  const cardTitle = document.getElementById('role-card-title');
  const cardIcon = document.getElementById('role-card-icon');
  const cardBody = document.getElementById('role-card-body');
  if (!cardTitle || !cardBody) return;

  const role = profile.role;

  if (role === 'student') {
    if (cardIcon) {
      cardIcon.innerHTML = `<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>`;
    }
    cardTitle.textContent = 'Student Academic Profile';
    cardBody.innerHTML = `
      <div class="profile-info-row">
        <span class="profile-info-label">Roll Number</span>
        <span class="profile-info-value" style="color: var(--color-accent); font-weight:800;">${profile.rollNumber || 'N/A'}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Date of Birth</span>
        <span class="profile-info-value">${formatDOB(profile.dob)}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Academic Semester</span>
        <span class="profile-info-value">Semester ${profile.semester || 'N/A'}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Class Division / Batch</span>
        <span class="profile-info-value">Batch ${profile.division || 'N/A'}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Attendance Criteria</span>
        <span class="profile-info-value"><span class="badge badge-warning">75% Mandatory</span></span>
      </div>
    `;
  } else if (role === 'faculty') {
    if (cardIcon) {
      cardIcon.innerHTML = `<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
    }
    cardTitle.textContent = 'Faculty Academic Portfolio';
    const subs = profile.subjects || [];
    const subBadges = subs.length > 0
      ? subs.map(s => `<span class="badge badge-primary" style="margin: 2px;">${s.code || ''} ${s.name || s}</span>`).join(' ')
      : '<span style="font-size:0.85rem; color:var(--text-muted);">No subjects assigned</span>';

    cardBody.innerHTML = `
      <div class="profile-info-row">
        <span class="profile-info-label">Faculty Stream</span>
        <span class="profile-info-value">${profile.department || 'N/A'} Department</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Assigned Subjects Count</span>
        <span class="profile-info-value">${subs.length} Active Courses</span>
      </div>
      <div style="padding: 12px 0;">
        <span class="profile-info-label" style="margin-bottom: 8px;">Assigned Courses:</span>
        <div style="margin-top: 6px; display:flex; flex-wrap:wrap; gap:6px;">
          ${subBadges}
        </div>
      </div>
    `;
  } else if (role === 'hod') {
    if (cardIcon) {
      cardIcon.innerHTML = `<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
    }
    cardTitle.textContent = 'HOD Department Management';
    cardBody.innerHTML = `
      <div class="profile-info-row">
        <span class="profile-info-label">Designation</span>
        <span class="profile-info-value">Head of ${profile.department || 'N/A'} Department</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Department Faculty Staff</span>
        <span class="profile-info-value" style="color:var(--color-accent); font-weight:800;">${profile.deptFacultyCount || 0} Faculty Members</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Enrolled Students</span>
        <span class="profile-info-value">${profile.deptStudentCount || 0} Active Students</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Administrative Authority</span>
        <span class="profile-info-value"><span class="badge badge-success">Departmental Overseer</span></span>
      </div>
    `;
  } else if (role === 'admin') {
    if (cardIcon) {
      cardIcon.innerHTML = `<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M6 8h.01M10 8h.01M14 8h.01"></path></svg>`;
    }
    cardTitle.textContent = 'System Administration Scope';
    cardBody.innerHTML = `
      <div class="profile-info-row">
        <span class="profile-info-label">Administrative Scope</span>
        <span class="profile-info-value">Global Institutional Administrator</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Privilege Level</span>
        <span class="profile-info-value" style="color:var(--color-danger); font-weight:800;">Superuser / Full Access</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Managed Entities</span>
        <span class="profile-info-value">All Departments, Subjects & Users</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Security Protocol</span>
        <span class="profile-info-value"><span class="badge badge-primary">Encrypted Bearer Session</span></span>
      </div>
    `;
  }
}iv>
    `;
  }
}
