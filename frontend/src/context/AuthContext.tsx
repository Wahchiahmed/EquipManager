import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

// Matches the role_nom values returned by Laravel and used in App.tsx
export type RoleNom =
  | 'ADMIN'
  | 'EMPLOYEE'
  | 'RESPONSABLE_DEPARTEMENT'
  | 'RESPONSABLE_STOCK';

export interface CurrentUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  role_id: number;
  role_nom: RoleNom;
  departement_id: number | null;
  departement: string | null;
  is_active: boolean;
}

interface AuthContextType {
  currentUser: CurrentUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [token, setToken]             = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading]         = useState(true);

  // On mount: if we have a stored token, verify it and restore the user session
  useEffect(() => {
    if (token) {
      api.get('/me')
        .then(res => setCurrentUser(res.data))
        .catch(() => {
          // Token is invalid or expired — clear everything
          localStorage.removeItem('token');
          setToken(null);
          setCurrentUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // run once on mount only

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await api.post('/login', { email, password });
      const { token: newToken, user } = res.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setCurrentUser(user);
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    try {
      await api.post('/logout');
    } catch {
      // Ignore errors on logout (e.g. token already expired)
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setCurrentUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);