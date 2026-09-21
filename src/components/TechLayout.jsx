import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, LogoMark } from './ui.jsx';
import { useStore, useTechnicianSession, logoutTechnician } from '../lib/store.js';
import { DEMO_TECHNICIAN } from '../lib/constants.js';

const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'],
  ['assets', 'Asset Registry', 'assets'],
  ['map', 'GIS Map', 'map'],
  ['reports', 'Reports', 'reports'],
  ['work-orders', 'Work Orders', 'workorders'],
  ['analytics', 'Data & Analytics', 'analytics'],
  ['notifications', 'Notifications', 'bell'],
];

export default function TechLayout() {
  const loggedIn = useTechnicianSession();
  const { notifications } = useStore();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!loggedIn) return <Navigate to="/" replace />;
  const unread = notifications.filter((n) => !n.read).length;

  const logout = () => {
    logoutTechnician();
    navigate('/');
  };

  return (
    <div className="tech-shell">
      <div className={`drawer-scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Technician navigation">
        <Link to="/technician/dashboard" className="brand">
          <LogoMark />
          InfraPulse
        </Link>
        <nav>
          {NAV.map(([path, label, icon]) => (
            <NavLink key={path} to={`/technician/${path}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-ico"><Icon name={icon} /></span>
              {label}
              {path === 'notifications' && unread > 0 && <span className="count">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="bottom">
          <NavLink to="/technician/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-ico"><Icon name="user" /></span>
            <span>
              Technician Profile
              <span style={{ display: 'block', fontSize: '.72rem', opacity: 0.7, fontWeight: 500 }}>{DEMO_TECHNICIAN.name}</span>
            </span>
          </NavLink>
          <button type="button" className="nav-item" onClick={logout}>
            <span className="nav-ico"><Icon name="logout" /></span>
            Logout
          </button>
        </div>
      </aside>

      <div className="tech-main">
        <div className="tech-topbar">
          <button type="button" className="hamburger" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Icon name="menu" size={22} />
          </button>
          <Link to="/technician/dashboard" className="brand">InfraPulse</Link>
          <span style={{ marginLeft: 'auto', fontSize: '.8rem', opacity: 0.8 }}>Technician</span>
        </div>
        <div className="tech-page">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
