import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  deleteEquipmentProfile,
  getEquipmentProfile,
  saveEquipmentProfile,
} from "../db/db";
import { useApp } from "../state/AppContext";
import { SCHEMA_VERSION, type EquipmentProfile } from "../types/models";
import { newId, nowIso } from "../utils/id";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { t } from "../i18n/ja";

function numOrUndef(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default function EquipmentEditPage() {
  const s = t();
  const navigate = useNavigate();
  const { id } = useParams();
  const { refresh } = useApp();
  const isNew = id === "new";

  const [name, setName] = useState("");
  const [barrelMaker, setBarrelMaker] = useState("");
  const [barrelModel, setBarrelModel] = useState("");
  const [barrelWeight, setBarrelWeight] = useState("");
  const [barrelLength, setBarrelLength] = useState("");
  const [barrelDia, setBarrelDia] = useState("");
  const [shaftMaker, setShaftMaker] = useState("");
  const [shaftModel, setShaftModel] = useState("");
  const [shaftLength, setShaftLength] = useState("");
  const [flightMaker, setFlightMaker] = useState("");
  const [flightModel, setFlightModel] = useState("");
  const [flightShape, setFlightShape] = useState("");
  const [flightColors, setFlightColors] = useState("");
  const [pointMaker, setPointMaker] = useState("");
  const [pointModel, setPointModel] = useState("");
  const [pointLength, setPointLength] = useState("");
  const [notes, setNotes] = useState("");
  const [createdAt, setCreatedAt] = useState<string>();
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isNew || !id) return;
    void getEquipmentProfile(id).then((p) => {
      if (!p) return;
      setName(p.name);
      setBarrelMaker(p.barrel?.maker ?? "");
      setBarrelModel(p.barrel?.model ?? "");
      setBarrelWeight(p.barrel?.weightG?.toString() ?? "");
      setBarrelLength(p.barrel?.lengthMm?.toString() ?? "");
      setBarrelDia(p.barrel?.maxDiameterMm?.toString() ?? "");
      setShaftMaker(p.shaft?.maker ?? "");
      setShaftModel(p.shaft?.model ?? "");
      setShaftLength(p.shaft?.lengthMm?.toString() ?? "");
      setFlightMaker(p.flight?.maker ?? "");
      setFlightModel(p.flight?.model ?? "");
      setFlightShape(p.flight?.shape ?? "");
      setFlightColors(p.flight?.colors?.join(", ") ?? "");
      setPointMaker(p.point?.maker ?? "");
      setPointModel(p.point?.model ?? "");
      setPointLength(p.point?.lengthMm?.toString() ?? "");
      setNotes(p.notes ?? "");
      setCreatedAt(p.createdAt);
    });
  }, [id, isNew]);

  const save = async () => {
    if (!name.trim()) {
      setError(s.equipment.nameRequired);
      return;
    }
    const now = nowIso();
    const profile: EquipmentProfile = {
      schemaVersion: SCHEMA_VERSION,
      id: isNew || !id ? newId() : id,
      name: name.trim(),
      barrel: {
        ...(barrelMaker ? { maker: barrelMaker } : {}),
        ...(barrelModel ? { model: barrelModel } : {}),
        ...(numOrUndef(barrelWeight) != null
          ? { weightG: numOrUndef(barrelWeight) }
          : {}),
        ...(numOrUndef(barrelLength) != null
          ? { lengthMm: numOrUndef(barrelLength) }
          : {}),
        ...(numOrUndef(barrelDia) != null
          ? { maxDiameterMm: numOrUndef(barrelDia) }
          : {}),
      },
      shaft: {
        ...(shaftMaker ? { maker: shaftMaker } : {}),
        ...(shaftModel ? { model: shaftModel } : {}),
        ...(numOrUndef(shaftLength) != null
          ? { lengthMm: numOrUndef(shaftLength) }
          : {}),
      },
      flight: {
        ...(flightMaker ? { maker: flightMaker } : {}),
        ...(flightModel ? { model: flightModel } : {}),
        ...(flightShape ? { shape: flightShape } : {}),
        ...(flightColors.trim()
          ? { colors: flightColors.split(",").map((c) => c.trim()).filter(Boolean) }
          : {}),
      },
      point: {
        ...(pointMaker ? { maker: pointMaker } : {}),
        ...(pointModel ? { model: pointModel } : {}),
        ...(numOrUndef(pointLength) != null
          ? { lengthMm: numOrUndef(pointLength) }
          : {}),
      },
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      createdAt: createdAt ?? now,
      updatedAt: now,
    };
    try {
      await saveEquipmentProfile(profile);
      await refresh();
      navigate(-1);
    } catch {
      alert(s.errors.dbSaveFailed);
    }
  };

  const field = (
    label: string,
    value: string,
    setter: (v: string) => void,
    type: "text" | "number" = "text"
  ) => (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(e) => setter(e.target.value)} />
    </label>
  );

  return (
    <div>
      <h1>{isNew ? s.equipment.newProfile : s.equipment.title}</h1>
      {field(`${s.equipment.profileName} (${s.common.required})`, name, setName)}
      {error && <p className="error-text">{error}</p>}

      <h2>{s.equipment.barrel}</h2>
      {field(s.equipment.maker, barrelMaker, setBarrelMaker)}
      {field(s.equipment.model, barrelModel, setBarrelModel)}
      {field(s.equipment.weightG, barrelWeight, setBarrelWeight, "number")}
      {field(s.equipment.lengthMm, barrelLength, setBarrelLength, "number")}
      {field(s.equipment.maxDiameterMm, barrelDia, setBarrelDia, "number")}

      <h2>{s.equipment.shaft}</h2>
      {field(s.equipment.maker, shaftMaker, setShaftMaker)}
      {field(s.equipment.model, shaftModel, setShaftModel)}
      {field(s.equipment.shaftLengthMm, shaftLength, setShaftLength, "number")}

      <h2>{s.equipment.flight}</h2>
      {field(s.equipment.maker, flightMaker, setFlightMaker)}
      {field(s.equipment.model, flightModel, setFlightModel)}
      {field(s.equipment.shape, flightShape, setFlightShape)}
      {field(s.equipment.colors, flightColors, setFlightColors)}

      <h2>{s.equipment.point}</h2>
      {field(s.equipment.maker, pointMaker, setPointMaker)}
      {field(s.equipment.model, pointModel, setPointModel)}
      {field(s.equipment.pointLengthMm, pointLength, setPointLength, "number")}

      <label className="field">
        <span>{s.equipment.notes}</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="action-bar">
        <button className="btn primary block" onClick={save}>
          {s.common.save}
        </button>
        {!isNew && (
          <button
            className="btn danger block"
            onClick={() => setConfirmDelete(true)}
          >
            {s.common.delete}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={s.common.delete}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (id && !isNew) {
            await deleteEquipmentProfile(id);
            await refresh();
          }
          navigate(-1);
        }}
      >
        <p>{s.equipment.deleteConfirm}</p>
      </ConfirmDialog>
    </div>
  );
}
