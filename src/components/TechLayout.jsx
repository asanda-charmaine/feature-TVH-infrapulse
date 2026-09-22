import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, LogoMark } from './ui.jsx';
import { useStore, useTechnicianStore, useTechnicianSession, logoutTechnician, useSupervisorSession, logoutSupervisor } from '../lib/store.js';
import { DEMO_TECHNICIAN } from '../lib/constants.js';

const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'],
  ['map', 'GIS Map', 'map'],
  ['reports', 'Reports', 'reports'],
  ['work-orders', 'Work Orders', 'workorders'],
  ['notifications', 'Notifications', 'bell'],
];

export default function TechLayout({ supervisor = false }) {
  const technicianSession = useTechnicianSession();
  const supervisorSession = useSupervisorSession();
  const loggedIn = supervisor ? supervisorSession : technicianSession;
  const base = supervisor ? '/supervisor' : '/technician';
  const supervisorState = useStore();
  const technicianState = useTechnicianStore();
  const { notifications } = supervisor ? supervisorState : technicianState;
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!loggedIn) return <Navigate to="/" replace />;
  const unread = notifications.filter((n) => !n.read).length;

  const logout = () => {
    (supervisor ? logoutSupervisor : logoutTechnician)();
    navigate('/');
  };

  return (
    <div className="tech-shell">
      <div className={`drawer-scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label={supervisor ? 'Supervisor navigation' : 'Technician navigation'}>
        <Link to={base + '/dashboard'} className="brand">
          <LogoMark />
          InfraPulse
        </Link>
        <nav>
          {(supervisor ? [['dashboard', 'Dashboard', 'dashboard'], ['review', 'Review Tasks', 'reports'], ['validation', 'Data Validation', 'check'], ['assign', 'Assign Tasks', 'user'], ['assigned', 'Assigned Tasks', 'workorders']] : NAV).map(([path, label, icon]) => (
            <NavLink key={path} to={base + '/' + path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-ico"><Icon name={icon} /></span>
              {label}
              {path === 'notifications' && unread > 0 && <span className="count">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="bottom">
          {!supervisor && <NavLink to="/technician/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-ico"><Icon name="user" /></span>
            <span>
              Technician Profile
              <span style={{ display: 'block', fontSize: '.72rem', opacity: 0.7, fontWeight: 500 }}>{DEMO_TECHNICIAN.name}</span>
            </span>
          </NavLink>}
          {supervisor && <div className="nav-item">Supervisor</div>}
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
          <Link to={base + '/dashboard'} className="brand">InfraPulse</Link>
          <span style={{ marginLeft: 'auto', fontSize: '.8rem', opacity: 0.8 }}>{supervisor ? 'Supervisor' : 'Technician'}</span>
        </div>
        <div className="tech-page">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
