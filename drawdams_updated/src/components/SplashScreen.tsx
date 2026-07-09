import { useState } from 'react';

interface User {
  name: string;
  email: string;
  photo: string;
}

interface SplashScreenProps {
  onLogin: (user: User) => void;
}

export default function SplashScreen({ onLogin }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    // Simulate Google OAuth delay
    setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        onLogin({
          name: 'Usuario Drawdams',
          email: 'usuario@drawdams.com',
          photo: '',
        });
      }, 800);
    }, 1200);
  };

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      {/* Ambient glow */}
      <div className="splash-glow g1" />
      <div className="splash-glow g2" />
      <div className="splash-glow g3" />

      {/* Floating shapes */}
      <div className="splash-shape" style={{ top: '8%', left: '6%', animationDelay: '0s' }}>◇</div>
      <div className="splash-shape" style={{ top: '18%', right: '10%', animationDelay: '-2s' }}>○</div>
      <div className="splash-shape" style={{ bottom: '12%', left: '12%', animationDelay: '-4s' }}>△</div>
      <div className="splash-shape" style={{ bottom: '22%', right: '6%', animationDelay: '-6s' }}>□</div>
      <div className="splash-shape" style={{ top: '48%', left: '48%', animationDelay: '-8s', fontSize: '100px' }}>⬡</div>
      <div className="splash-shape" style={{ top: '32%', left: '22%', animationDelay: '-3s', fontSize: '45px' }}>✦</div>
      <div className="splash-shape" style={{ bottom: '38%', right: '28%', animationDelay: '-5s', fontSize: '60px' }}>⬟</div>

      {/* Content */}
      <div className="splash-content">
        <div className="splash-logo">Drawdams</div>
        <p className="splash-subtitle">Tu pizarra digital infinita</p>

        <button className="google-btn" onClick={handleLogin} disabled={loading}>
          {loading ? (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Conectando...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Iniciar sesión con Google
            </>
          )}
        </button>

        <div className="splash-features">
          <div className="splash-feature"><span>✓</span> Lienzo infinito</div>
          <div className="splash-feature"><span>✓</span> Gratuito</div>
          <div className="splash-feature"><span>✓</span> Código abierto</div>
          <div className="splash-feature"><span>✓</span> Exportar PNG/SVG</div>
        </div>
      </div>
    </div>
  );
}
