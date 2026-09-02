import { useLiveData } from "@/context/LiveDataContext";
import { openLink } from "@/lib/links";
import { formatEventTime } from "./format";
import { _ } from "@/i18n";
import "./EventRow.css";

/** Community events pulled from the portal. Hidden entirely when there are none. */
export function EventRow() {
  const { events } = useLiveData();
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <>
      <div className="row-head">
        <h3>{_("home.events.title")}</h3>
      </div>
      <div className="cards">
        {events.slice(0, 4).map((ev, i) => (
          <div
            key={i}
            className="card event-card"
            onClick={() => ev.url && openLink(ev.url)}
          >
            <h4>{ev.name ?? ""}</h4>
            <span
              className={"event-time" + (ev.status === "ACTIVE" ? " live" : "")}
            >
              {formatEventTime(ev)}
            </span>
            <p>{ev.description ?? ""}</p>
            <span className="date">
              {[
                ev.location,
                ev.interested
                  ? _("home.events.interested", { count: ev.interested })
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
