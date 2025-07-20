import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';

const Login = () => {
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
          providers={['github']}
          theme="dark"
          socialLayout="horizontal"
        />
      </div>
    </div>
  );
};

export default Login;