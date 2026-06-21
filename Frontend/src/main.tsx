import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ClerkProvider } from '@clerk/clerk-react'
import { SettingsProvider } from './contexts/SettingsContext.tsx'
import { ModalProvider } from './components/Modal.tsx'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ModalProvider>
        {CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider 
            publishableKey={CLERK_PUBLISHABLE_KEY}
            localization={{
              formButtonPrimary: "NEXT",
            }}
          >
            <App />
          </ClerkProvider>
        ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#ef4444', marginBottom: '16px' }}>Configuration Error</h1>
          <p style={{ maxWidth: '500px', lineHeight: '1.6', color: '#94a3b8' }}>
            Please set the <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> environment variable in your Frontend <code>.env</code> file.
          </p>
        </div>
      )}
      </ModalProvider>
    </SettingsProvider>
  </StrictMode>,
)

