import { Activity, BarChart3, FileCheck2, LayoutDashboard, ScanEye, Settings2 } from "lucide-react";
import { NavLink } from "react-router-dom";

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transactions", icon: Activity },
  { to: "/predict", label: "Fraud prediction", icon: FileCheck2 },
  { to: "/model", label: "Model intelligence", icon: BarChart3 },
  { to: "/about", label: "Settings & about", icon: Settings2 },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <NavLink className="brand-lockup" to="/" aria-label="VigiLens overview">
        <span className="brand-mark"><ScanEye size={22} strokeWidth={1.9} /></span>
        <span className="brand-copy">
          <strong>VigiLens</strong>
          <small>Risk analytics</small>
        </span>
      </NavLink>

      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-note">
        <span className="sidebar-note__dot" />
        <div>
          <strong>Local demo</strong>
          <span>Model-backed predictions</span>
        </div>
      </div>
      <div className="sidebar-footer">VigiLens · Phase 3</div>
    </aside>
  );
}
