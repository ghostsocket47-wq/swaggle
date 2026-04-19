import { Link } from 'react-router-dom';

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 bg-canvas/80 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-canvas text-blue-500 font-display text-sm font-bold border border-border">
            S
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-ink">
            Swaggle
          </span>
        </Link>
        <span className="px-3 py-1.5 rounded text-sm font-medium bg-blue-500 text-canvas">
          History Bee
        </span>
      </div>
    </header>
  );
}
