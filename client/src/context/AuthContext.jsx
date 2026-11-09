import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('osman-user') || 'null'); } catch { return null; } });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('osman-token')));
  useEffect(() => { if (!localStorage.getItem('osman-token')) return; api.get('/auth/me').then(({ data }) => setUser(data.data)).catch(() => { localStorage.removeItem('osman-token'); localStorage.removeItem('osman-user'); setUser(null); }).finally(() => setLoading(false)); }, []);
  const save = ({ user: nextUser, token }) => { localStorage.setItem('osman-token', token); localStorage.setItem('osman-user', JSON.stringify(nextUser)); setUser(nextUser); };
  const logout = () => { localStorage.removeItem('osman-token'); localStorage.removeItem('osman-user'); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, save, logout, setUser }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
