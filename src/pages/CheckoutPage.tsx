import { useMemo, useState } from "react";
import {
  CHECKOUT_MAX,
  CHECKOUT_MIN,
  checkoutTable,
  suggestCheckout,
} from "../domain/checkout";
import { t } from "../i18n/ja";

/** フィニッシュ(チェックアウト)の練習補助。残り点数から標準的な上がり筋を示す。 */
export default function CheckoutPage() {
  const s = t();
  const [input, setInput] = useState("");
  const [showTable, setShowTable] = useState(false);

  const target = Number(input);
  const valid =
    input.trim() !== "" &&
    Number.isInteger(target) &&
    target >= CHECKOUT_MIN &&
    target <= CHECKOUT_MAX;
  const route = valid ? suggestCheckout(target) : null;

  const table = useMemo(() => checkoutTable(), []);

  return (
    <div>
      <div className="top-bar">
        <h1>{s.checkout.title}</h1>
      </div>
      <p className="page-lead">{s.checkout.lead}</p>

      <label className="field">
        <span>{s.checkout.remaining}</span>
        <input
          type="number"
          inputMode="numeric"
          min={CHECKOUT_MIN}
          max={CHECKOUT_MAX}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例: 120"
        />
      </label>

      {input.trim() !== "" && !valid && (
        <p className="error-text">{s.checkout.rangeError}</p>
      )}

      {valid && (
        <div className="card">
          <div className="list-row">
            <span className="muted">{s.checkout.remaining}</span>
            <strong className="s-num">{target}</strong>
          </div>
          {route ? (
            <div className="checkout-route">
              {route.map((seg, i) => (
                <span key={i} className="checkout-seg">
                  {seg}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">{s.checkout.bogey}</p>
          )}
        </div>
      )}

      <div className="info-box">{s.checkout.note}</div>

      <button
        className="btn block"
        onClick={() => setShowTable((v) => !v)}
        aria-expanded={showTable}
      >
        {showTable ? s.checkout.hideTable : s.checkout.showTable}
      </button>

      {showTable && (
        <div className="table-wrap">
          <p className="scroll-hint">横にスクロールして詳細を確認できます →</p>
          <table className="stats">
            <thead>
              <tr>
                <th>{s.checkout.remaining}</th>
                <th>{s.checkout.route}</th>
              </tr>
            </thead>
            <tbody>
              {table.map(({ score, routes }) => (
                <tr key={score}>
                  <td className="s-num">{score}</td>
                  <td>{routes ? routes.join("  →  ") : s.checkout.bogeyShort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
