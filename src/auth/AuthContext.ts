import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

export const AuthContext = createContext<{
  session: Session | null;
  user: User | null;
  profile: any | null;
  signOut: () => void;
  loading: boolean; // Added loading property
}>({ session: null, user: null, profile: null, signOut: () => {}, loading: true });

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};