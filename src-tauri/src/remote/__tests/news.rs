//! Tests for `remote/news.rs`.

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

/// WordPress writes typographic characters as NUMERIC references, which the
/// old fixed `&amp;/&lt;` list left raw in the cards.
#[test]
fn numeric_entities_decode_the_way_wordpress_writes_them() {
    assert_eq!(decode_entities("Frost &#8211; rework"), "Frost \u{2013} rework");
    assert_eq!(decode_entities("it&#8217;s"), "it\u{2019}s");
    assert_eq!(decode_entities("wait&#x2026;"), "wait\u{2026}");
    assert_eq!(decode_entities("&amp;&lt;&gt;&quot;"), "&<>\"");
}

/// Left to right, once: the `&` an `&amp;` produces must not start a second
/// round of decoding on what follows it.
#[test]
fn nothing_double_decodes() {
    assert_eq!(decode_entities("&amp;#8211;"), "&#8211;");
}

/// A stray ampersand is ordinary text in a patch note, not a broken entity.
#[test]
fn an_unrecognised_entity_is_left_exactly_as_it_came_in() {
    assert_eq!(decode_entities("&notanentity;"), "&notanentity;");
    assert_eq!(decode_entities("100% & rising"), "100% & rising");
    assert_eq!(decode_entities("A & B &amp; C"), "A & B & C");
}

#[test]
fn rfc_822_dates_shorten_to_what_the_card_shows() {
    assert_eq!(format_date("Mon, 01 Sep 2026 18:00:00 +0000".into()), "01 Sep 2026");
    // Anything not in that shape is passed through rather than mangled.
    assert_eq!(format_date("soon".into()), "soon");
}

#[test]
fn tag_content_unwraps_cdata_and_tolerates_attributes() {
    assert_eq!(tag_content("<title>Plain</title>", "title").as_deref(), Some("Plain"));
    assert_eq!(
        tag_content("<title><![CDATA[Wrapped]]></title>", "title").as_deref(),
        Some("Wrapped")
    );
    assert_eq!(
        tag_content(r#"<link rel="alternate">https://x</link>"#, "link").as_deref(),
        Some("https://x")
    );
    assert_eq!(tag_content("<title>x</title>", "pubDate"), None);
}

/// An item with no <title> is dropped rather than shown as a blank card,
/// but a missing body or link is just an empty field.
#[test]
fn an_item_needs_a_title_and_nothing_else() {
    let feed = "<item><description>body only</description></item>\
                <item><title>Kept</title></item>";
    let items = parse_rss(feed);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].title, "Kept");
    assert_eq!(items[0].body, "");
    assert_eq!(items[0].url, "");
}

/// The row shows a handful of cards; the feed is not allowed to decide how
/// many.
#[test]
fn the_feed_is_capped_at_eight_items() {
    let feed = "<item><title>t</title></item>".repeat(20);
    assert_eq!(parse_rss(&feed).len(), 8);
}
