import React from 'react';

console.log("WebDAW: App.tsx loaded");

function App() {
  console.log("WebDAW: App component rendered");
  return (
    <div style={{ backgroundColor: 'blue', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <h1 style={{ color: 'white', fontSize: '48px' }}>Hello WebDAW!</h1>
    </div>
  );
}

export default App;