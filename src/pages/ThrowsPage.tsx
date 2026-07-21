import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CoordinateInput } from "../components/CoordinateInput";
import { SimpleInput } from "../components/SimpleInput";
import { getBoardProfile } from "../config/boardProfiles";
import { getSession, getThrows, getThrowSets } from "../db/db";
import { updateThrowLanding } from "../services/sessionService";
import { directionLabel } from "../export/markdown";
import { segmentLabel } from "../domain/targets";
import type {
  InputMethod,
  LandingRecord,
  ThrowRecord,
  TrainingSession,
} from "../types/models";
import { fmtNum } from "../utils/format";
import { t } from "../i18n/ja";

function landingLabelOf(landing: LandingRecord): string {
  const s = t();
  if (landing.ring === "outboard") return s.input.outboard;
  if (landing.ring === "bounce_out") return s.input.bounceOut;
  if (landing.ring === "inner_bull") return s.input.innerBull;
  if (landing.ring === "outer_bull") return s.input.outerBull;
  if (landing.ring === "unknown") return s.direction.unknown;
  return segmentLabel(landing.ring, landing.number);
}

function isGroupingOnly(record: ThrowRecord): boolean {
  return record.target.evaluationKind === "grouping_only" ||
    (record.target.type === "custom_selection" &&
      (record.target.areas?.length ?? 0) === 0);
}

export default function ThrowsPage() {
  const s = t();
  const { id } = useParams();
  const [session, setSession] = useState<TrainingSession>();
  const [throws, setThrows] = useState<ThrowRecord[]>([]);
  const [setNumbers, setSetNumbers] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<ThrowRecord | null>(null);
  const [editMethod, setEditMethod] = useState<InputMethod>("coordinate");
  const [savedMsg, setSavedMsg] = useState(false);

  const load = async () => {
    if (!id) return;
    setSession(await getSession(id));
    setThrows(await getThrows(id));
    const sets = await getThrowSets(id);
    const map: Record<string, number> = {};
    for (const set of sets) map[set.id] = set.setNumber;
    setSetNumbers(map);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const profile = useMemo(
    () => (session ? getBoardProfile(session.boardProfileId) : undefined),
    [session]
  );

  if (!session) return <p>{s.common.loading}</p>;

  if (editing && profile) {
    return (
      <div>
        <h1>{s.throws.editTitle}</h1>
        <p className="muted small">
          No.{editing.globalThrowNumber} / {s.throws.target}:{" "}
          {editing.target.label}
        </p>
        <div className="choice-row" style={{ margin: "0.4rem 0" }}>
          <button
            className={`choice${editMethod === "coordinate" ? " selected" : ""}`}
            onClick={() => setEditMethod("coordinate")}
          >
            {s.player.inputCoordinate}
          </button>
          <button
            className={`choice${editMethod === "simple" ? " selected" : ""}`}
            onClick={() => setEditMethod("simple")}
          >
            {s.player.inputSimple}
          </button>
        </div>
        {editMethod === "coordinate" ? (
          <CoordinateInput
            profile={profile}
            initial={
              editing.landing.x != null && editing.landing.y != null
                ? { x: editing.landing.x, y: editing.landing.y }
                : undefined
            }
            onCancel={() => setEditing(null)}
            initialSpeedKmh={editing.speedKmh}
            onConfirm={async (landing, speedKmh) => {
              try {
                await updateThrowLanding(editing, landing, undefined, speedKmh ?? null);
                setEditing(null);
                setSavedMsg(true);
                await load();
              } catch {
                alert(s.errors.dbSaveFailed);
              }
            }}
          />
        ) : (
          <SimpleInput
            profile={profile}
            onCancel={() => setEditing(null)}
            initialSpeedKmh={editing.speedKmh}
            onConfirm={async (landing, speedKmh) => {
              try {
                await updateThrowLanding(editing, landing, undefined, speedKmh ?? null);
                setEditing(null);
                setSavedMsg(true);
                await load();
              } catch {
                alert(s.errors.dbSaveFailed);
              }
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <h1>{s.throws.title}</h1>
      {savedMsg && <p className="ok-text small">{s.throws.savedEdit}</p>}
      <div className="info-box na-legend">
        <strong>N/A：</strong>このラウンドでは命中・誤差を評価しない、または判定に必要なデータがない項目です。R1グルーピングの命中は、命中率を測定しないためN/Aです。
      </div>
      <div className="table-wrap">
        <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
        <table className="stats">
          <thead>
            <tr>
              <th>{s.throws.no}</th>
              <th>{s.throws.set}</th>
              <th>{s.throws.order}</th>
              <th>{s.throws.target}</th>
              <th>{s.throws.landing}</th>
              <th>{s.throws.hit}</th>
              <th>X</th>
              <th>Y</th>
              <th>{s.throws.errorDistance}</th>
              <th>{s.throws.missDirection}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {throws.map((th) => (
              <tr key={th.id}>
                <td>{th.globalThrowNumber}</td>
                <td>{setNumbers[th.setId] ?? "?"}</td>
                <td>{th.dartInSet}</td>
                <td>{th.target.label}</td>
                <td>
                  {landingLabelOf(th.landing)}
                  {th.landing.positionPrecision === "segment_approximation"
                    ? " ≈"
                    : ""}
                </td>
                <td>{isGroupingOnly(th) ? "N/A" : th.derived.exactHit ? "○" : "×"}</td>
                <td>{th.landing.x != null ? fmtNum(th.landing.x) : "N/A"}</td>
                <td>{th.landing.y != null ? fmtNum(th.landing.y) : "N/A"}</td>
                <td>
                  {th.derived.errorDistance != null
                    ? fmtNum(th.derived.errorDistance)
                    : "N/A"}
                </td>
                <td>{directionLabel(th.derived.missDirection)}</td>
                <td>
                  <button
                    className="btn small"
                    onClick={() => {
                      setEditing(th);
                      setEditMethod(
                        th.landing.positionPrecision === "coordinate"
                          ? "coordinate"
                          : "simple"
                      );
                      setSavedMsg(false);
                    }}
                  >
                    {s.common.edit}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
