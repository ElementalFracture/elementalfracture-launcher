import { useState } from "react";
import { Card, CardContent } from "@/components/shadcn/card";
import { Switch } from "@/components/shadcn/switch";
import { AdvancedWarnModal } from "@/components/modals/AdvancedWarnModal";
import { InfoPopover } from "@/components/InfoPopover";

/** The gate in front of the Advanced panel: a switch behind a warning dialog. */
export function AdvancedToggleCard({
  shown,
  onShownChange,
}: {
  shown: boolean;
  onShownChange: (v: boolean) => void;
}) {
  const [warnOpen, setWarnOpen] = useState(false);

  const onToggle = (checked: boolean) => {
    if (checked) {
      setWarnOpen(true);
    } else {
      onShownChange(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="switch-row">
          <span className="switch-text">
            <span>Show advanced options</span>
            <InfoPopover>
              <p>
                Reveals developer and debug settings: launch wrapper, Wine
                prefix, and the CDN / auth / players URLs. Only change these if
                you know what you’re doing.
              </p>
            </InfoPopover>
          </span>
          {/* Reads as on while the warning is up; Back turns it off again. */}
          <Switch
            aria-label="Show advanced options"
            checked={shown || warnOpen}
            onCheckedChange={onToggle}
          />
        </div>
      </CardContent>

      <AdvancedWarnModal
        open={warnOpen}
        onContinue={() => {
          setWarnOpen(false);
          onShownChange(true);
        }}
        onBack={() => {
          setWarnOpen(false);
          onShownChange(false);
        }}
      />
    </Card>
  );
}
