import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './auth.tsx'
import Home from './pages/Home.tsx'
import Threads from './pages/Threads.tsx'
import Board from './pages/Board.tsx'
import TaskPage from './pages/Task.tsx'

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Threads />} />
          {/* The Phase 1 project list, until the Projects screen (B5) replaces it. */}
          <Route path="/projects" element={<Home />} />
          <Route path="/p/:projectId" element={<Board />} />
          <Route path="/t/:taskId" element={<TaskPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthGate>
  )
}
