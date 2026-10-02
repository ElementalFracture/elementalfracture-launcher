//! Tests for `download/manifest.rs`.

use super::*;
use ed25519_dalek::{Signer, SigningKey};

const JSON: &[u8] = br#"{"version":1757500000,"released_at":"2026-09-10T00:00:00Z","launcher_version":"3.1.1","files":{"patch/latest.zip":"670064fa1048e4225b000509becbb78ccdf96479163226b114c6078c73118bb3"}}"#;

fn keypair(seed: u8) -> (SigningKey, [u8; 32]) {
    let sk = SigningKey::from_bytes(&[seed; 32]);
    let pk = sk.verifying_key().to_bytes();
    (sk, pk)
}

#[test]
fn a_manifest_signed_by_a_trusted_key_parses() {
    let (sk, pk) = keypair(7);
    let sig = sk.sign(JSON).to_bytes();
    let m = parse_verified(JSON, &sig, &[pk]).unwrap();
    assert_eq!(m.version, 1757500000);
    assert_eq!(m.launcher_version, "3.1.1");
    assert_eq!(
        m.hash_for("patch/latest.zip").unwrap(),
        "670064fa1048e4225b000509becbb78ccdf96479163226b114c6078c73118bb3"
    );
}

#[test]
fn any_key_in_the_list_is_enough() {
    let (old, old_pk) = keypair(1);
    let (_new, new_pk) = keypair(2);
    let sig = old.sign(JSON).to_bytes();
    assert!(parse_verified(JSON, &sig, &[new_pk, old_pk]).is_ok());
}

#[test]
fn a_tampered_document_is_refused_before_it_is_parsed() {
    let (sk, pk) = keypair(7);
    let sig = sk.sign(JSON).to_bytes();
    let mut forged = JSON.to_vec();
    let at = forged.windows(4).position(|w| w == b"6700").unwrap();
    forged[at] = b'7';
    let err = parse_verified(&forged, &sig, &[pk]).unwrap_err();
    assert_eq!(err.code, ErrorCode::ManifestSignatureInvalid);
}

#[test]
fn an_untrusted_key_is_refused() {
    let (stranger, _) = keypair(9);
    let (_, pk) = keypair(7);
    let sig = stranger.sign(JSON).to_bytes();
    let err = parse_verified(JSON, &sig, &[pk]).unwrap_err();
    assert_eq!(err.code, ErrorCode::ManifestSignatureInvalid);
}

#[test]
fn a_short_or_missing_signature_is_refused() {
    let (_, pk) = keypair(7);
    assert!(parse_verified(JSON, &[], &[pk]).is_err());
    assert!(parse_verified(JSON, &[0u8; 63], &[pk]).is_err());
}

#[test]
fn a_payload_without_an_entry_fails_by_name() {
    let (sk, pk) = keypair(7);
    let sig = sk.sign(JSON).to_bytes();
    let m = parse_verified(JSON, &sig, &[pk]).unwrap();
    let err = m.hash_for("patch/mod/mod.zip").unwrap_err();
    assert_eq!(err.code, ErrorCode::ManifestMissingFile);
    assert_eq!(err.params["file"], "patch/mod/mod.zip");
}

#[test]
fn a_malformed_hash_counts_as_missing() {
    let (sk, pk) = keypair(7);
    let json = br#"{"version":1,"files":{"a":"deadbeef"}}"#;
    let sig = sk.sign(json).to_bytes();
    let m = parse_verified(json, &sig, &[pk]).unwrap();
    assert_eq!(m.hash_for("a").unwrap_err().code, ErrorCode::ManifestMissingFile);
}

#[test]
fn sha256_hex_matches_a_known_vector() {
    assert_eq!(
        sha256_hex(b"abc"),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
}

const PARTS_JSON: &[u8] = br#"{"version":2,"files":{"game/elefracbase.zip":"670064fa1048e4225b000509becbb78ccdf96479163226b114c6078c73118bb3","game/base/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bin":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"parts":{"game/elefracbase.zip":{"dir":"game/base/","size":268435456,"sha256":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]}}}"#;

#[test]
fn a_manifest_without_parts_still_parses_and_offers_none() {
    let (sk, pk) = keypair(7);
    let sig = sk.sign(JSON).to_bytes();
    let m = parse_verified(JSON, &sig, &[pk]).unwrap();
    assert!(m.parts.is_empty());
    assert!(m.parts_for("patch/latest.zip").is_none());
}

#[test]
fn parts_are_listed_in_order_and_name_their_objects() {
    let (sk, pk) = keypair(7);
    let sig = sk.sign(PARTS_JSON).to_bytes();
    let m = parse_verified(PARTS_JSON, &sig, &[pk]).unwrap();
    let p = m.parts_for("game/elefracbase.zip").expect("parts listed");
    assert_eq!(p.size, 268435456);
    assert_eq!(p.sha256.len(), 2);
    // The trailing slash in `dir` is tolerated, the object name is the hash.
    assert_eq!(p.path(0), format!("game/base/{}.bin", "a".repeat(64)));
    assert_eq!(p.path(1), format!("game/base/{}.bin", "b".repeat(64)));
    // Each part is also an ordinary payload, so its download is hash-checked like any other.
    assert_eq!(m.hash_for(&p.path(0)).unwrap(), "a".repeat(64));
    // The whole object keeps its own entry: the reassembled file must match it.
    assert!(m.hash_for("game/elefracbase.zip").is_ok());
}

#[test]
fn a_malformed_part_list_counts_as_no_parts() {
    let (sk, pk) = keypair(7);
    for bad in [
        r#"{"dir":"game/base","size":0,"sha256":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]}"#,
        r#"{"dir":"game/base","size":1,"sha256":[]}"#,
        r#"{"dir":"","size":1,"sha256":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]}"#,
        r#"{"dir":"game/base","size":1,"sha256":["nothex"]}"#,
    ] {
        let json = format!(r#"{{"version":3,"files":{{}},"parts":{{"game/elefracbase.zip":{bad}}}}}"#);
        let sig = sk.sign(json.as_bytes()).to_bytes();
        let m = parse_verified(json.as_bytes(), &sig, &[pk]).unwrap();
        assert!(m.parts_for("game/elefracbase.zip").is_none(), "{bad}");
    }
}
