import { Link } from "react-router-dom";
import { t } from "../i18n/ja";

export default function AppSettingsPage() {
  const s = t();
  const items = [
    { to: "/settings/theme", label: s.appSettings.theme },
    { to: "/tools/checkout", label: s.appSettings.checkout },
    { to: "/settings/player", label: s.appSettings.player },
    { to: "/settings/equipment", label: s.appSettings.equipment },
    { to: "/settings/backup", label: s.appSettings.backup },
    { to: "/about", label: s.appSettings.about },
  ];
  return (
    <div>
      <h1>{s.appSettings.title}</h1>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="card selectable"
          style={{ display: "block", textDecoration: "none", color: "inherit" }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
