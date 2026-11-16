import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as rust from "@/lib/rust";
import type { EventItem, NewsItem, PlayersData } from "@/lib/rust";

interface LiveDataContextValue {
  playersData: PlayersData | null;
  events: EventItem[] | null;
  news: NewsItem[];
  refreshPlayers: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  refreshNews: () => Promise<void>;
}

const NEWS_POLL_MS = import.meta.env.DEV ? 60_000 : 300_000;
const EVENTS_POLL_MS = import.meta.env.DEV ? 60_000 : 300_000;

const LiveDataContext = createContext<LiveDataContextValue | null>(null);

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [playersData, setPlayersData] = useState<PlayersData | null>(null);
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);

  const refreshPlayers = useCallback(async () => {
    try {
      setPlayersData(await rust.getPlayers());
    } catch {
      setPlayersData(null);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      setEvents(await rust.getEvents());
    } catch {
      setEvents(null);
    }
  }, []);

  const refreshNews = useCallback(async () => {
    try {
      setNews(await rust.getNews());
    } catch {
      setNews([]);
    }
  }, []);

  // One-time startup fetch — deliberately runs only on mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    refreshNews();
    refreshPlayers();
    refreshEvents();
    const playersInterval = setInterval(refreshPlayers, 60_000);
    const eventsInterval = setInterval(refreshEvents, EVENTS_POLL_MS);
    const newsInterval = setInterval(refreshNews, NEWS_POLL_MS);
    return () => {
      clearInterval(playersInterval);
      clearInterval(eventsInterval);
      clearInterval(newsInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const value: LiveDataContextValue = {
    playersData,
    events,
    news,
    refreshPlayers,
    refreshEvents,
    refreshNews,
  };
  return (
    <LiveDataContext.Provider value={value}>
      {children}
    </LiveDataContext.Provider>
  );
}

export function useLiveData() {
  const ctx = useContext(LiveDataContext);
  if (!ctx) {
    throw new Error("useLiveData must be used within a LiveDataProvider");
  }
  return ctx;
}
