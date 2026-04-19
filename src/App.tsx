import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav';
import HistoryLeaderboard from './pages/HistoryLeaderboard';
import PlayerPage from './pages/Player';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <Nav />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 pb-16">
        <Routes>
          <Route path="/" element={<Navigate to="/history" replace />} />
          <Route path="/history" element={<HistoryLeaderboard />} />
          <Route path="/player/:id" element={<PlayerPage />} />
          <Route path="*" element={<Navigate to="/history" replace />} />
        </Routes>
      </main>
    </div>
  );
}
