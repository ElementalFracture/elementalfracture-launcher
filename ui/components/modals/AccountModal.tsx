import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { useSettings } from "@/context/SettingsContext";
import { openLink } from "@/lib/links";
import { toast } from "@/lib/toast";
import "./Dialog.css";

const DISCORD_URL = "https://dsc.gg/elefrac";

export function AccountModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { applyToken } = useSettings();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      toast("Paste your token first.", true);
      return;
    }
    setSaving(true);
    try {
      const res = await applyToken(trimmed);
      if (res.verified && res.username) {
        const badge = res.is_dev ? " (dev)" : res.is_staff ? " (staff)" : "";
        toast(`Welcome, ${res.username}${badge}! Token saved.`);
      } else {
        toast(res.warning ?? "Token saved.", true);
      }
      setToken("");
      onOpenChange(false);
    } catch (e) {
      toast(String(e), true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setToken("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="wizard-panel"
        showCloseButton={false}
        showOverlay={false}
      >
        <div className="wizard-step">
          <h2>Please enter your auth token</h2>
          <p className="muted">
            Identifies you on Elemental Fracture. Only change this token when
            rotated by either yourself on Discord or by a mod.
          </p>
          <Input
            type="password"
            placeholder="Paste your token…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <p className="wizard-tooltip">
            Don’t have a token?{" "}
            <a onClick={() => openLink(DISCORD_URL)}>Join the Discord</a> to get
            one.
          </p>
          <div className="wizard-actions">
            <Button disabled={saving} onClick={save}>
              Save
            </Button>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
