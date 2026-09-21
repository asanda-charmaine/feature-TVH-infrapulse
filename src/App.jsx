import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastHost } from './components/ui.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import TechLayout from './components/TechLayout.jsx';
import SupervisorDashboard from './pages/supervisor/Dashboard.jsx';

import Home from './pages/public/Home.jsx';
import LogReport from './pages/public/LogReport.jsx';
import ReportSuccess from './pages/public/ReportSuccess.jsx';
import History from './pages/public/History.jsx';
import CitizenReportDetail from './pages/public/ReportDetail.jsx';

import Dashboard from './pages/tech/Dashboard.jsx';
import AssetRegistry from './pages/tech/AssetRegistry.jsx';
import AssetDetail from './pages/tech/AssetDetail.jsx';
import GisMap from './pages/tech/GisMap.jsx';
import Reports from './pages/tech/Reports.jsx';
import TechReportDetail from './pages/tech/ReportDetail.jsx';
import WorkOrders from './pages/tech/WorkOrders.jsx';
import WorkOrderDetail from './pages/tech/WorkOrderDetail.jsx';
import Analytics from './pages/tech/Analytics.jsx';
import Notifications from './pages/tech/Notifications.jsx';
import Profile from './pages/tech/Profile.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Citizen side: Home, Log Report, Report History */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<LogReport />} />
          <Route path="/report/submitted/:id" element={<ReportSuccess />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<CitizenReportDetail />} />
        </Route>

        {/* Technician side (demo login: no credentials) */}
        <Route path="/technician" element={<TechLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="assets" element={<AssetRegistry />} />
          <Route path="assets/:id" element={<AssetDetail />} />
          <Route path="map" element={<GisMap />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/:id" element={<TechReportDetail />} />
          <Route path="work-orders" element={<WorkOrders />} />
          <Route path="work-orders/:id" element={<WorkOrderDetail />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/supervisor" element={<TechLayout supervisor />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SupervisorDashboard key="dashboard" />} />
          <Route path="review" element={<SupervisorDashboard key="review" view="review" />} />
          <Route path="assign" element={<SupervisorDashboard key="assign" view="assign" />} />
          <Route path="assigned" element={<SupervisorDashboard key="assigned" view="assigned" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </>
  );
}
