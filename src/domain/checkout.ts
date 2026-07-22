/**
 * チェックアウト(フィニッシュ)の算出。
 * 手打ちの上がり表は誤りが混入しやすいため、ダーツの実際の面から
 * 3ダート以内・最終ダートはダブル(またはブル50)という規則で厳密に解く。
 * 出力は標準的な上がり筋になるよう、狙う面の優先順位を与えて探索する。
 */

interface Segment {
  value: number;
  label: string;
}

/** 最終ダート(フィニッシュ)候補: ダブルとブル。標準的な優先順で並べる。 */
const FINISHERS: Segment[] = [
  { value: 40, label: "D20" },
  { value: 32, label: "D16" },
  { value: 16, label: "D8" },
  { value: 8, label: "D4" },
  { value: 24, label: "D12" },
  { value: 20, label: "D10" },
  { value: 36, label: "D18" },
  { value: 28, label: "D14" },
  { value: 12, label: "D6" },
  { value: 4, label: "D2" },
  { value: 50, label: "BULL" },
  { value: 2, label: "D1" },
  { value: 6, label: "D3" },
  { value: 10, label: "D5" },
  { value: 14, label: "D7" },
  { value: 18, label: "D9" },
  { value: 22, label: "D11" },
  { value: 26, label: "D13" },
  { value: 30, label: "D15" },
  { value: 34, label: "D17" },
  { value: 38, label: "D19" },
];

/** 非最終ダート候補(第1ダート): T20から優先し、標準的な高得点筋を作る。 */
const SETUP_DARTS: Segment[] = (() => {
  const list: Segment[] = [];
  for (let n = 20; n >= 1; n--) list.push({ value: n * 3, label: `T${n}` });
  list.push({ value: 50, label: "BULL" });
  list.push({ value: 25, label: "25" });
  for (let n = 20; n >= 1; n--) list.push({ value: n, label: `S${n}` });
  return list;
})();

/**
 * 値→非最終ダートのラベル。1〜20はシングルを優先し(標準的な繋ぎ)、
 * それ以外はトリプル、25、ブルで埋める。
 */
const SETUP_BY_VALUE: Map<number, string> = (() => {
  const map = new Map<number, string>();
  for (let n = 1; n <= 20; n++) map.set(n, `S${n}`);
  for (let n = 1; n <= 20; n++) if (!map.has(n * 3)) map.set(n * 3, `T${n}`);
  map.set(25, "25");
  map.set(50, "BULL");
  return map;
})();

const FINISHER_BY_VALUE = new Map(FINISHERS.map((f) => [f.value, f]));

function oneDart(target: number): string[] | null {
  const f = FINISHER_BY_VALUE.get(target);
  return f ? [f.label] : null;
}

/** 2ダート上がり。フィニッシュ(ダブル/ブル)を優先順で選び、残りを1本の繋ぎで埋める。 */
function twoDart(target: number): string[] | null {
  for (const f of FINISHERS) {
    const rem = target - f.value;
    if (rem <= 0) continue;
    const setup = SETUP_BY_VALUE.get(rem);
    if (setup) return [setup, f.label];
  }
  return null;
}

/** 3ダート上がり。第1ダートはT20から優先し、残り2本を標準筋で解く。 */
function threeDart(target: number): string[] | null {
  for (const s of SETUP_DARTS) {
    const rest = twoDart(target - s.value);
    if (rest) return [s.label, ...rest];
  }
  return null;
}

/** チェックアウトの最小/標準ダートの範囲。 */
export const CHECKOUT_MIN = 2;
export const CHECKOUT_MAX = 170;

/**
 * 残り点数に対する推奨フィニッシュ(狙う面の並び)を返す。
 * 3ダートで上がれない(ボギーナンバー等)場合は null。
 */
export function suggestCheckout(target: number): string[] | null {
  if (!Number.isInteger(target) || target < CHECKOUT_MIN || target > CHECKOUT_MAX) {
    return null;
  }
  return oneDart(target) ?? twoDart(target) ?? threeDart(target);
}

/** 2〜170の推奨フィニッシュ一覧(表示用)。上がれない数は routes:null。 */
export function checkoutTable(): { score: number; routes: string[] | null }[] {
  const out: { score: number; routes: string[] | null }[] = [];
  for (let score = CHECKOUT_MAX; score >= CHECKOUT_MIN; score--) {
    out.push({ score, routes: suggestCheckout(score) });
  }
  return out;
}
