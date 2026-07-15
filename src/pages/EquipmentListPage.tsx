import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { t } from "../i18n/ja";

export default function EquipmentListPage() {
  const s = t();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { equipmentProfiles, loading } = useApp();
  const isFirstSetup = params.get("first") === "1";

  if (loading) return <p>{s.common.loading}</p>;

  return (
    <div>
      <div className="top-bar">
        <h1>{s.equipment.listTitle}</h1>
      </div>
      {isFirstSetup && (
        <div className="info-box">{s.onboarding.equipmentSetup}</div>
      )}
      {equipmentProfiles.length === 0 && (
        <p className="muted">{s.equipment.empty}</p>
      )}
      {equipmentProfiles.map((p) => (
        <Link
          key={p.id}
          to={`/settings/equipment/${p.id}`}
          className="card selectable"
          style={{ display: "block", textDecoration: "none", color: "inherit" }}
        >
          <strong>{p.name}</strong>
          <div className="muted small">
            {[
              p.barrel?.model && `バレル: ${p.barrel.model}`,
              p.barrel?.weightG != null && `${p.barrel.weightG}g`,
              p.flight?.shape && `フライト: ${p.flight.shape}`,
            ]
              .filter(Boolean)
              .join(" / ") || s.equipment.notes}
          </div>
        </Link>
      ))}
      <button
        className="btn primary block"
        onClick={() => navigate("/settings/equipment/new")}
      >
        {s.equipment.newProfile}
      </button>
      {isFirstSetup && (
        <button className="btn block" onClick={() => navigate("/")}>
          {s.onboarding.finish}
        </button>
      )}
    </div>
  );
}
