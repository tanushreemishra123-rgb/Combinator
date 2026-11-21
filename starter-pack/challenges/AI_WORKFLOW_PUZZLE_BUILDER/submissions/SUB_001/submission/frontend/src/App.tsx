import { Navigate, Route, Routes } from 'react-router-dom'
import Builder from './pages/Builder'
import PuzzleSelect from './pages/PuzzleSelect'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PuzzleSelect />} />
      <Route path="/puzzle/:id" element={<Builder />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
