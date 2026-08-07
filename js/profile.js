import { guardRoute } from './auth.js';
import { initializeChrome } from './main.js';
import { apiFetch } from './api.js';

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

// Inline SVG Icons Map (Zero Emojis)
const SVG_ICONS = {
  user: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  mail: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>`,
  shield: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  dept: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"></rect><path d="M9 22v-4h6v4"></path><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="16" y2="14"></line></svg>`,
  roll: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="7" y1="8" x2="17" y2="8"></line><line x1="7" y1="12" x2="13" y2="12"></line><line x1="7" y1="16" x2="11" y2="16"></line></svg>`,
  calendar: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  graduation: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>`,
  batch: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
  book: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
  users: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-3-3.87"></path><path d="M9 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg>`,
  status: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
};

async function initProfilePage() {
  initializeChrome('profile', 'User Profile');

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

  // Populate hero banner initial data from session
  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
  document.getElementById('hero-avatar').textContent = initials;
  document.getElementById('hero-name').textContent = user.name || 'User Profile';
  document.getElementById('hero-role-badge').textContent = (user.role || 'USER').toUpperCase();
  document.getElementById('hero-subtext').textContent = user.department ? `${user.department} Department Stream` : 'SAtendify Portal Member';

  // Fetch enriched profile data from API
  const res = await apiFetch('/auth/me');
  const profile = (res && res.success) ? res.data : user;

  renderProfileGrid(profile);
}

function renderProfileGrid(profile) {
  const grid = document.getElementById('profile-field-grid');
  if (!grid) return;

  const role = profile.role;

  // Base Common Fields
  let fields = [
    { label: 'Full Name', value: profile.name || 'N/A', icon: SVG_ICONS.user },
    { label: 'Email Address', value: profile.email || 'N/A', icon: SVG_ICONS.mail },
    { label: 'System Role', value: (profile.role || 'N/A').toUpperCase(), icon: SVG_ICONS.shield },
    { label: 'Department Stream', value: profile.department ? `${profile.department} Department` : 'General / All Streams', icon: SVG_ICONS.dept },
    { label: 'Account Status', value: '<span class="badge badge-success">ACTIVE</span>', icon: SVG_ICONS.status }
  ];

  // Role-Tailored Custom Fields
  if (role === 'student') {
    fields.push(
      { label: 'Roll Number', value: `<span style="color:var(--color-accent); font-weight:800;">${profile.rollNumber || 'N/A'}</span>`, icon: SVG_ICONS.roll },
      { label: 'Date of Birth', value: formatDOB(profile.dob), icon: SVG_ICONS.calendar },
      { label: 'Academic Semester', value: `Semester ${profile.semester || 'N/A'}`, icon: SVG_ICONS.graduation },
      { label: 'Division / Batch', value: `Batch ${profile.division || 'N/A'}`, icon: SVG_ICONS.batch }
    );
  } else if (role === 'faculty') {
    const subs = profile.subjects || [];
    const subHTML = subs.length > 0
      ? subs.map(s => `<span class="badge badge-primary" style="margin: 2px;">${s.code || ''} ${s.name || s}</span>`).join(' ')
      : '<span style="font-size:0.85rem; color:var(--text-muted);">No courses assigned</span>';

    fields.push(
      { label: 'Assigned Courses Count', value: `${subs.length} Active Courses`, icon: SVG_ICONS.book },
      { label: 'Assigned Courses List', value: `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:2px;">${subHTML}</div>`, icon: SVG_ICONS.book }
    );
  } else if (role === 'hod') {
    fields.push(
      { label: 'Department Designation', value: `Head of ${profile.department || 'N/A'} Department`, icon: SVG_ICONS.dept },
      { label: 'Faculty Members', value: `${profile.deptFacultyCount || 0} Faculty Staff`, icon: SVG_ICONS.users },
      { label: 'Enrolled Students', value: `${profile.deptStudentCount || 0} Active Students`, icon: SVG_ICONS.graduation }
    );
  } else if (role === 'admin') {
    fields.push(
      { label: 'Administrator Scope', value: 'Global Institutional Superuser', icon: SVG_ICONS.shield },
      { label: 'System Privileges', value: 'Full Access to Users, Timetables & Logs', icon: SVG_ICONS.status }
    );
  }

  // Render Grid
  grid.innerHTML = fields.map(f => `
    <div class="profile-field-item">
      <div class="field-icon-box">
        ${f.icon}
      </div>
      <div>
        <div class="field-label">${f.label}</div>
        <div class="field-value">${f.value}</div>
      </div>
    </div>
  `).join('');
}
