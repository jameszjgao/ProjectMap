import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Strict Mode 关闭：React Flow 在双挂载下会触发 removeChild 报错，进入 Mind map 模块即崩溃
try {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <App />,
    )
} catch (error) {
    console.error('Render error:', error);
    document.getElementById('root')!.innerHTML = '<div style="color:red; padding: 20px;"><h1>Failed to render app</h1><pre>' + error + '</pre></div>';
}
