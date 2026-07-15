import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Arrangement } from "../domain/planner";
import type {
  RandomVariant,
  TargetDefinition,
  TrainingMode,
} from "../types/models";

/** トレーニング開始フロー(モード→ターゲット→セット数→開始前設定)の一時状態 */
export interface SetupState {
  mode?: TrainingMode;
  randomVariant?: RandomVariant;
  arrangement?: Arrangement;
  targets: TargetDefinition[];
  setCount: number;
}

interface SetupContextValue {
  setup: SetupState;
  update: (patch: Partial<SetupState>) => void;
  reset: () => void;
}

const initialState: SetupState = {
  targets: [],
  setCount: 20,
};

const SetupContext = createContext<SetupContextValue>({
  setup: initialState,
  update: () => {},
  reset: () => {},
});

export function SetupProvider({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<SetupState>(initialState);
  const value = useMemo(
    () => ({
      setup,
      update: (patch: Partial<SetupState>) =>
        setSetup((prev) => ({ ...prev, ...patch })),
      reset: () => setSetup(initialState),
    }),
    [setup]
  );
  return (
    <SetupContext.Provider value={value}>{children}</SetupContext.Provider>
  );
}

export function useSetup(): SetupContextValue {
  return useContext(SetupContext);
}
