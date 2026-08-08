import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { useSettings } from "@/context/SettingsContext";
import { toast } from "@/lib/toast";

/** Token entry. Two-step, because a saved token is write-only from then on. */
export function AuthTokenCard() {
  const { settings, applyToken } = useSettings();

  const [token, setToken] = useState("");
  const [tokenConfirm, setTokenConfirm] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenLine, setTokenLine] = useState<string | null>(null);

  const signedInLine = settings?.auth_token?.trim()
    ? `Signed in as ${settings.username?.trim() || "you"}.`
    : "No token set yet.";

  /* Two-step entry: the token is write-only once saved, so a typo would
     otherwise only surface as a failed launch. */
  const onSaveToken = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      toast("Enter your token.", true);
      return;
    }
    if (trimmed !== tokenConfirm.trim()) {
      toast("Tokens don’t match.", true);
      setTokenLine("The two tokens don’t match — re-enter to confirm.");
      return;
    }
    setTokenBusy(true);
    try {
      const res = await applyToken(trimmed);
      if (res.verified && res.username) {
        const badge = res.is_dev ? " (dev)" : res.is_staff ? " (staff)" : "";
        toast(`Welcome, ${res.username}${badge}! Token saved.`);
        setTokenLine(`Signed in as ${res.username}${badge}.`);
      } else {
        toast(res.warning ?? "Token saved.", true);
        setTokenLine(res.warning ?? "Token saved (could not verify).");
      }
      setToken("");
      setTokenConfirm("");
    } catch (e) {
      toast(String(e), true);
      setTokenLine(String(e));
    } finally {
      setTokenBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auth token</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="muted">
          Identifies you on Elemental Fracture. Only change this token when
          rotated by either yourself on Discord or by a mod.
        </p>
        <div className="field">
          <Label htmlFor="auth-token">Token</Label>
          <Input
            id="auth-token"
            type="password"
            placeholder="Paste your token…"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <div className="field">
          <Label htmlFor="auth-token-confirm">Confirm token</Label>
          <Input
            id="auth-token-confirm"
            type="password"
            placeholder="Re-enter your token…"
            autoComplete="off"
            spellCheck={false}
            value={tokenConfirm}
            onChange={(e) => setTokenConfirm(e.target.value)}
          />
        </div>
        <div className="panel-actions">
          <Button disabled={tokenBusy} onClick={onSaveToken}>
            {tokenBusy ? "Saving…" : "Save token"}
          </Button>
        </div>
        <div className="muted">{tokenLine ?? signedInLine}</div>
      </CardContent>
    </Card>
  );
}
