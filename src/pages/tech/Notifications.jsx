import { Link, useNavigate } from 'react-router-dom';
import { PageHead } from '../../components/tech.jsx';
import { Empty, Icon } from '../../components/ui.jsx';
import { markAllNotificationsRead, markNotificationRead, useTechnicianStore } from '../../lib/store.js';
import { fmtDateTime } from '../../lib/format.js';

const ICON = { critical: 'alert', report: 'reports', workorder: 'workorders', evidence: 'camera', vehicle: 'truck' };

export default function Notifications() {
  const { notifications } = useTechnicianStore();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <PageHead title="Notifications" sub={unread ? `${unread} unread` : 'You are all caught up.'}>
        <button className="btn btn-secondary btn-sm" onClick={markAllNotificationsRead} disabled={!unread}>Mark all as read</button>
      </PageHead>
      <div className="card flush">
        {notifications.length === 0 ? (
          <Empty icon="bell" title="No notifications" />
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              className="issue"
              style={{ width: '100%', textAlign: 'left', background: n.read ? 'transparent' : 'var(--teal-50)', border: 0, borderBottom: '1px solid var(--line)', padding: '14px 20px', cursor: 'pointer' }}
              onClick={() => { markNotificationRead(n.id); if (n.link) navigate(n.link); }}
            >
              <span style={{ display: 'flex', color: 'var(--teal-600)' }}><Icon name={ICON[n.type] || 'bell'} size={24} /></span>
              <div className="meta">
                <div className="ref">{n.title}{!n.read && <span className="badge b-Submitted" style={{ marginLeft: 8 }}>New</span>}</div>
                <div>{n.body}</div>
                <div className="muted small">{fmtDateTime(n.at)}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}
