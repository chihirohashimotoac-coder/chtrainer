import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlayerForm } from "../components/PlayerForm";
import { saveAppSettings, savePlayer } from "../db/db";
import { useApp } from "../state/AppContext";
import { t } from "../i18n/ja";

export default function OnboardingPage() {
  const s = t();
  const navigate = useNavigate();
  const { equipmentProfiles, refresh } = useApp();
  const [step, setStep] = useState<"intro" | "player">("intro");

  return (
    <div>
      <h1>{s.onboarding.title}</h1>
      {step === "intro" && (
        <>
          <div className="card">
            <p>{s.onboarding.intro1}</p>
            <p>{s.onboarding.intro2}</p>
            <p className="muted">{s.onboarding.intro3}</p>
            <p className="muted">{s.onboarding.intro4}</p>
          </div>
          <button className="btn primary block" onClick={() => setStep("player")}>
            {s.onboarding.playerSetup}
          </button>
        </>
      )}
      {step === "player" && (
        <>
          <h2>{s.onboarding.playerSetup}</h2>
          <PlayerForm
            equipmentProfiles={equipmentProfiles}
            saveLabel={s.onboarding.finish}
            onSave={async (player) => {
              try {
                await savePlayer(player);
                await saveAppSettings({
                  onboardingCompleted: true,
                  activePlayerId: player.id,
                });
                await refresh();
                navigate("/settings/equipment?first=1");
              } catch {
                alert(s.errors.dbSaveFailed);
              }
            }}
          />
        </>
      )}
    </div>
  );
}
