import { useLiveData } from "@/context/LiveDataContext";
import { openLink } from "@/lib/links";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/shadcn/carousel";
import { _ } from "@/i18n";
import "./NewsRow.css";

/** The "What's new" strip: the latest posts from the portal, three at a time. */
export function NewsRow() {
  const { news } = useLiveData();

  if (news.length === 0) {
    return (
      <>
        <div className="row-head">
          <h3>{_("home.news.title")}</h3>
        </div>
        <p className="row-empty">{_("home.news.empty")}</p>
      </>
    );
  }

  return (
    <Carousel
      className="news-carousel"
      opts={{ align: "start", slidesToScroll: 3 }}
    >
      <div className="row-head news-head">
        <h3>{_("home.news.title")}</h3>
        <div className="news-nav">
          <CarouselPrevious className="static inset-auto m-0" />
          <CarouselNext className="static inset-auto m-0" />
        </div>
      </div>
      <CarouselContent className="-ml-3.5">
        {news.map((item, i) => (
          <CarouselItem key={i} className="basis-1/3 pl-3.5">
            <div
              className="card news-card"
              onClick={() => item.url && openLink(item.url)}
            >
              <h4>{item.title ?? ""}</h4>
              <p>{item.body ?? ""}</p>
              <span className="date">{item.date ?? ""}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
}
