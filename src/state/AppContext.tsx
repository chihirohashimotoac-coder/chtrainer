import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AppSettings,
  EquipmentProfile,
  PlayerProfile,
  TrainingSession,
} from "../types/models";
import {
  getActiveSession,
  getAppSettings,
  getEquipmentProfiles,
  getPlayer,
} from "../db/db";

interface AppState {
  loading: boolean;
  settings?: AppSettings;
  player?: PlayerProfile;
  equipmentProfiles: EquipmentProfile[];
  activeSession?: TrainingSession;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppState>({
  loading: true,
  equipmentProfiles: [],
  refresh: async () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>();
  const [player, setPlayer] = useState<PlayerProfile>();
  const [equipmentProfiles, setEquipmentProfiles] = useState<
    EquipmentProfile[]
  >([]);
  const [activeSession, setActiveSession] = useState<TrainingSession>();

  const refresh = useCallback(async () => {
    try {
      const s = await getAppSettings();
      setSettings(s);
      setPlayer(
        s?.activePlayerId ? await getPlayer(s.activePlayerId) : undefined
      );
      setEquipmentProfiles(await getEquipmentProfiles());
      setActiveSession(await getActiveSession());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      loading,
      settings,
      player,
      equipmentProfiles,
      activeSession,
      refresh,
    }),
    [loading, settings, player, equipmentProfiles, activeSession, refresh]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  return useContext(AppContext);
}

/** 触覚・効果音フィードバック */
export function feedback(player: PlayerProfile | undefined): void {
  if (player?.vibrationEnabled && "vibrate" in navigator) {
    try {
      navigator.vibrate(30);
    } catch {
      // ignore
    }
  }
  if (player?.soundEnabled) {
    try {
      type AudioCtor = typeof AudioContext;
      const w = window as unknown as {
        AudioContext?: AudioCtor;
        webkitAudioContext?: AudioCtor;
      };
      const Ctx = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      osc.onended = () => void ctx.close();
    } catch {
      // ignore
    }
  }
}
