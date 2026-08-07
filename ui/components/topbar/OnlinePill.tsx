import { useLiveData } from "@/context/LiveDataContext";
import { PlayersIcon } from "@/assets/icons/PlayersIcon";

/**
 * How many players the sidecar sees connected. Falls back to the in-game
 * figure while the connected count is missing, so the pill still reads.
 */
export function OnlinePill() {
  const { playersData } = useLiveData();

  const connected = Number.isFinite(playersData?.connected)
    ? (playersData!.connected as number)
    : null;
  const inGame = Number.isFinite(playersData?.online)
    ? (playersData!.online as number)
    : null;

  return (
    <div className="pill" title="Players connected to the server">
      <PlayersIcon className="pill-icon" />
      <div className="pill-text">
        <strong>{connected ?? inGame ?? "–"}</strong>
        <small>online</small>
      </div>
    </div>
  );
}
