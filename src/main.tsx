import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/auth-context'
import App from './App'
import './styles/app.css'

// No StrictMode: its dev-only double-mount destroys the bpmn-js modeler
// while the initial XML import is still in flight.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
)