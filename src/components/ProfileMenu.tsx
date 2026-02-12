import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) return null;

  return (
    <div ref={menuRef} style={styles.container}>
      {/* Profile Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.profileBtn}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.name} style={styles.avatar} />
        ) : (
          <div style={styles.avatarPlaceholder}>
            {getInitials(user.name)}
          </div>
        )}
        <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            style={styles.dropdown}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {/* User Info */}
            <div style={styles.userInfo}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} style={styles.dropdownAvatar} />
              ) : (
                <div style={styles.dropdownAvatarPlaceholder}>
                  {getInitials(user.name)}
                </div>
              )}
              <div style={styles.userDetails}>
                <span style={styles.userName}>{user.name}</span>
                <span style={styles.userEmail}>{user.email}</span>
                <span style={styles.userRole}>{user.role}</span>
              </div>
            </div>

            <div style={styles.divider} />

            {/* Menu Items */}
            <Link to="/settings" style={styles.menuItem} onClick={() => setIsOpen(false)}>
              <span style={styles.menuIcon}>⚙️</span>
              <span>Settings</span>
            </Link>
            <Link to="/settings" style={styles.menuItem} onClick={() => setIsOpen(false)}>
              <span style={styles.menuIcon}>👤</span>
              <span>Edit Profile</span>
            </Link>
            <Link to="/performance" style={styles.menuItem} onClick={() => setIsOpen(false)}>
              <span style={styles.menuIcon}>📊</span>
              <span>My Performance</span>
            </Link>

            <div style={styles.divider} />

            <button onClick={handleLogout} style={styles.logoutBtn}>
              <span style={styles.menuIcon}>🚪</span>
              <span>Sign Out</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },
  profileBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '2px solid rgba(248, 245, 240, 0.3)',
    borderRadius: '50px',
    padding: '4px 12px 4px 4px',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
  },
  avatarPlaceholder: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
  },
  chevron: {
    fontSize: '10px',
    color: 'rgba(248, 245, 240, 0.75)',
  },
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    marginTop: '8px',
    width: '280px',
    background: 'rgba(246, 243, 239, 0.97)',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(18, 44, 33, 0.25)',
    overflow: 'hidden',
    zIndex: 1000,
  },
  userInfo: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    background: 'linear-gradient(135deg, #122c21 0%, #1a4d3a 100%)',
  },
  dropdownAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    objectFit: 'cover' as const,
  },
  dropdownAvatarPlaceholder: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    gap: '2px',
  },
  userName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f8f5f0',
  },
  userEmail: {
    fontSize: '12px',
    color: 'rgba(248, 245, 240, 0.75)',
  },
  userRole: {
    fontSize: '11px',
    color: '#48bb78',
    textTransform: 'capitalize' as const,
    fontWeight: 500,
  },
  divider: {
    height: '1px',
    background: 'rgba(18, 44, 33, 0.15)',
    margin: '0',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#122c21',
    textDecoration: 'none',
    transition: 'background 0.15s',
    cursor: 'pointer',
  },
  menuIcon: {
    fontSize: '16px',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#dc2626',
    background: 'transparent',
    border: 'none',
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
};

export default ProfileMenu;
