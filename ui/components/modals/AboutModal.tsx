import { Heart } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { useGame } from "@/context/GameContext";
import { openLink } from "@/lib/links";
import { URLS } from "@/lib/urls";
import "./Dialog.css";

const LEGAL_LINKS: { label: string; url: string }[] = [
  { label: "Privacy Policy", url: URLS.privacy },
  { label: "Terms of Service", url: URLS.terms },
  { label: "Legal & Fair Use", url: URLS.legalStatus },
];

/* Left in English on purpose: the disclaimers are a legal position, not copy,
   and a reworded one is a different claim. */
export function AboutModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { launcherInfo } = useGame();
  // The startup update check already fetched this; if it couldn't reach the
  // server there is no version to show and the line is simply left out.
  const version = launcherInfo?.current;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="wizard-panel"
        showCloseButton={false}
        showOverlay={false}
      >
        <div className="wizard-step about-step">
          <h2>Elemental Fracture Launcher</h2>
          {version && <p className="about-version">v{version}</p>}
          <p className="about-legal">
            Elemental Fracture is a community-driven preservation project
            operating under the principles of Fair Use to keep the online
            services of Spellbreak® alive, originally developed by Proletariat,
            Inc., now a subsidiary of Blizzard Entertainment.
          </p>
          <p className="about-legal">
            Not affiliated with or endorsed by Proletariat, Inc. Everyone
            involved is a volunteer and receives no financial compensation;
            donations only cover the website, game servers and CDN.
          </p>
          {/* Just the links: Dialog.css puts the dot between them. */}
          <p className="about-links">
            {LEGAL_LINKS.map((link) => (
              <a
                key={link.url}
                href={link.url}
                onClick={(e) => {
                  e.preventDefault();
                  openLink(link.url);
                }}
              >
                {link.label}
              </a>
            ))}
          </p>
          <div className="wizard-actions">
            <Button onClick={onClose}>Close</Button>
          </div>
          {/* JSX drops the newlines between these, so the heart's own margin
              is the only thing spacing the sentence. */}
          <p className="about-made">
            Made with
            <Heart className="about-heart" role="img" aria-label="love" />
            by Doobs &amp; Lytion
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
