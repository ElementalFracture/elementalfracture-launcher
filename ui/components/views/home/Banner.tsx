import { useGame } from "@/context/GameContext";
import { HeroArt } from "./HeroArt";
import { InstallPanel } from "./InstallPanel";
import { InstallProgress } from "./InstallProgress";
import { LaunchPanel } from "./LaunchPanel";
import { useVariantTheme } from "./useVariantTheme";
import "./Banner.css";

/** The banner at the top of Home: rotating art, variant-tinted copy, and
    whichever call to action the install state calls for. */
export function Banner() {
  const { status } = useGame();
  const { copy, fadeClass } = useVariantTheme(status?.variant);

  return (
    <div className="banner">
      <HeroArt />
      <div className="banner-shade" aria-hidden="true" />
      <div className="banner-text">
        <span className={"eyebrow" + fadeClass}>{copy.eyebrow}</span>
        <h3 className={fadeClass.trim()}>{copy.title}</h3>
        <p className={fadeClass.trim()}>{copy.sub}</p>

        {status?.exe_present ? <LaunchPanel /> : <InstallPanel />}

        <InstallProgress />
      </div>
    </div>
  );
}
