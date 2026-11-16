import { Activity, BarChart3, FileCheck2, LayoutDashboard, ScanEye, Settings2 } from "lucide-react";
import { TransitionLink, TransitionNavLink } from "./TransitionLink";

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transactions", icon: Activity },
  { to: "/predict", label: "Prediction", icon: FileCheck2 },
  { to: "/model", label: "Model", icon: BarChart3 },
  { to: "/about", label: "About", icon: Settings2 },
];

export function TopNavigation() {
  return (
    <header className="site-nav" style={{ viewTransitionName: "persistent-nav" }}>
      <TransitionLink className="brand-lockup" to="/" aria-label="VigiLens overview">
        <span className="brand-mark"><ScanEye size={21} strokeWidth={1.9} /></span>
        <span className="brand-copy">
          <strong>VigiLens</strong>
          <small>Intelligent risk analytics</small>
        </span>
      </TransitionLink>

      <nav className="site-nav__links" aria-label="Main navigation">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <TransitionNavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}
          >
            <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </TransitionNavLink>
        ))}
      </nav>

      <TransitionLink className="nav-action" to="/predict">
        <span>Analyze data</span>
        <span className="nav-action__arrow" aria-hidden="true">↗</span>
      </TransitionLink>
    </header>
  );
}
