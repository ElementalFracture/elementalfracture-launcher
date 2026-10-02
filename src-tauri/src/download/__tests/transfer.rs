//! Tests for `download/transfer.rs`: the resume bookkeeping. The wire itself
//! is exercised against test-env (`update.stall`, `update.size_mb`).

use super::*;

const SHA: &str = "670064fa1048e4225b000509becbb78ccdf96479163226b114c6078c73118bb3";

fn state(total: u64) -> State {
    State {
        url: "https://cdn.example/game/elefracbase.zip".into(),
        total,
        etag: "\"abc-6\"".into(),
        sha256: SHA.into(),
        segments: layout(total),
        complete: false,
    }
}

#[test]
fn small_files_get_one_segment_and_large_ones_six() {
    assert_eq!(layout(1).len(), 1);
    assert_eq!(layout(MIN_SEGMENT * 2 - 1).len(), 1);
    assert_eq!(layout(MIN_SEGMENT * 2).len(), 2);
    assert_eq!(layout(MIN_SEGMENT * 100).len(), SEGMENTS as usize);
}

#[test]
fn a_layout_covers_every_byte_exactly_once() {
    let total = 10 * 1024 * 1024 * 1024 + 12345;
    let segs = layout(total);
    assert_eq!(segs[0].start, 0);
    assert_eq!(segs.last().unwrap().end, total - 1);
    for pair in segs.windows(2) {
        assert_eq!(pair[0].end + 1, pair[1].start);
    }
    assert!(segs.iter().all(|s| s.pos == s.start));
}

#[test]
fn done_sums_progress_across_segments() {
    let mut st = state(MIN_SEGMENT * 4);
    assert_eq!(st.done(), 0);
    st.segments[0].pos = st.segments[0].start + 10;
    st.segments[3].pos = st.segments[3].end + 1;
    assert_eq!(st.done(), 10 + (st.segments[3].end + 1 - st.segments[3].start));
}

#[test]
fn a_state_resumes_only_the_same_object_with_the_same_target() {
    let total = MIN_SEGMENT * 4;
    let st = state(total);
    let url = st.url.clone();
    assert!(st.resumes(&url, total, "\"abc-6\"", SHA, total));
    // The server has a different object now.
    assert!(!st.resumes(&url, total, "\"zzz-1\"", SHA, total));
    assert!(!st.resumes(&url, total + 1, "\"abc-6\"", SHA, total));
    // The manifest wants different bytes.
    assert!(!st.resumes(&url, total, "\"abc-6\"", &"0".repeat(64), total));
    // Another URL altogether, or a payload file that isn't preallocated.
    assert!(!st.resumes("https://cdn.example/other.zip", total, "\"abc-6\"", SHA, total));
    assert!(!st.resumes(&url, total, "\"abc-6\"", SHA, 0));
    // A finished download isn't resumed; it's reused (or re-hashed and dropped).
    let done = State { complete: true, ..st.clone() };
    assert!(!done.resumes(&url, total, "\"abc-6\"", SHA, total));
    // A corrupt position can't be trusted.
    let mut bad = st.clone();
    bad.segments[1].pos = bad.segments[1].end + 2;
    assert!(!bad.resumes(&url, total, "\"abc-6\"", SHA, total));
}

#[test]
fn state_round_trips_through_its_sidecar() {
    let tmp = tempfile::tempdir().unwrap();
    let dest = tmp.path().join("_elefracbase.zip.part");
    assert_eq!(state_path(&dest), tmp.path().join("_elefracbase.zip.part.state"));
    assert!(State::load(&dest).is_none());

    let mut st = state(MIN_SEGMENT * 3);
    st.segments[1].pos += 4096;
    st.save(&dest);
    assert_eq!(State::load(&dest).unwrap(), st);

    fs::write(&dest, b"payload").unwrap();
    discard(&dest);
    assert!(!dest.exists());
    assert!(!state_path(&dest).exists());
}

#[test]
fn a_garbled_sidecar_reads_as_no_state() {
    let tmp = tempfile::tempdir().unwrap();
    let dest = tmp.path().join("x.zip");
    fs::write(state_path(&dest), b"{not json").unwrap();
    assert!(State::load(&dest).is_none());
}

