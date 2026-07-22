import { APP_NAME, APP_VERSION } from "../config/constants";
import { VERSION_HISTORY } from "../config/versionHistory";
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
        <h2>{s.about.versionHistory}</h2>
        {VERSION_HISTORY.map((entry) => (
          <div className="list-row" key={entry.version} style={{ alignItems: "flex-start" }}>
            <span style={{ whiteSpace: "nowrap" }}>
              <strong>v{entry.version}</strong>
              <span className="muted small"> ({entry.date})</span>
            </span>
            <span
              className="small"
              style={{
                textAlign: "left",
                flex: 1,
                minWidth: 0,
                marginLeft: "0.8rem",
                overflowWrap: "anywhere",
              }}
            >
              {entry.summary}
            </span>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>{s.about.license}</h2>
        <p className="muted">{s.about.licenseBody}</p>
      </div>
      <p className="muted" style={{ textAlign: "center", margin: "1.2rem 0 0.5rem" }}>
        {s.about.copyright}
      </p>
    </div>
  );
}
