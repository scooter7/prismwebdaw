import React from 'react';
import { useAuth } from './auth/AuthContext';
import MainApp from './MainApp';
import Login from './pages/Login';

function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <p>Loading authentication...</p>
      </div>
    );
  }

  return session ? <MainApp /> : <Login />;
}

export default App;