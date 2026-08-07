import { openLink } from "@/lib/links";
import "./SocialRow.css";

const LINKS = {
  discord: "https://dsc.gg/elefrac",
  donate: "https://patreon.com/elementalfracture",
  patchnotes: "https://docs.elefrac.com/patchnotes",
  x: "https://x.com/elefracture",
  twitch: "https://twitch.tv/elementalfracture",
  youtube: "https://youtube.com/@elementalfracture",
};

/** The footer strip of image buttons out to the community's other homes. */
export function SocialRow() {
  return (
    <div className="social-row">
      <button
        className="img-btn h42 social-discord"
        onClick={() => openLink(LINKS.discord)}
        aria-label="Discord"
      />
      <button
        className="img-btn h42 social-donate"
        onClick={() => openLink(LINKS.donate)}
        aria-label="Donate"
      />
      <button
        className="img-btn h34 social-patchnotes"
        onClick={() => openLink(LINKS.patchnotes)}
        aria-label="Patch notes"
      />
      <button
        className="img-btn h34 social-x"
        onClick={() => openLink(LINKS.x)}
        aria-label="X"
      />
      <button
        className="img-btn h34 social-twitch"
        onClick={() => openLink(LINKS.twitch)}
        aria-label="Twitch"
      />
      <button
        className="img-btn h34 social-youtube"
        onClick={() => openLink(LINKS.youtube)}
        aria-label="YouTube"
      />
    </div>
  );
}
