import type { ComponentProps } from "react";
import "./LaunchPlate.css";

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
      <span
        className={"launch-plate-label" + (label.length > 7 ? " long" : "")}
      >
        {label}
      </span>
    </button>
  );
}
