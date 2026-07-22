import { useState } from "react";
import { t } from "../i18n/ja";
import {
  applyTheme,
  getStoredTheme,
  THEME_PREVIEWS,
  type ThemeId,
} from "../theme/theme";

export default function ThemeSettingsPage() {
  const s = t();
  const [selected, setSelected] = useState<ThemeId>(() => getStoredTheme());

  const choose = (id: ThemeId) => {
    setSelected(id);
    applyTheme(id);
  };

  return (
    <div>
      <div className="top-bar">
        <h1>{s.theme.title}</h1>
      </div>
      <p className="page-lead">{s.theme.lead}</p>
      <div className="theme-grid">
        {THEME_PREVIEWS.map((theme) => {
          const opt = s.theme.options[theme.id];
          const isSelected = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              className={`card selectable theme-option${
                isSelected ? " selected" : ""
              }`}
              aria-pressed={isSelected}
              onClick={() => choose(theme.id)}
            >
              <span className="theme-swatch" aria-hidden>
                {theme.swatch.map((color, i) => (
                  <span key={i} style={{ background: color }} />
                ))}
              </span>
              <span className="theme-copy">
                <span className="theme-name">
                  {opt.name}
                  {isSelected && (
                    <span className="badge ok">{s.theme.current}</span>
                  )}
                </span>
                <span className="muted small">{opt.desc}</span>
                <span className="badge theme-mode">
                  {theme.dark ? s.theme.dark : s.theme.light}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
