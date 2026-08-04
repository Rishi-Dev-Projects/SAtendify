// SAtendify Configuration Module

export const CONFIG = {
  // If true, the frontend will intercept HTTP calls and query mockData.js / localStorage.
  // Set to false to proxy to the real FastAPI/Flask server backend.
  USE_MOCK: false,

  // Base URL of the FastAPI/Flask backend server
  API_BASE_URL: window.location.origin + '/api',

  // Simulated latency for API calls during mock mode (in milliseconds)
  // Helps test loading state animations, skeletons, and disable buttons
  MOCK_DELAY: 400,

  // Firebase client-side SDK configuration
  // Replace these with your actual Firebase project web app keys
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyCwPRTIq2XHFvzmQ7lwjIJYq_742RXDOCY",
    authDomain: "satendify-e43c7.firebaseapp.com",
    projectId: "satendify-e43c7",
    storageBucket: "satendify-e43c7.firebasestorage.app",
    messagingSenderId: "853131506207",
    appId: "1:853131506207:web:f9b82490467382fcaf5b2a"
  }
};
