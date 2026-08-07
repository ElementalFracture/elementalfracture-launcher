import { useProgress } from "@/context/ProgressContext";
import { stageLabel } from "./format";
import "./InstallProgress.css";

/** The download/patch bar. Renders nothing while no pipeline is running. */
export function InstallProgress() {
  const progress = useProgress();
  if (!progress) {
    return null;
  }

  return (
    <div className="progress">
      <div className="progress-head">
        <span>{stageLabel(progress.stage)}</span>
        <span>{progress.message ?? ""}</span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${Math.max(0, Math.min(100, progress.percent)).toFixed(1)}%`,
          }}
        />
      </div>
    </div>
  );
}
