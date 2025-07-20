import React from 'react';
import ReactDOM from 'react-dom/client';

import MainApp from './MainApp'; // Import the main application component
import reportWebVitals from './reportWebVitals';

import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>,
);

reportWebVitals();