//! Tests for `error.rs`.

use super::*;

/// `ui/i18n/errors.ts` switches on these exact strings, so the camelCase
/// rename is part of the contract with the frontend, not styling.
#[test]
fn codes_serialise_as_the_camel_case_the_catalogue_switches_on() {
    assert_eq!(serde_json::to_string(&ErrorCode::NoGameFolder).unwrap(), "\"noGameFolder\"");
    assert_eq!(serde_json::to_string(&ErrorCode::PaksNotFound).unwrap(), "\"paksNotFound\"");
    assert_eq!(serde_json::to_string(&ErrorCode::Io).unwrap(), "\"io\"");
}

#[test]
fn params_ride_along_beside_the_code() {
    let err = AppError::new(ErrorCode::PaksNotFound)
        .with("path", "/games/ef")
        .with("count", 3);
    let v = serde_json::to_value(&err).unwrap();
    assert_eq!(v["code"], "paksNotFound");
    assert_eq!(v["params"]["path"], "/games/ef");
    // Anything Display-able becomes a string — the catalogue interpolates text.
    assert_eq!(v["params"]["count"], "3");
}

/// A code that says everything on its own carries no params, and the
/// frontend must still get the key rather than a missing field.
#[test]
fn a_bare_code_still_serialises_its_empty_params() {
    let v = serde_json::to_value(AppError::new(ErrorCode::NoGameFolder)).unwrap();
    assert_eq!(v["params"], serde_json::json!({}));
}

/// Pass-through failures keep the library's own words under `detail`, which
/// is all we have to show for them.
#[test]
fn a_pass_through_failure_keeps_the_underlying_words() {
    let io = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
    let err: AppError = io.into();
    assert_eq!(err.code, ErrorCode::Io);
    assert_eq!(err.params.get("detail").map(String::as_str), Some("access denied"));
}

/// Round-trips, because the same type is deserialised on the way back in.
#[test]
fn an_error_survives_a_round_trip() {
    let err = AppError::new(ErrorCode::VariantPakMissing).with("pak", "ElefracBalance_P.pak");
    let back: AppError = serde_json::from_str(&serde_json::to_string(&err).unwrap()).unwrap();
    assert_eq!(back.code, ErrorCode::VariantPakMissing);
    assert_eq!(back.params, err.params);
}
