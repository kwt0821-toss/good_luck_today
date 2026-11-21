import "./AppTabBar.css";

export type AppTabId = "collection" | "home" | "room";

const TABS: { id: AppTabId; label: string; icon: string }[] = [
  { id: "collection", label: "도감", icon: "/assets/main/icon-dex-book.svg" },
  { id: "home", label: "홈", icon: "/assets/main/icon-home.svg" },
  { id: "room", label: "방꾸미기", icon: "/assets/main/icon-room-house.svg" },
];

type Props = {
  current: AppTabId;
  dexBadge?: boolean;
  /** Tutorial: other screens stay put. */
  locked?: boolean;
  /** Home may still open the dex. `#icon-dex` is the tutorial step. */
  allowDex?: boolean;
  docked?: boolean;
  className?: string;
  onSelect: (tab: AppTabId) => void;
};

export function AppTabBar({
  current,
  dexBadge = false,
  locked = false,
  allowDex = false,
  docked = false,
  className,
  onSelect,
}: Props) {
  return (
    <nav
      className={`app-tabbar${docked ? " is-docked" : ""}${className ? ` ${className}` : ""}`}
      aria-label="하단 탭"
    >
      {TABS.map((tab) => {
        const selected = tab.id === current;
        const blocked = !selected && locked && !(allowDex && tab.id === "collection");
        return (
          <button
            key={tab.id}
            type="button"
            id={tab.id === "collection" ? "icon-dex" : undefined}
            className={`app-tab main-nav-btn${selected ? " is-current" : ""}`}
            aria-current={selected ? "page" : undefined}
            aria-disabled={blocked || undefined}
            onClick={() => {
              if (selected || blocked) return;
              onSelect(tab.id);
            }}
          >
            <span className="main-menu-icon-wrap">
              <img src={tab.icon} alt="" width={28} height={28} />
              {tab.id === "collection" && dexBadge ? <span className="main-menu-dot" aria-hidden="true" /> : null}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
