import { useEffect, useState } from "react";

import { loadHelpConfig, type HelpConfig, type HelpTabId } from "../lib/helpConfig";
import { ncoinIcon } from "../lib/ncoinIcon";
import "./HelpEarnSheet.css";

const PAW_COIN_ICON = "/assets/menu/icon-paw-coin.svg";

type HelpEarnSheetProps = {
  onClose: () => void;
  /** Initial tab from entry point (wallet ncoin → ncoin, etc.). */
  initialTab?: HelpTabId;
};

export function HelpEarnSheet({ onClose, initialTab = "ncoin" }: HelpEarnSheetProps) {
  const [config, setConfig] = useState<HelpConfig | null>(null);
  const [tabId, setTabId] = useState<HelpTabId>(initialTab);

  useEffect(() => {
    let cancelled = false;
    void loadHelpConfig()
      .then((cfg) => {
        if (!cancelled) setConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTabId(initialTab);
  }, [initialTab]);

  const tab = config?.tabs.find((row) => row.id === tabId) ?? config?.tabs[0] ?? null;
  const isNcoin = tab?.id === "ncoin";
  const leadIcon = isNcoin ? ncoinIcon(44) : PAW_COIN_ICON;
  const amtIcon = isNcoin ? ncoinIcon(16) : PAW_COIN_ICON;

  return (
    <div className="help-earn-root" role="dialog" aria-modal="true" aria-label={config?.title ?? "얻는 법"}>
      <button type="button" className="help-earn-dim" aria-label="닫기" onClick={onClose} />
      <div className={`help-earn-sheet ${isNcoin ? "is-ncoin" : "is-paw"}`}>
        <div className="help-earn-grab" aria-hidden="true" />
        <header className="help-earn-hd">
          <h1>{config?.title ?? "냥코인·포인트 얻는 법"}</h1>
          <button type="button" className="help-earn-x" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="help-earn-tabs" role="tablist" aria-label="보상 종류">
          {(config?.tabs ?? []).map((row) => {
            const on = row.id === tabId;
            return (
              <button
                key={row.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={`help-earn-tab ${on ? "is-on" : ""}`}
                onClick={() => setTabId(row.id)}
              >
                <img
                  src={row.icon === "ncoin" ? ncoinIcon(20) : PAW_COIN_ICON}
                  alt=""
                  width={20}
                  height={20}
                />
                {row.label}
              </button>
            );
          })}
        </div>

        {tab ? (
          <>
            <div className="help-earn-lead">
              <img src={leadIcon} alt="" width={44} height={44} />
              <div>
                <b>{tab.lead}</b>
                <span>받은 보상은 보상함에 쌓여요</span>
              </div>
            </div>

            <div className="help-earn-use">
              <span className="help-earn-use-k">{tab.use.h === "이렇게 써요" ? "쓰는 곳" : tab.use.h}</span>
              <div>
                <div className="help-earn-use-t">{tab.use.t}</div>
                <div className="help-earn-use-d">{tab.use.d}</div>
              </div>
            </div>

            <div className="help-earn-body">
              {tab.sections.map((section) => (
                <div key={section.h} className="help-earn-section">
                  <div className="help-earn-h">{section.h}</div>
                  <div className="help-earn-card">
                    {section.rows.map((row) => (
                      <div key={`${section.h}-${row.t}`} className="help-earn-row">
                        <div className="help-earn-tx">
                          <div className="help-earn-t">{row.t}</div>
                          <div className="help-earn-d">{row.d}</div>
                        </div>
                        <div className="help-earn-a">
                          <span className="help-earn-amt">
                            <img src={amtIcon} alt="" width={16} height={16} />
                            {row.amt}
                          </span>
                          <div className="help-earn-cap">{row.cap}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {config?.footnote ? <p className="help-earn-foot">{config.footnote}</p> : null}
            </div>
          </>
        ) : (
          <div className="help-earn-body">
            <p className="help-earn-foot">도움말을 불러오는 중이에요</p>
          </div>
        )}
      </div>
    </div>
  );
}
