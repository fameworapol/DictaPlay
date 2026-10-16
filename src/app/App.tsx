import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { LessonDataProvider } from '../features/lessons/LessonDataProvider'
import { HomePage } from '../pages/HomePage'
import { LibraryPage } from '../pages/LibraryPage'
import { PracticePage } from '../pages/PracticePage'
import { SummaryPage } from '../pages/SummaryPage'

export default function App() {
  return (
    <BrowserRouter>
      <LessonDataProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="practice/:lessonId" element={<PracticePage />} />
            <Route path="summary" element={<SummaryPage />} />
          </Route>
        </Routes>
      </LessonDataProvider>
    </BrowserRouter>
  )
}
