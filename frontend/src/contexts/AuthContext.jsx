import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);
const USER_KEY = 'farm2homez_user';

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setBooting(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      async login(credentials) {
        const nextUser = {
          username: credentials.username.trim(),
          role: credentials.role,
          email: credentials.email || '',
        };
        localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        setUser(nextUser);
      },
      logout() {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setUser(null);
      },
    }),
    [user, booting],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
