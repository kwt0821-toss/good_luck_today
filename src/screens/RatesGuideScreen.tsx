import { useEffect, useState } from "react";

import { useBackHandler } from "../hooks/useBackHandler";
import {
  affectionConfig,
  breedCardsInGrade,
  formatRatePercent,
  rateBias,
  shiftedGradeRates,
} from "../lib/affection";
import { loadDexCatalog } from "../lib/dexCatalog";
import { rateRows } from "../lib/drawRates";
import { adjustedGradeRates } from "../lib/season";
import { loadOpsConfig } from "../lib/opsConfig";
import { loadOpsState } from "../lib/opsStorage";
import type { OpsEconomy, OpsState } from "../lib/opsTypes";
import { loadRoomCats } from "../lib/roomCats";
import type { DexCatalog } from "../lib/dexTypes";
import "./RatesGuideScreen.css";

type RatesGuideScreenProps = {
  onBack: () => void;
};

export function RatesGuideScreen({ onBack }: RatesGuideScreenProps) {
  const [economy, setEconomy] = useState<OpsEconomy | null>(null);
  const [ops, setOps] = useState<OpsState | null>(null);
  const [tab, setTab] = useState<"normal" | "rateUp">("normal");

  useEffect(() => {
    void Promise.all([loadOpsConfig(), loadOpsState()]).then(([config, loaded]) => {
      setEconomy(config.economy);
      setOps(loaded);
    });
  }, []);
  useBackHandler(true, onBack);

  const rows = economy ? rateRows(economy, tab === "rateUp") : [];
  const proposal = Boolean(economy?.draws.rates_proposal);

  return (
    <div className="rates-screen">
      <h1 className="rates-title">확률 안내</h1>

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

      <div className="rates-note">
        {rateBias(ops, economy) ? null : (
          <p>{economy?.draws.rates_proposal.keys ?? "같은 등급 안에서는 카드가 균등하게 뽑혀요."}</p>
        )}
        <AffectionRateNote economy={economy} ops={ops} rateUp={tab === "rateUp"} />
      </div>
    </div>
  );
}

export function AffectionRateNote({
  economy,
  ops,
  rateUp,
}: {
  economy: OpsEconomy | null;
  ops: OpsState | null;
  rateUp: boolean;
}) {
  const [catalog, setCatalog] = useState<DexCatalog | null>(null);
  const [breedName, setBreedName] = useState("최애냥");
  useEffect(() => {
    void Promise.all([loadDexCatalog(), loadRoomCats()]).then(([cards, cats]) => {
      setCatalog(cards);
      const cat = cats.find((item) => item.id === ops?.affection.catId);
      if (cat) setBreedName(cat.nameKo);
    });
  }, [ops?.affection.catId]);
  const config = affectionConfig(economy);
  const bias = rateBias(ops, economy);
  const fromLevel = config?.rateBonus.fromLevel ?? 5;
  if (!bias || !economy || !catalog || !config) {
    return <p>애정도 Lv.{fromLevel}가 되면 최애냥 품종이 같은 등급 안에서 조금 더 잘 나와요.</p>;
  }
  const table = adjustedGradeRates(economy, rateUp);
  const tabName = rateUp ? "확률업 뽑기" : "일반 뽑기";
  const lines = (["b1", "b2", "b3", "b4", "b5"] as const).flatMap((key) => {
    const stars = Number(key.slice(1));
    const cards = breedCardsInGrade(catalog, stars);
    const gradeRate = table[key];
    if (!cards || typeof gradeRate !== "number") return [];
    const shifted = shiftedGradeRates(gradeRate, cards, bias.weightMul);
    const gradePct = Number.isInteger(gradeRate * 100)
      ? `${gradeRate * 100}%`
      : `${(gradeRate * 100).toFixed(1)}%`;
    return [
      `${tabName} ${stars}★ 장당 ${formatRatePercent(shifted.even)} → 최애냥 ${formatRatePercent(shifted.favorite)}, 같은 등급 다른 카드 ${formatRatePercent(shifted.other)} (등급 확률 ${gradePct}는 그대로)`,
    ];
  });
  return (
    <>
      <p>
        애정도 Lv.{fromLevel} 이상: 최애냥({breedName})은 같은 등급 안에서 가중치 ×{config.rateBonus.weightMul}로 조금 더
        잘 나와요.
      </p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </>
  );
}
