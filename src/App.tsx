import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { EditorPage } from './pages/EditorPage';

/**
 * App - Root component with routing between HomePage and EditorPage.
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/editor/:id" element={<EditorPage />} />
    </Routes>
  );
}

export default App;
