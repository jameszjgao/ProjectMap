import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

try {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    )
} catch (error) {
    console.error('Render error:', error);
    document.getElementById('root')!.innerHTML = '<div style="color:red; padding: 20px;"><h1>Failed to render app</h1><pre>' + error + '</pre></div>';
}
