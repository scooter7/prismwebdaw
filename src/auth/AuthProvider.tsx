import { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null); // Keep profile state, but don't update it
  const [loading, setLoading] = useState(true); // Start as true

  useEffect(() => {
    console.log('AuthProvider: useEffect mounted, setting up auth listener.');

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log(`AuthProvider: Auth state changed event: ${_event}, newSession:`, newSession);
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Temporarily skipping profile fetch to isolate loading issue
        // if (newSession?.user) {
        //   try {
        //     const { data: profileData, error: profileError } = await supabase
        //       .from('profiles')
        //       .select('*')
        //       .eq('id', newSession.user.id)
        //       .maybeSingle();
        //     if (profileError && profileError.code !== 'PGRST116') {
        //       console.error('AuthProvider: Error fetching profile:', profileError);
        //     } else {
        //       setProfile(profileData);
        //     }
        //   } catch (profileFetchError) {
        //     console.error('AuthProvider: Error fetching profile (catch block):', profileFetchError);
        //   }
        // } else {
        //   setProfile(null);
        // }

        // Crucially, set loading to false directly after session/user update
        setLoading(false);
        console.log('AuthProvider: Loading set to false.');
      }
    );

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
    profile, // Profile will remain null or its initial value with this change
    signOut,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};