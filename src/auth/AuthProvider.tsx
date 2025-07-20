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
    console.log("AuthProvider: useEffect triggered for initial load.");

    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          console.log("AuthProvider: Fetching initial user profile...");
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', initialSession.user.id)
            .single();
          if (profileError) throw profileError;
          setProfile(profileData);
          console.log("AuthProvider: Initial profile fetched:", profileData);
        } else {
          console.log("AuthProvider: No initial user, profile set to null.");
          setProfile(null);
        }
      } catch (error) {
        console.error("AuthProvider: Error during initial session/profile fetch:", error);
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        console.log("AuthProvider: Initial load complete, setting loading to false.");
        setLoading(false); // Set loading to false after initial check
      }
    };

    getInitialSession(); // Call immediately on mount

    // Set up the listener for subsequent auth state changes
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
        // No need to set loading here, as it's already handled by getInitialSession
        // This listener is for *changes* after the initial load.
      }
    );

    // Cleanup function for the effect.
    return () => {
      console.log("AuthProvider: Unsubscribing from auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount

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