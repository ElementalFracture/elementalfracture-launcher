import type { ComponentProps } from "react";
import "./LaunchPlate.css";

/** The plate is a fixed-width piece of art, so the label has to fit it rather
    than the other way round. Two steps down is enough for every label the
    catalogue holds: "Launch" (6) sits at full size, "Updating" (8) and
    "Mise à jour" (11) at the middle one, "Mettre à jour" (13) at the smallest. */
function labelSize(label: string) {
  if (label.length > 11) {
    return " longest";
  }
  return label.length > 7 ? " long" : "";
}

export function LaunchPlate({
  label,
  className,
  ...rest
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      className={"launch-plate" + (className ? " " + className : "")}
      {...rest}
    >
      <span className={"launch-plate-label" + labelSize(label)}>{label}</span>
    </button>
  );
}
