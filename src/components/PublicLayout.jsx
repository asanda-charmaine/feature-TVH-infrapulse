import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogoMark } from './ui.jsx';
import { loginTechnician } from '../lib/store.js';

export function TechnicianLoginButton({ className = 'tech', children = 'Technician Login' }) {
  const navigate = useNavigate();
  // Demo shortcut: no credentials are collected. One click signs in as the demo technician.
  const go = (e) => {
    e.preventDefault();
    loginTechnician();
    navigate('/technician/dashboard');
  };
  return (
    <a href="/technician/dashboard" className={className} onClick={go} role="button">
      {children}
    </a>
  );
}

export default function PublicLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="public-header">
        <div className="inner">
          <Link to="/" className="brand" aria-label="InfraPulse home">
            <LogoMark />
            InfraPulse
          </Link>
          <nav className="public-nav" aria-label="Main">
            <NavLink to="/" end className={({ isActive }) => `link ${isActive ? 'active' : ''}`}>Home</NavLink>
            <NavLink to="/report" className={({ isActive }) => `link ${isActive ? 'active' : ''}`}>Log Report</NavLink>
            <NavLink to="/history" className={({ isActive }) => `link ${isActive ? 'active' : ''}`}>Report History</NavLink>
            <TechnicianLoginButton />
          </nav>
        </div>
      </header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="inner">
          <span><strong>InfraPulse</strong> · Improving infrastructure, improving lives</span>
        </div>
      </footer>
    </div>
  );
}
