import { AuthProvider, useAuth } from './auth/AuthProvider';
import Login from './pages/Login';
import MainApp from './MainApp';

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { session } = useAuth();
  return session ? <MainApp /> : <Login />;
}

export default App;