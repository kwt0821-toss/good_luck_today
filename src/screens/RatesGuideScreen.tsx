import { useEffect, useState } from "react";

import { rateRows } from "../lib/drawRates";
import { loadOpsConfig } from "../lib/opsConfig";
import type { OpsEconomy } from "../lib/opsTypes";
import "./RatesGuideScreen.css";

type RatesGuideScreenProps = {
  onBack: () => void;
};

export function RatesGuideScreen({ onBack }: RatesGuideScreenProps) {
  const [economy, setEconomy] = useState<OpsEconomy | null>(null);
  const [tab, setTab] = useState<"normal" | "rateUp">("normal");

  useEffect(() => {
    void loadOpsConfig().then((config) => setEconomy(config.economy));
  }, []);

  const rows = economy ? rateRows(economy, tab === "rateUp") : [];
  const proposal = Boolean(economy?.draws.rates_proposal);

  return (
    <div className="rates-screen">
      <header className="rates-header">
        <button type="button" className="rates-back" onClick={onBack} aria-label="뒤로">
          ←
        </button>
        <h1>확률 안내</h1>
      </header>

      <p className="rates-lead">
        뽑기 확률은 앱 설정에서 읽어 공개해요.
        {proposal ? " (현재 제안값 · `_proposal`)" : null}
      </p>

      <div className="rates-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "normal"}
          className={tab === "normal" ? "is-on" : ""}
          onClick={() => setTab("normal")}
        >
          일반 뽑기
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "rateUp"}
          className={tab === "rateUp" ? "is-on" : ""}
          onClick={() => setTab("rateUp")}
        >
          확률업 뽑기
        </button>
      </div>

      <ul className="rates-list">
        {rows.map((row) => (
          <li key={row.key}>
            <span>{row.label}</span>
            <strong>{row.percent}</strong>
          </li>
        ))}
      </ul>

      <p className="rates-note">
        {economy?.draws.rates_proposal.keys ??
          "같은 등급 안에서는 카드가 균등하게 뽑혀요."}
      </p>
    </div>
  );
}
