import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

export function Login() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check for error from OAuth callback
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    
    if (errorParam) {
      setError(messageParam || `Authentication failed: ${errorParam}`);
    }
  }, [searchParams]);

  const handleMicrosoftLogin = () => {
    setIsLoading(true);
    setError('');
    
    // Redirect to Microsoft OAuth login endpoint
    window.location.href = '/api/auth/microsoft/login';
  };

  return (
    <div style={styles.container}>
      <motion.div
        style={styles.loginCard}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div style={styles.logoSection}>
          <div style={styles.logo}>
            <span style={styles.logoText}>DW</span>
          </div>
          <h1 style={styles.title}>GROWTH & CAPITAL HUB</h1>
          <p style={styles.subtitle}>Sign in to continue</p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            style={styles.errorBanner}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
          >
            {error}
          </motion.div>
        )}

        {/* Microsoft Sign In Button */}
        <motion.button
          onClick={handleMicrosoftLogin}
          style={styles.microsoftBtn}
          disabled={isLoading}
          whileHover={{ scale: 1.02, boxShadow: '0 6px 20px rgba(18, 44, 33, 0.3)' }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Microsoft Logo */}
          <svg style={styles.microsoftLogo} viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          <span>{isLoading ? 'Redirecting...' : 'Sign in with Microsoft'}</span>
        </motion.button>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Use your Microsoft 365 account to access the platform
          </p>
        </div>
      </motion.div>

      {/* Background decoration */}
      <div style={styles.bgDecoration1} />
      <div style={styles.bgDecoration2} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a2e1f 0%, #3d5a3d 25%, #5a7a5a 50%, #7a9a7a 75%, #9aba9a 100%)',
    backgroundAttachment: 'fixed',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    background: 'rgba(246, 243, 239, 0.97)',
    borderRadius: '24px',
    padding: '48px 40px',
    boxShadow: '0 25px 50px rgba(18, 44, 33, 0.35)',
    position: 'relative',
    zIndex: 10,
  },
  logoSection: {
    textAlign: 'center' as const,
    marginBottom: '40px',
  },
  logo: {
    width: '80px',
    height: '80px',
    background: 'linear-gradient(135deg, #122c21 0%, #1a4d3a 100%)',
    borderRadius: '20px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 8px 24px rgba(18, 44, 33, 0.3)',
  },
  logoText: {
    color: '#f8f5f0',
    fontSize: '28px',
    fontWeight: 800,
    fontFamily: "Georgia, 'Times New Roman', serif",
    letterSpacing: '0.1em',
  },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#122c21',
    letterSpacing: '3px',
    textTransform: 'uppercase' as const,
    margin: '0 0 12px',
  },
  subtitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#122c21',
    margin: 0,
  },
  errorBanner: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '20px',
    textAlign: 'center' as const,
  },
  microsoftBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '16px 24px',
    borderRadius: '12px',
    border: '1.5px solid rgba(18, 44, 33, 0.15)',
    background: '#fff',
    color: '#122c21',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(18, 44, 33, 0.1)',
    transition: 'all 0.2s ease',
  },
  microsoftLogo: {
    width: '21px',
    height: '21px',
  },
  footer: {
    marginTop: '32px',
    textAlign: 'center' as const,
  },
  footerText: {
    fontSize: '13px',
    color: '#4a5568',
    margin: 0,
    lineHeight: 1.5,
  },
  bgDecoration1: {
    position: 'absolute' as const,
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.05)',
    top: '-100px',
    right: '-100px',
  },
  bgDecoration2: {
    position: 'absolute' as const,
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.05)',
    bottom: '-50px',
    left: '-50px',
  },
};

export default Login;
