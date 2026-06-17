import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import InsuranceApp from './insurance/InsuranceApp.jsx';
import './index.css';

// Route to insurance app at /insurance, everything else goes to CDO
const isInsurance = window.location.pathname.startsWith('/insurance');

// Insurance app runs WITHOUT StrictMode — Daily.js createCallObject
// does not tolerate the double-mount that StrictMode causes in dev.
ReactDOM.createRoot(document.getElementById('root')).render(
  isInsurance
    ? <InsuranceApp />
    : <React.StrictMode><App /></React.StrictMode>
);
