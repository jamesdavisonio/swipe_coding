import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './auth.tsx'
import Deck from './pages/Deck.tsx'
import NewTask from './pages/NewTask.tsx'
import Project from './pages/Project.tsx'
import Projects from './pages/Projects.tsx'
import Thread from './pages/Thread.tsx'
import Threads from './pages/Threads.tsx'

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Deck />} />
          <Route path="/threads" element={<Threads />} />
          <Route path="/t/:taskId" element={<Thread />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/p/:projectId" element={<Project />} />
          <Route path="/new" element={<NewTask />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthGate>
  )
}
