import React from 'react';
import ReactDOM from 'react-dom/client';

import MainApp from './MainApp'; // Import the main application component
import reportWebVitals from './reportWebVitals';

import './index.css'; // Your custom CSS
import '@blueprintjs/core/lib/css/blueprint.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/select/lib/css/blueprint-select.css';
// Removed: import '@blueprintjs/table/lib/table.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>,
);

reportWebVitals();