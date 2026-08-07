import { useLiveData } from "@/context/LiveDataContext";
import { openLink } from "@/lib/links";

/** The "What's new" strip: the latest posts from the portal. */
export function NewsRow() {
  const { news } = useLiveData();

  return (
    <>
      <div className="row-head">
        <h3>What’s new</h3>
      </div>
      <div className="cards">
        {news.slice(0, 6).map((item, i) => (
          <div
            key={i}
            className="card"
            onClick={() => item.url && openLink(item.url)}
          >
            <h4>{item.title ?? ""}</h4>
            <p>{item.body ?? ""}</p>
            <span className="date">{item.date ?? ""}</span>
          </div>
        ))}
      </div>
    </>
  );
}
