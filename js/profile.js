import { guardRoute } from './auth.js';
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

// Inline SVG Icons Map (Zero Emojis)
const SVG_ICONS = {
  user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  mail: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>`,
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  dept: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><path d="M9 22v-4h6v4"></path><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="16" y2="14"></line></svg>`,
  roll: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="7" y1="8" x2="17" y2="8"></line><line x1="7" y1="12" x2="13" y2="12"></line><line x1="7" y1="16" x2="11" y2="16"></line></svg>`,
  calendar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  graduation: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>`,
  batch: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`,
  book: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
};

let currentProfile = null;

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

  // Fetch enriched profile data from API
  const res = await apiFetch('/auth/me');
  currentProfile = (res && res.success) ? res.data : user;

  renderProfileData(currentProfile);
  setupEditModal(currentProfile);
}

function renderProfileData(profile) {
  // Sidebar info
  const initials = profile.name ? profile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent = profile.name || 'User Profile';
  document.getElementById('sidebar-role-badge').textContent = (profile.role || 'USER').toUpperCase();
  document.getElementById('sidebar-dept-badge').textContent = profile.department ? `${profile.department} Stream` : 'General';

  // Identity Panel
  document.getElementById('val-name').textContent = profile.name || 'N/A';
  document.getElementById('val-email').textContent = profile.email || 'N/A';
  document.getElementById('val-role').textContent = (profile.role || 'N/A').toUpperCase();
  document.getElementById('val-dept').textContent = profile.department ? `${profile.department} Department` : 'General / All';

  // Role Specifications Panel
  const rolePanelTitle = document.getElementById('role-panel-title');
  const roleGrid = document.getElementById('role-field-grid');
  const role = profile.role;

  let fields = [];

  if (role === 'student') {
    rolePanelTitle.textContent = 'Student Enrollment Record';
    fields = [
      { label: 'Roll Number', value: `<span style="color:var(--color-accent); font-weight:800;">${profile.rollNumber || 'N/A'}</span>`, icon: SVG_ICONS.roll },
      { label: 'Date of Birth', value: formatDOB(profile.dob), icon: SVG_ICONS.calendar },
      { label: 'Academic Semester', value: `Semester ${profile.semester || 'N/A'}`, icon: SVG_ICONS.graduation },
      { label: 'Class Division / Batch', value: `Batch ${profile.division || 'N/A'}`, icon: SVG_ICONS.batch }
    ];
  } else if (role === 'faculty') {
    rolePanelTitle.textContent = 'Faculty Academic Portfolio';
    const subs = profile.subjects || [];
    const subHTML = subs.length > 0
      ? subs.map(s => `<span class="badge badge-primary" style="margin: 2px;">${s.code || ''} ${s.name || s}</span>`).join(' ')
      : '<span style="font-size:0.85rem; color:var(--text-muted);">No courses assigned</span>';

    fields = [
      { label: 'Assigned Department', value: `${profile.department || 'N/A'} Department`, icon: SVG_ICONS.dept },
      { label: 'Active Courses Count', value: `${subs.length} Courses Assigned`, icon: SVG_ICONS.book },
      { label: 'Assigned Courses', value: `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:2px;">${subHTML}</div>`, icon: SVG_ICONS.book }
    ];
  } else if (role === 'hod') {
    rolePanelTitle.textContent = 'Department Head Specifications';
    fields = [
      { label: 'HOD Designation', value: `Head of ${profile.department || 'N/A'} Department`, icon: SVG_ICONS.dept },
      { label: 'Department Faculty Staff', value: `${profile.deptFacultyCount || 0} Faculty Members`, icon: SVG_ICONS.users },
      { label: 'Enrolled Department Students', value: `${profile.deptStudentCount || 0} Active Students`, icon: SVG_ICONS.graduation }
    ];
  } else if (role === 'admin') {
    rolePanelTitle.textContent = 'System Administration Rights';
    fields = [
      { label: 'Administration Scope', value: 'Global Institutional Administrator', icon: SVG_ICONS.shield },
      { label: 'Privilege Level', value: 'Superuser Access (Users, Timetables, Logs)', icon: SVG_ICONS.shield }
    ];
  }

  roleGrid.innerHTML = fields.map(f => `
    <div class="data-field-box">
      <div class="field-icon">
        ${f.icon}
      </div>
      <div>
        <div class="field-title">${f.label}</div>
        <div class="field-text">${f.value}</div>
      </div>
    </div>
  `).join('');
}

function setupEditModal(profile) {
  const editBtn = document.getElementById('btn-open-edit-modal');
  const studentNotice = document.getElementById('student-readonly-notice');
  const modal = document.getElementById('edit-profile-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const form = document.getElementById('edit-profile-form');
  const nameInput = document.getElementById('edit-name-input');
  const emailInput = document.getElementById('edit-email-input');

  const isStaffOrAdmin = ['admin', 'hod', 'faculty'].includes(profile.role);

  if (isStaffOrAdmin) {
    if (editBtn) editBtn.style.display = 'flex';
    if (studentNotice) studentNotice.style.display = 'none';
  } else {
    if (editBtn) editBtn.style.display = 'none';
    if (studentNotice) studentNotice.style.display = 'block';
  }

  if (!isStaffOrAdmin || !modal) return;

  const openModal = () => {
    nameInput.value = profile.name || '';
    emailInput.value = profile.email || '';
    modal.style.display = 'flex';
  };

  const closeModal = () => {
    modal.style.display = 'none';
  };

  if (editBtn) editBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = nameInput.value.trim();
    const newEmail = emailInput.value.trim();

    if (!newName) {
      showToast('Full Name is required.', 'error');
      return;
    }

    const saveBtn = document.getElementById('btn-save-profile');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const res = await apiFetch('/auth/me', {
      method: 'PUT',
      body: JSON.stringify({ name: newName, email: newEmail })
    });

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';

    if (res && res.success) {
      showToast('Profile updated successfully!', 'success');
      profile.name = newName;
      profile.email = newEmail;

      // Update session in localStorage
      const sessionStr = localStorage.getItem('sat_session');
      if (sessionStr) {
        try {
          const sess = JSON.parse(sessionStr);
          sess.user.name = newName;
          sess.user.email = newEmail;
          localStorage.setItem('sat_session', JSON.stringify(sess));
        } catch (err) {}
      }

      renderProfileData(profile);
      closeModal();
    }
  });
}
