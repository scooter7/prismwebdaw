import { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true); // Initial state is true

  useEffect(() => {
    console.log("AuthProvider: useEffect triggered");

    // This listener fires immediately on mount with the current session status.
    // It will also fire on subsequent auth state changes (sign-in, sign-out, etc.).
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log("AuthProvider: Auth state changed. Event:", _event, "New Session:", newSession);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          console.log("AuthProvider: Auth state changed, fetching user profile...");
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newSession.user.id)
              .single();
            
            if (profileError) {
              console.error("AuthProvider: Error fetching profile on auth state change:", profileError);
              setProfile(null);
            } else {
              setProfile(profileData);
              console.log("AuthProvider: Profile fetched on auth state change:", profileData);
            }
          } catch (profileFetchError) {
            console.error("AuthProvider: Unexpected error during profile fetch:", profileFetchError);
            setProfile(null);
          }
        } else {
          console.log("AuthProvider: Auth state changed, no user, profile set to null.");
          setProfile(null);
        }
        
        // Crucial: Set loading to false only after the initial session determination.
        // This ensures the app renders once the auth state is known.
        if (loading) { 
            console.log("AuthProvider: Setting loading to false after initial auth state determination.");
            setLoading(false);
        }
      }
    );

    // Cleanup function for the effect.
    return () => {
      console.log("AuthProvider: Unsubscribing from auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, [loading]); // Added 'loading' to dependency array to ensure the 'if (loading)' check works as intended on re-runs.

  const signOut = async () => {
    console.log("AuthProvider: Signing out...");
    await supabase.auth.signOut();
    console.log("AuthProvider: Signed out.");
  };

  const value = {
    session,
    user,
    profile,
    signOut,
  };

  console.log("AuthProvider: Rendering children. Loading state:", loading);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};