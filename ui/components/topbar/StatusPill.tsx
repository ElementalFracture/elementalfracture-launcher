import { useGame } from "@/context/GameContext";

/** Install state of the game itself: presence dot plus the local version. */
export function StatusPill() {
  const { status } = useGame();

  const installed = Boolean(status?.exe_present);
  const dotClass = !status?.game_path || !installed ? "dot" : "dot ok";
  const stateText = !status?.game_path
    ? "Not installed"
    : !installed
      ? "Not found"
      : status.local_version
        ? `v${status.local_version}`
        : "Installed";

  return (
    <div className="pill">
      <span className={dotClass} />
      <div className="pill-text">
        <strong>Spellbreak</strong>
        <small>{stateText}</small>
      </div>
    </div>
  );
}
