import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EquipmentEditPage from "./EquipmentEditPage";
import EquipmentListPage from "./EquipmentListPage";
import { AppProvider } from "../state/AppContext";
import { clearAllData, getEquipmentProfiles, saveEquipmentProfile } from "../db/db";
import { SCHEMA_VERSION } from "../types/models";

function renderEquipment(initialPath: string) {
  return render(
    <MemoryRouter
      initialEntries={["/settings/equipment", initialPath]}
      initialIndex={1}
    >
      <AppProvider>
        <Routes>
          <Route path="/settings/equipment" element={<EquipmentListPage />} />
          <Route path="/settings/equipment/:id" element={<EquipmentEditPage />} />
        </Routes>
      </AppProvider>
    </MemoryRouter>
  );
}

async function findNameInput(): Promise<HTMLInputElement> {
  const label = (await screen.findByText(/セッティング名/)).closest("label");
  return label!.querySelector("input") as HTMLInputElement;
}

describe("EquipmentEditPage (セッティング保存)", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it("名前だけの最小構成で保存でき、一覧とIndexedDBへ反映される", async () => {
    const user = userEvent.setup();
    renderEquipment("/settings/equipment/new");
    await user.type(await findNameInput(), "マイダーツA");
    await user.click(screen.getByRole("button", { name: "保存" }));

    // 保存後は一覧へ戻り、保存したセッティングが表示される
    expect(await screen.findByText("マイダーツA")).toBeInTheDocument();
    expect(screen.queryByText("セッティングがありません")).not.toBeInTheDocument();

    // IndexedDBへ永続化されている(リロード相当の再読込)
    const profiles = await getEquipmentProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.name).toBe("マイダーツA");
  });

  it("全項目入りで保存でき、数値項目が数値として永続化される", async () => {
    const user = userEvent.setup();
    renderEquipment("/settings/equipment/new");
    await user.type(await findNameInput(), "フルスペック");
    const numberInputs = screen
      .getAllByRole("spinbutton")
      .filter((el): el is HTMLInputElement => el instanceof HTMLInputElement);
    await user.type(numberInputs[0]!, "19.5"); // バレル重量
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("フルスペック")).toBeInTheDocument();
    const profiles = await getEquipmentProfiles();
    expect(profiles[0]?.barrel?.weightG).toBe(19.5);
  });

  it("名前が空なら保存せずエラーを表示し、画面遷移しない", async () => {
    const user = userEvent.setup();
    renderEquipment("/settings/equipment/new");
    await findNameInput();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("セッティング名を入力してください")).toBeInTheDocument();
    expect(await getEquipmentProfiles()).toHaveLength(0);
  });

  it("既存セッティングを編集して保存すると上書きされる", async () => {
    await saveEquipmentProfile({
      schemaVersion: SCHEMA_VERSION,
      id: "eq-1",
      name: "旧名称",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const user = userEvent.setup();
    renderEquipment("/settings/equipment/eq-1");
    const nameInput = await findNameInput();
    // 既存値が読み込まれるのを待つ
    await screen.findByDisplayValue("旧名称");
    await user.clear(nameInput);
    await user.type(nameInput, "新名称");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("新名称")).toBeInTheDocument();
    const profiles = await getEquipmentProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.name).toBe("新名称");
  });

  it("削除すると一覧とIndexedDBから消える", async () => {
    await saveEquipmentProfile({
      schemaVersion: SCHEMA_VERSION,
      id: "eq-del",
      name: "削除対象",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const user = userEvent.setup();
    renderEquipment("/settings/equipment/eq-del");
    await screen.findByDisplayValue("削除対象");
    await user.click(screen.getByRole("button", { name: "削除" }));
    // 確認ダイアログのOK
    await user.click(await screen.findByRole("button", { name: "OK" }));
    expect(await screen.findByText("セッティングがありません")).toBeInTheDocument();
    expect(await getEquipmentProfiles()).toHaveLength(0);
  });
});
