import { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true); // Start as true

  useEffect(() => {
    console.log('AuthProvider: useEffect running, setting up auth listener...');

    // This listener fires immediately upon subscription with the current session,
    // and then again whenever the auth state changes.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        try {
          console.log('AuthProvider: Auth state changed event:', _event, 'New session:', newSession);
          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (newSession?.user) {
            try {
              // Use .maybeSingle() to handle cases where no profile exists yet
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newSession.user.id)
                .maybeSingle(); // Changed to maybeSingle()
              
              if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "No rows found"
                console.error('AuthProvider: Error fetching profile on auth state change:', profileError);
                setProfile(null);
              } else {
                console.log('AuthProvider: Profile data on auth state change:', profileData);
                setProfile(profileData); // profileData will be null if no row found
              }
            } catch (profileFetchError) {
              console.error('AuthProvider: Error fetching profile on auth state change (catch block):', profileFetchError);
              setProfile(null);
            }
          } else {
            setProfile(null);
          }
        } finally {
          // Crucially, set loading to false AFTER processing the state change,
          // ensuring it runs even if profile fetching fails.
          setLoading(false);
          console.log('AuthProvider: Loading set to false after state change.');
        }
      }
    );

    // Cleanup function for the effect
    return () => {
      console.log('AuthProvider: Unsubscribing from auth listener.');
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty dependency array means this effect runs once on mount

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