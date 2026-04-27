import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))

function App() {
  return (
    <Suspense fallback={<div className="center-screen">Loading…</div>}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
