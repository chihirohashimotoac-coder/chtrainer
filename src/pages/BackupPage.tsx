import { useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { clearAllData, exportAllData, importAllData } from "../db/db";
import { buildBackup, parseBackup, serializeBackup, type BackupValidation } from "../export/backup";
import { downloadText, timestampForFilename } from "../export/download";
import { useApp } from "../state/AppContext";
import { t } from "../i18n/ja";

export default function BackupPage() {
  const s = t();
  const { refresh } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState<BackupValidation | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const exportJson = async () => {
    try {
      const data = await exportAllData();
      const backup = buildBackup(data);
      downloadText(
        serializeBackup(backup),
        `darts-backup-${timestampForFilename()}.json`,
        "application/json;charset=utf-8"
      );
      setMessage(s.common.download + ": OK");
      setErrorMessage("");
    } catch {
      setErrorMessage(s.errors.backupFailed);
    }
  };

  const onFileSelected = async (file: File) => {
    setMessage("");
    setErrorMessage("");
    try {
      const text = await file.text();
      const result = parseBackup(text);
      if (!result.ok) {
        setValidation(null);
        setErrorMessage(
          result.error === "version_too_new"
            ? s.errors.importVersionMismatch
            : s.errors.invalidImportFile
        );
        return;
      }
      setValidation(result);
    } catch {
      setErrorMessage(s.errors.invalidImportFile);
    }
  };

  const doImport = async () => {
    if (!validation?.backup) return;
    try {
      await importAllData(validation.backup.data, importMode);
      await refresh();
      setMessage(s.backup.importDone);
      setValidation(null);
      setErrorMessage("");
    } catch {
      setErrorMessage(s.backup.importFailedKept);
    } finally {
      setConfirmImport(false);
    }
  };

  return (
    <div>
      <h1>{s.backup.title}</h1>

      <div className="card">
        <h2>{s.backup.exportJson}</h2>
        <p className="muted small">{s.backup.exportDesc}</p>
        <button className="btn primary block" onClick={exportJson}>
          {s.backup.exportJson}
        </button>
      </div>

      <div className="card">
        <h2>{s.backup.importJson}</h2>
        <p className="muted small">{s.backup.importDesc}</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label={s.backup.importJson}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFileSelected(file);
          }}
        />
        {validation?.ok && validation.counts && (
          <>
            <h3>{s.backup.importCounts}</h3>
            <ul className="small">
              {Object.entries(validation.counts).map(([key, count]) => (
                <li key={key}>
                  {key}: {count}
                </li>
              ))}
            </ul>
            <div className="choice-row">
              <button
                className={`choice${importMode === "merge" ? " selected" : ""}`}
                onClick={() => setImportMode("merge")}
                aria-pressed={importMode === "merge"}
              >
                {s.backup.importModeMerge}
              </button>
              <button
                className={`choice${importMode === "replace" ? " selected" : ""}`}
                onClick={() => setImportMode("replace")}
                aria-pressed={importMode === "replace"}
              >
                {s.backup.importModeReplace}
              </button>
            </div>
            <button
              className="btn primary block"
              onClick={() => setConfirmImport(true)}
            >
              {s.backup.importJson}
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h2>{s.backup.deleteAll}</h2>
        <button className="btn danger block" onClick={() => setConfirmDelete(true)}>
          {s.backup.deleteAll}
        </button>
      </div>

      {message && <p className="ok-text">{message}</p>}
      {errorMessage && <p className="error-text">{errorMessage}</p>}

      <ConfirmDialog
        open={confirmImport}
        title={s.backup.importConfirm}
        onCancel={() => setConfirmImport(false)}
        onConfirm={doImport}
      >
        <p className="muted">
          {importMode === "replace"
            ? s.backup.importModeReplace
            : s.backup.importModeMerge}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        title={s.backup.deleteAll}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await clearAllData();
            await refresh();
            setMessage(s.backup.deleteDone);
          } catch {
            setErrorMessage(s.errors.genericError);
          } finally {
            setConfirmDelete(false);
          }
        }}
      >
        <p>{s.backup.deleteAllConfirm}</p>
      </ConfirmDialog>
    </div>
  );
}
