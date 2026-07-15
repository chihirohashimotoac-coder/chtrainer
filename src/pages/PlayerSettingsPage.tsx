import { useNavigate } from "react-router-dom";
import { PlayerForm } from "../components/PlayerForm";
import { saveAppSettings, savePlayer } from "../db/db";
import { useApp } from "../state/AppContext";
import { t } from "../i18n/ja";

export default function PlayerSettingsPage() {
  const s = t();
  const navigate = useNavigate();
  const { player, settings, equipmentProfiles, refresh, loading } = useApp();

  if (loading) return <p>{s.common.loading}</p>;

  return (
    <div>
      <h1>{s.player.title}</h1>
      <PlayerForm
        initial={player}
        equipmentProfiles={equipmentProfiles}
        onSave={async (updated) => {
          try {
            await savePlayer(updated);
            await saveAppSettings({
              onboardingCompleted: settings?.onboardingCompleted ?? true,
              activePlayerId: updated.id,
            });
            await refresh();
            navigate("/settings");
          } catch {
            alert(s.errors.dbSaveFailed);
          }
        }}
      />
    </div>
  );
}
