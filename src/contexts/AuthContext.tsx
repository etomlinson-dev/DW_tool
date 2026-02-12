import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Check for OAuth callback on mount
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const authStatus = searchParams.get('auth');
      const userParam = searchParams.get('user');
      
      if (authStatus === 'success' && userParam) {
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          setUser(userData);
          localStorage.setItem('dw_user', JSON.stringify(userData));
          
          // Clean up URL params
          searchParams.delete('auth');
          searchParams.delete('user');
          setSearchParams(searchParams);
          
          setIsLoading(false);
          return;
        } catch (e) {
          console.error('Failed to parse user data from OAuth callback:', e);
        }
      }
      
      // Check for existing session
      await checkExistingSession();
    };
    
    handleOAuthCallback();
  }, []);

  const checkExistingSession = async () => {
    // First check localStorage
    const savedUser = localStorage.getItem('dw_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        
        // Verify session is still valid with backend
        try {
          const response = await fetch('/api/auth/microsoft/status');
          if (response.ok) {
            const data = await response.json();
            if (data.authenticated && data.user) {
              // Update user data from backend
              setUser(data.user);
              localStorage.setItem('dw_user', JSON.stringify(data.user));
            } else if (!data.authenticated) {
              // Session expired, clear local storage
              localStorage.removeItem('dw_user');
              setUser(null);
            }
          }
        } catch {
          // Backend not available, keep using localStorage data
        }
        
        setIsLoading(false);
        return;
      } catch {
        localStorage.removeItem('dw_user');
      }
    }
    
    // Check Microsoft status endpoint for SSO session
    try {
      const response = await fetch('/api/auth/microsoft/status');
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          localStorage.setItem('dw_user', JSON.stringify(data.user));
        }
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    }
    
    setIsLoading(false);
  };

  const checkAuth = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/microsoft/status');
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          localStorage.setItem('dw_user', JSON.stringify(data.user));
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('dw_user');
    
    // Call logout endpoint
    try {
      await fetch('/api/auth/microsoft/logout', { method: 'POST' });
    } catch {
      // Ignore errors
    }
    
    // Redirect to login
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Wrapper component that provides Router context
export function AuthProviderWithRouter({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
