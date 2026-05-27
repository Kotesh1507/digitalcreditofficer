import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import InsuranceApp from './insurance/InsuranceApp.jsx';
import './index.css';

// Route /insurance* to the Insurance Underwriting Officer app
// All other paths go to the existing Digital Credit Officer app
const isInsurance = window.location.pathname.startsWith('/insurance');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isInsurance ? <InsuranceApp /> : <App />}
  </React.StrictMode>
);
