import { useUI } from "@/context/UIContext";
import { SocialRow } from "./SocialRow";
import "./Footer.css";

export function Footer() {
  const { view } = useUI();

  if (view !== "home") {
    return null;
  }

  return (
    <footer id="footer">
      <SocialRow />
    </footer>
  );
}
