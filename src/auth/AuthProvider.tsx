import { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: useEffect running, attempting to get session...');
    supabase.auth.getSession()
      .then(async ({ data: { session: initialSession }, error }) => {
        console.log('AuthProvider: getSession resolved.');
        if (error) {
          console.error('AuthProvider: Error getting session:', error);
          setSession(null);
          setUser(null);
          setProfile(null);
        } else {
          console.log('AuthProvider: Initial session data:', initialSession);
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) {
            try {
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', initialSession.user.id)
                .single();
              console.log('AuthProvider: Profile data:', profileData);
              setProfile(profileError ? null : profileData);
            } catch (profileFetchError) {
              console.error('AuthProvider: Error fetching profile:', profileFetchError);
              setProfile(null);
            }
          } else {
            setProfile(null);
          }
        }
        setLoading(false);
        console.log('AuthProvider: Loading set to false.');
      })
      .catch(err => {
        console.error('AuthProvider: getSession promise rejected:', err);
        setLoading(false); // Ensure loading is false even if promise rejects
      });

    // Listen for future auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log('AuthProvider: Auth state changed event:', _event, 'New session:', newSession);
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newSession.user.id)
              .single();
            console.log('AuthProvider: Profile data on auth state change:', profileData);
            setProfile(profileError ? null : profileData);
          } catch (profileFetchError) {
            console.error('AuthProvider: Error fetching profile on auth state change:', profileFetchError);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      }
    );
    return () => {
      console.log('AuthProvider: Unsubscribing from auth listener.');
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('AuthProvider: Signing out...');
    await supabase.auth.signOut();
  };

  const value = {
    session,
    user,
    profile,
    signOut,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};