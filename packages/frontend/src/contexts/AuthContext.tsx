import React, { createContext, useContext, useState, useEffect } from 'react';
import config from '@/config/config';

interface User {
  name: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  checkSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  isLoading: true,
  checkSession: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const apiBase = ((import.meta as any).env.VITE_API_BASE_URL || config.api.baseUrl).replace(/\/$/, '');

  const checkSession = async () => {
    try {
      const response = await fetch(`${apiBase}/api/auth/session`, {
        credentials: 'include'
      });
      const data = await response.json();

      if (data.authenticated && data.user) {
        setIsAuthenticated(true);
        setUser({
          name: data.user.email.split('@')[0], // Use email prefix as name
          email: data.user.email
        });
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${apiBase}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, checkSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
