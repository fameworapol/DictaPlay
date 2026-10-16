import { NavLink, Outlet } from 'react-router-dom'
import { useStorageAvailability } from '../hooks/useStorageAvailability'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100'
  }`

export function Layout() {
  const storage = useStorageAvailability()

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3" aria-label="Main">
          <NavLink to="/" className="text-lg font-bold text-slate-900">
            English Dictation
          </NavLink>
          <div className="flex flex-wrap gap-1">
            <NavLink to="/" className={navLinkClass} end>
              Home
            </NavLink>
            <NavLink to="/library" className={navLinkClass}>
              Library
            </NavLink>
            <NavLink to="/manage" className={navLinkClass}>
              My Content
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              Settings
            </NavLink>
          </div>
        </nav>
        {storage === 'unavailable' && (
          <div
            role="status"
            className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"
          >
            Your browser's storage isn't available, so progress and custom lessons won't be saved
            this session. You can still practice.
          </div>
        )}
      </header>
      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
