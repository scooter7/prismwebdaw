import { Session, User } from '@supabase/supabase-js';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true); // Initial state is true

  // Use a ref to track if the initial load has completed
  const initialLoadCompleted = useRef(false);

  useEffect(() => {
    console.log("AuthProvider: useEffect triggered.");

    // Function to fetch user profile
    const fetchProfile = async (userId: string) => {
      try {
        console.log("AuthProvider: Fetching user profile for ID:", userId);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);
        console.log("AuthProvider: Profile fetched:", profileData);
      } catch (profileFetchError) {
        console.error("AuthProvider: Error fetching profile:", profileFetchError);
        setProfile(null);
      }
    };

    // --- Initial Load Logic ---
    // This part runs only once on mount (or twice in Strict Mode, but the ref helps)
    if (!initialLoadCompleted.current) {
      console.log("AuthProvider: Performing initial session check.");
      supabase.auth.getSession().then(async ({ data: { session: initialSession }, error: sessionError }) => {
        if (sessionError) {
          console.error("AuthProvider: Error during initial getSession:", sessionError);
          setSession(null);
          setUser(null);
          setProfile(null);
        } else {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) {
            await fetchProfile(initialSession.user.id);
          } else {
            setProfile(null);
          }
        }
        console.log("AuthProvider: Initial session check complete, setting loading to false.");
        setLoading(false);
        initialLoadCompleted.current = true; // Mark initial load as complete
      }).catch(error => {
        console.error("AuthProvider: Unhandled error in initial getSession promise:", error);
        setLoading(false); // Ensure loading is false even on unhandled errors
        initialLoadCompleted.current = true;
      });
    }

    // --- Auth State Change Listener ---
    // This listener handles all subsequent auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log("AuthProvider: Auth state changed. Event:", _event, "New Session:", newSession);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
        // Do NOT set loading=false here, as it's handled by the initial load logic.
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