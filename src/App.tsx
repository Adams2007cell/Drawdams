import { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
import Board from './components/Board';

/* ================================================================
   DRAWDAMS — App Entry Point
   Manages authentication state and renders the appropriate screen.
   
   ── GOOGLE OAUTH CONFIGURATION ──
   To use real Google OAuth:
   1. Create a project in Google Cloud Console
   2. Enable Google Identity / Firebase Auth
   3. Replace the simulated login in SplashScreen with real OAuth
   4. For Google Drive export, enable Drive API and use the auth token
   
   Example with Firebase:
   ```
   import { GoogleAuthProvider, signInWithPopup, getAuth } from 'firebase/auth';
   const provider = new GoogleAuthProvider();
   const result = await signInWithPopup(getAuth(), provider);
   ```
================================================================ */

interface User {
  name: string;
  email: string;
  photo: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session
  useEffect(() => {
    const saved = localStorage.getItem('drawdams_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('drawdams_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('drawdams_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('drawdams_user');
  };

  // Loading screen
  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a1a', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -2,
            background: 'linear-gradient(135deg, #6C5CE7, #00B4D8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Drawdams</div>
          <div style={{ marginTop: 12, fontSize: 14, opacity: 0.5 }}>Cargando...</div>
        </div>
      </div>
    );
  }

  // Not authenticated → splash screen
  if (!user) {
    return <SplashScreen onLogin={handleLogin} />;
  }

  // Authenticated → board
  return <Board user={user} onLogout={handleLogout} />;
}
