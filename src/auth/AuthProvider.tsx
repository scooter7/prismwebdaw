import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';

export const AuthContext = createContext<{
  session: Session | null;
  user: User | null;
  profile: any | null;
  signOut: () => void;
}>({ session: null, user: null, profile: null, signOut: () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: useEffect triggered");
    const fetchSessionAndProfile = async () => {
      try {
        console.log("AuthProvider: Attempting to fetch session...");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const currentSession = data.session;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        console.log("AuthProvider: Session fetched. User:", currentSession?.user);

        if (currentSession?.user) {
          console.log("AuthProvider: Fetching profile for user:", currentSession.user.id);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();
          if (profileError) throw profileError;
          setProfile(profileData);
          console.log("AuthProvider: Profile fetched:", profileData);
        } else {
          console.log("AuthProvider: No user in session, profile set to null.");
          setProfile(null);
        }
      } catch (error) {
        console.error("AuthProvider: Error fetching session or profile:", error);
      } finally {
        console.log("AuthProvider: Setting loading to false.");
        setLoading(false);
      }
    };

    fetchSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log("AuthProvider: Auth state changed. Event:", _event, "New Session:", newSession);
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          console.log("AuthProvider: Auth state changed, fetching profile for user:", newSession.user.id);
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
        } else {
          console.log("AuthProvider: Auth state changed, no user, profile set to null.");
          setProfile(null);
        }
        // Ensure loading is false when auth state changes, e.g., on sign-in/sign-out
        console.log("AuthProvider: Setting loading to false after auth state change.");
        setLoading(false);
      }
    );

    return () => {
      console.log("AuthProvider: Unsubscribing from auth listener.");
      authListener?.subscription.unsubscribe();
    };
  }, []);

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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};