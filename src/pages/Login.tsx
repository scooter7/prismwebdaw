import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../auth/AuthProvider';

const Login = () => {
  const { session, signOut } = useAuth();

  return (
    <div className="flex justify-center items-center h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-8 bg-muted rounded-lg shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-foreground">
            Sign in to WebDAW
          </h2>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]}
          theme="dark"
          magicLink={false} {/* Changed to false to enable email/password login */}
        />
        {session && (
          <div className="mt-4 text-center">
            <button
              onClick={signOut}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;