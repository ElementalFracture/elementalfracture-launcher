//! "What's new": the patchnotes RSS feed, parsed by hand. The feed is four
//! tags deep and WordPress-flavoured, which is less code to read than a
//! dependency to keep.

use super::client;
use crate::error::AppResult;
use serde::Serialize;

const FEED_URL: &str = "https://elefrac.com/patchnotes/feed/";

fn feed_url() -> &'static str {
    if cfg!(debug_assertions) {
        "http://localhost:8787/patchnotes/feed/"
    } else {
        FEED_URL
    }
}

#[derive(Serialize, specta::Type)]
pub struct NewsItem {
    pub title: String,
    pub body: String,
    pub date: String,
    pub url: String,
}

/// "What's new" straight from the patchnotes RSS feed on elefrac.com (the WordPress blog).
#[tauri::command]
#[specta::specta]
pub async fn get_news() -> AppResult<Vec<NewsItem>> {
    let xml = client()?
        .get(feed_url())
        .send()
        .await
        .and_then(|r| r.error_for_status())?
        .text()
        .await?;
    Ok(parse_rss(&xml))
}

fn tag_content(block: &str, tag: &str) -> Option<String> {
    let start = block.find(&format!("<{tag}"))?;
    let rest = &block[start..];
    let after = &rest[rest.find('>')? + 1..];
    let inner = &after[..after.find(&format!("</{tag}>"))?];
    let mut text = inner.trim().to_string();
    if let Some(s) = text.strip_prefix("<![CDATA[") {
        text = s.strip_suffix("]]>").unwrap_or(s).trim().to_string();
    }
    Some(decode_entities(&text))
}

/// Decode HTML entities in RSS text. WordPress emits typographic characters as
/// NUMERIC references (`&#8211;` en-dash, `&#8217;` apostrophe, curly quotes,
/// `&#8230;` ellipsis) which the old fixed `&amp;/&lt;/…` list left raw, so they
/// showed up literally in the "What's new" cards. This handles decimal and hex
/// numeric refs plus the common named ones, left to right so nothing double-
/// decodes; an unrecognised `&…;` is left untouched.
fn decode_entities(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut rest = s;
    while let Some(amp) = rest.find('&') {
        out.push_str(&rest[..amp]);
        let tail = &rest[amp..];
        // Entities are short; only look a little way ahead for the ';'.
        let decoded = tail.get(..tail.len().min(12)).and_then(|w| w.find(';')).and_then(|semi| {
            let ent = &tail[1..semi];
            let ch = if let Some(hex) = ent.strip_prefix("#x").or_else(|| ent.strip_prefix("#X")) {
                u32::from_str_radix(hex, 16).ok().and_then(char::from_u32)
            } else if let Some(dec) = ent.strip_prefix('#') {
                dec.parse::<u32>().ok().and_then(char::from_u32)
            } else {
                match ent {
                    "amp" => Some('&'),
                    "lt" => Some('<'),
                    "gt" => Some('>'),
                    "quot" => Some('"'),
                    "apos" => Some('\''),
                    "nbsp" => Some('\u{00A0}'),
                    "ndash" => Some('\u{2013}'),
                    "mdash" => Some('\u{2014}'),
                    "hellip" => Some('\u{2026}'),
                    "lsquo" => Some('\u{2018}'),
                    "rsquo" => Some('\u{2019}'),
                    "ldquo" => Some('\u{201C}'),
                    "rdquo" => Some('\u{201D}'),
                    _ => None,
                }
            };
            ch.map(|c| (c, semi))
        });
        match decoded {
            Some((c, semi)) => {
                out.push(c);
                rest = &tail[semi + 1..];
            }
            None => {
                out.push('&');
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    out
}

// "Sun, 24 Aug 2025 00:00:00 GMT" → "24 Aug 2025"
fn format_date(d: String) -> String {
    let parts: Vec<&str> = d.split_whitespace().collect();
    if parts.len() >= 4 {
        format!("{} {} {}", parts[1], parts[2], parts[3])
    } else {
        d
    }
}

fn parse_rss(xml: &str) -> Vec<NewsItem> {
    xml.split("<item>")
        .skip(1)
        .filter_map(|chunk| {
            let block = chunk.split("</item>").next()?;
            Some(NewsItem {
                title: tag_content(block, "title")?,
                body: tag_content(block, "description").unwrap_or_default(),
                date: tag_content(block, "pubDate").map(format_date).unwrap_or_default(),
                url: tag_content(block, "link").unwrap_or_default(),
            })
        })
        .take(8)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Exactly what test-env/server.mjs answers `/patchnotes/feed/` with, so a
    /// change to that fixture's shape fails here rather than showing up as an
    /// empty news row in a dev session.
    const TEST_ENV_FEED: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Elemental Fracture — test env</title>
    <link>http://localhost:8787/patchnotes/</link>
    <description>Patch notes served by the test env.</description>
    <item>
      <title><![CDATA[Patch 6.0.3 — Frost rework]]></title>
      <link><![CDATA[https://elefrac.com/patchnotes/6-0-3]]></link>
      <pubDate><![CDATA[Mon, 01 Sep 2026 18:00:00 +0000]]></pubDate>
      <description><![CDATA[Frostbite stacks fall off faster.]]></description>
    </item>
  </channel>
</rss>
"#;

    #[test]
    fn parses_the_test_env_feed() {
        let items = parse_rss(TEST_ENV_FEED);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "Patch 6.0.3 — Frost rework");
        assert_eq!(items[0].body, "Frostbite stacks fall off faster.");
        assert_eq!(items[0].url, "https://elefrac.com/patchnotes/6-0-3");
        // RFC-822 in, the short form the card shows out.
        assert_eq!(items[0].date, "01 Sep 2026");
    }

    /// An empty `news` list is a feed with no `<item>` at all — the home view's
    /// empty state, and the reason the row must not treat it as a failure.
    #[test]
    fn an_empty_feed_is_no_news_rather_than_an_error() {
        let empty = TEST_ENV_FEED
            .split("    <item>")
            .next()
            .unwrap()
            .to_string()
            + "  </channel>\n</rss>\n";
        assert!(parse_rss(&empty).is_empty());
    }

    /// The debug default is what points a dev session at the dashboard.
    #[test]
    fn debug_builds_read_news_from_the_test_env() {
        if cfg!(debug_assertions) {
            assert_eq!(feed_url(), "http://localhost:8787/patchnotes/feed/");
        } else {
            assert_eq!(feed_url(), FEED_URL);
        }
    }
}
