import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui.jsx';

export default function Home() {
  return (
    <div className="page">
      <section className="hero">
        <h1>InfraPulse</h1>
        <div className="tagline">Improving infrastructure, improving lives</div>
        <p className="desc">
          Report municipal infrastructure problems quickly and help InfraPulse identify, track and prioritise maintenance issues across the city.
        </p>
        <div className="btn-row">
          <Link to="/report" className="btn btn-primary btn-lg">
            <Icon name="camera" size={20} /> Log Report
          </Link>
          <Link to="/history" className="btn btn-secondary btn-lg">
            Report History
          </Link>
        </div>
      </section>

      <section className="how" aria-label="How it works">
        <div className="card">
          <div className="num">1</div>
          <h3>Choose what is wrong</h3>
          <p className="muted">Pick a pothole, traffic light or street light problem and add a photograph.</p>
        </div>
        <div className="card">
          <div className="num">2</div>
          <h3>We verify the photo</h3>
          <p className="muted">InfraPulse checks that the photo matches the problem you selected, then you pin the location.</p>
        </div>
        <div className="card">
          <div className="num">3</div>
          <h3>Track your report</h3>
          <p className="muted">Get a reference number and follow progress from Submitted through to Resolved. No account needed.</p>
        </div>
      </section>
    </div>
  );
}