#[test]
fn a_span_places_a_part_inside_the_whole_job() {
    let whole = Span::WHOLE;
    assert_eq!(whole.place(10, 100), (10, 100));
    let third = Span { offset: 2 * 256, total: 1000 };
    assert_eq!(third.place(0, 256), (512, 1000));
    assert_eq!(third.place(256, 256), (768, 1000));
}

#[test]
fn landed_parts_count_only_whole_leading_parts() {
    // Nothing yet, or a torn first part.
    assert_eq!(parts_landed(0, 256, 5), 0);
    assert_eq!(parts_landed(255, 256, 5), 0);
    // Two whole parts and a torn third: keep two.
    assert_eq!(parts_landed(2 * 256 + 17, 256, 5), 2);
    // Everything but the last part is as far as a length can prove.
    assert_eq!(parts_landed(4 * 256 + 100, 256, 5), 4);
    assert_eq!(parts_landed(5 * 256, 256, 5), 4);
    assert_eq!(parts_landed(99 * 256, 256, 5), 4);
    // Degenerate inputs never panic.
    assert_eq!(parts_landed(10, 0, 5), 0);
    assert_eq!(parts_landed(10, 256, 0), 0);
}

#[test]
fn parts_are_staged_beside_the_payload() {
    let dest = Path::new("/x/_elefracbase.zip.part");
    assert_eq!(part_path(dest, 0), PathBuf::from("/x/_elefracbase.zip.part.p0"));
    assert_eq!(part_path(dest, 43), PathBuf::from("/x/_elefracbase.zip.part.p43"));
    // Its state sidecar does not collide with the payload's.
    assert_ne!(state_path(&part_path(dest, 0)), state_path(dest));
}

#[test]
fn part_spans_cover_a_range_exactly_once_in_order() {
    // 10-byte parts, 4 of them (last may be short).
    assert_eq!(part_spans(0, 10, 10, 4), vec![(0, 0, 9)]);
    assert_eq!(part_spans(3, 4, 10, 4), vec![(0, 3, 6)]);
    assert_eq!(part_spans(8, 5, 10, 4), vec![(0, 8, 9), (1, 0, 2)]);
    assert_eq!(part_spans(5, 30, 10, 4), vec![(0, 5, 9), (1, 0, 9), (2, 0, 9), (3, 0, 4)]);
    // A range running past the last part is clipped to the parts that exist.
    assert_eq!(part_spans(35, 20, 10, 4), vec![(3, 5, 9)]);
    assert!(part_spans(40, 5, 10, 4).is_empty());
    // Degenerate inputs never panic.
    assert!(part_spans(0, 0, 10, 4).is_empty());
    assert!(part_spans(0, 5, 0, 4).is_empty());
    assert!(part_spans(0, 5, 10, 0).is_empty());
}

#[test]
fn a_source_without_parts_reads_the_whole_object() {
    let s = ArchiveSource::new("https://cdn.example", "https://cdn.example/game/elefracbase.zip".into(), None);
    assert!(s.parts.is_none());
    assert_eq!(s.url, "https://cdn.example/game/elefracbase.zip");
}

#[test]
fn a_source_with_parts_knows_their_urls() {
    let p = Parts { dir: "game/base".into(), size: 268435456, sha256: vec!["a".repeat(64), "b".repeat(64)] };
    let s = ArchiveSource::new("https://cdn.example", "https://cdn.example/game/elefracbase.zip".into(), Some(&p));
    let (urls, size) = s.parts.as_ref().unwrap();
    assert_eq!(*size, 268435456);
    assert_eq!(urls[1], format!("https://cdn.example/game/base/{}.bin", "b".repeat(64)));
}

#[test]
fn a_fresh_install_has_no_payload_yet_and_appending_must_create_it() {
    // The exact failure of 3.5.0-3.5.3: append-open of a file that does not exist is ENOENT ("os error 2").
    let tmp = tempfile::tempdir().unwrap();
    let dest = tmp.path().join("_elefracbase.zip.part");
    assert!(fs::OpenOptions::new().append(true).open(&dest).is_err());
    // What assemble_parts does now, in order: create (len 0), then append.
    fs::OpenOptions::new().write(true).create(true).open(&dest).unwrap().set_len(0).unwrap();
    fs::OpenOptions::new().append(true).create(true).open(&dest).unwrap().write_all(b"part").unwrap();
    assert_eq!(fs::read(&dest).unwrap(), b"part");
    assert_eq!(parts_landed(fs::metadata(&dest).unwrap().len(), 256, 3), 0);
}
