import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as rust from "@/lib/rust";
import type { EventItem, NewsItem, PlayersData } from "@/lib/rust";

/** Shown when the patchnotes feed isn't reachable. */
const FALLBACK_NEWS: NewsItem[] = [
  {
    title: "Launcher 1.0",
    body: "The launcher has been rewritten from scratch: one app now handles installing, patching, tokens and launching, on Windows and Linux.",
    date: "18 Jul 2026",
    url: "https://docs.elefrac.com/patchnotes",
  },
];

interface LiveDataContextValue {
  playersData: PlayersData | null;
  events: EventItem[] | null;
  news: NewsItem[];
  refreshPlayers: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  refreshNews: () => Promise<void>;
}

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
      const items = await rust.getNews();
      setNews(items.length > 0 ? items : FALLBACK_NEWS);
    } catch {
      setNews(FALLBACK_NEWS);
    }
  }, []);

  // One-time startup fetch — deliberately runs only on mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    refreshNews();
    refreshPlayers();
    refreshEvents();
    const playersInterval = setInterval(refreshPlayers, 60_000);
    const eventsInterval = setInterval(refreshEvents, 300_000);
    return () => {
      clearInterval(playersInterval);
      clearInterval(eventsInterval);
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
  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>;
}

export function useLiveData() {
  const ctx = useContext(LiveDataContext);
  if (!ctx) {
    throw new Error("useLiveData must be used within a LiveDataProvider");
  }
  return ctx;
}
