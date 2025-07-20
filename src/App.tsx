console.log("WebDAW: App.tsx loaded");

import { AuthProvider, useAuth } from './auth/AuthProvider';
import Login from './pages/Login';
import MainApp from './MainApp';

function App() {
  console.log("WebDAW: App component rendered");
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { session } = useAuth();
  console.log("WebDAW: AppContent rendered, session:", session);
  return session ? <MainApp /> : <Login />;
}

export default App;