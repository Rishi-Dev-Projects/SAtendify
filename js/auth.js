// SAtendify Authentication Module
import { CONFIG } from './config.js';
import { getDB } from './mockData.js';

// Global variables for Firebase references (lazy loaded if in production mode)
let firebaseApp = null;
let firebaseAuth = null;

// Initialize Firebase if mocking is disabled
async function initFirebase() {
  if (!CONFIG.USE_MOCK && typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
    } else {
      firebaseApp = firebase.app();
    }
    firebaseAuth = firebase.auth();
  }
}

// Simple sleep helper to simulate network latency
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function login(email, password) {
  // Clear any existing session first
  localStorage.removeItem('sat_session');
  
  if (CONFIG.USE_MOCK) {
    await sleep(CONFIG.MOCK_DELAY);
    const users = getDB('sat_users') || [];
    
    // Find matching user. For mock convenience, ANY password works, or verify password === 'password123'
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return { success: false, error: 'Invalid email address.' };
    }
    
    // Valid mock user session
    const session = {
      token: `mock-jwt-${user.id}-${Date.now()}`,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        department: user.department,
        semester: user.semester || null,
        division: user.division || null,
        rollNumber: user.rollNumber || null
      }
    };
    
    localStorage.setItem('sat_session', JSON.stringify(session));
    return { success: true, user: session.user };
  } else {
    // Production Firebase Auth
    try {
      await initFirebase();
      const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
      const fbUser = userCredential.user;
      const idToken = await fbUser.getIdToken();

      // Fetch user profile stats/roles from backend database
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      const payload = await response.json();
      
      if (payload.success) {
        const session = {
          token: idToken,
          user: payload.data
        };
        localStorage.setItem('sat_session', JSON.stringify(session));
        return { success: true, user: session.user };
      } else {
        return { success: false, error: payload.error || 'Failed to sync user profile from server.' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export async function studentLogin(rollNumber, dob) {
  // Clear any existing session first
  localStorage.removeItem('sat_session');
  
  const cleanRoll = (rollNumber || '').trim().toUpperCase();
  const cleanDOB = (dob || '').replace(/\D/g, '').trim();

  if (!cleanRoll || !cleanDOB) {
    return { success: false, error: 'Please enter both Roll Number and Date of Birth (DDMMYYYY).' };
  }

  if (CONFIG.USE_MOCK) {
    await sleep(CONFIG.MOCK_DELAY);
    const users = getDB('sat_users') || [];
    
    // Find matching student by Roll No & DOB
    const user = users.find(u => 
      u.role === 'student' && 
      (u.rollNumber || '').trim().toUpperCase() === cleanRoll &&
      (u.dob || '').replace(/\D/g, '').trim() === cleanDOB
    );
    
    if (!user) {
      return { success: false, error: 'Invalid Roll Number or Date of Birth (DDMMYYYY).' };
    }
    
    const session = {
      token: `mock-jwt-${user.id}-${Date.now()}`,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        department: user.department,
        semester: user.semester || null,
        division: user.division || null,
        rollNumber: user.rollNumber || null,
        dob: user.dob || null
      }
    };
    
    localStorage.setItem('sat_session', JSON.stringify(session));
    return { success: true, user: session.user };
  } else {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/student-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rollNumber: cleanRoll, dob: cleanDOB })
      });
      
      const payload = await response.json();
      if (payload.success) {
        const session = {
          token: payload.token || `student-token-${payload.data.id}`,
          user: payload.data
        };
        localStorage.setItem('sat_session', JSON.stringify(session));
        return { success: true, user: session.user };
      } else {
        return { success: false, error: payload.error || 'Student authentication failed.' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export async function logout() {
  if (!CONFIG.USE_MOCK) {
    try {
      await initFirebase();
      if (firebaseAuth) {
        await firebaseAuth.signOut();
      }
    } catch (e) {
      console.error('Firebase signout error:', e);
    }
  }
  localStorage.removeItem('sat_session');
  window.location.href = 'login.html';
}

export function getCurrentUser() {
  const sessionStr = localStorage.getItem('sat_session');
  if (!sessionStr) return null;
  try {
    const session = JSON.parse(sessionStr);
    return session.user;
  } catch (e) {
    return null;
  }
}

export function getAuthToken() {
  const sessionStr = localStorage.getItem('sat_session');
  if (!sessionStr) return null;
  try {
    const session = JSON.parse(sessionStr);
    return session.token;
  } catch (e) {
    return null;
  }
}

// Client-side route guarding
export function guardRoute(allowedRoles = []) {
  const user = getCurrentUser();
  
  if (!user) {
    // Save current path to jump back later if wanted
    localStorage.setItem('sat_redirect_after_login', window.location.pathname);
    window.location.replace('login.html');
    return null;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    window.location.replace('403.html');
    return null;
  }
  
  return user;
}
