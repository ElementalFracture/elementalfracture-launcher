import { useToastState } from "@/lib/toast";
import "./Toast.css";

export function Toast() {
  const state = useToastState();
  if (!state) {
    return <div id="toast" hidden />;
  }
  return (
    <div id="toast" className={state.isError ? "error" : ""} key={state.key}>
      {state.message}
    </div>
  );
}
