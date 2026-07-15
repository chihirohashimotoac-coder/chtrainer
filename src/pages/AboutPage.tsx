import { APP_NAME, APP_VERSION } from "../config/constants";
import { t } from "../i18n/ja";

export default function AboutPage() {
  const s = t();
  return (
    <div>
      <h1>{s.about.title}</h1>
      <div className="card">
        <div className="list-row">
          <span className="muted">{s.appName}</span>
          <strong>{APP_NAME}</strong>
        </div>
        <div className="list-row">
          <span className="muted">{s.about.version}</span>
          <strong>{APP_VERSION}</strong>
        </div>
      </div>
      <div className="card">
        <p>{s.about.disclaimer1}</p>
        <p>{s.about.disclaimer2}</p>
        <p>{s.about.disclaimer3}</p>
        <p>{s.about.disclaimer4}</p>
      </div>
      <div className="card">
        <h2>{s.about.license}</h2>
        <p className="muted">{s.about.licenseBody}</p>
      </div>
    </div>
  );
}
