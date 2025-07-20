import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App'; // Import the main application component (now renamed to App.tsx)
import reportWebVitals from './reportWebVitals';

import './index.css'; // Your custom CSS
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/select/lib/css/blueprint-select.css';
// Removed: import '@blueprintjs/table/lib/table.css';
import { AuthProvider } from './auth/AuthProvider'; // Import AuthProvider

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <AuthProvider> {/* Wrap the App with AuthProvider */}
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

reportWebVitals();