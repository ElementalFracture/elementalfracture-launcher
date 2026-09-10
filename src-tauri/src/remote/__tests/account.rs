//! Tests for `remote/account.rs`.

use super::*;

/// An older auth server sends no `is_tester` at all. Absent has to read as
/// "not a tester", never as a refusal.
#[test]
fn missing_role_flags_read_as_false() {
    let body = serde_json::json!({ "ok": true, "is_staff": true });
    let account = read_account(&body, "vex");
    assert_eq!(account.username, "vex");
    assert!(account.is_staff);
    assert!(!account.is_dev);
    assert!(!account.is_tester);
}

#[test]
fn every_role_flag_is_read_off_the_body() {
    let body = serde_json::json!({ "is_staff": true, "is_dev": true, "is_tester": true });
    let account = read_account(&body, "vex");
    assert!(account.is_staff && account.is_dev && account.is_tester);
}

/// A human end date is what the sentence needs; without one there is
/// nothing to put in "suspended until …".
#[test]
fn a_timed_suspension_carries_its_end_date() {
    let err = suspension_error(&serde_json::json!({
        "error": "banned",
        "ends": "3 Sep 2026",
        "expires_at": 1_788_000_000i64,
    }));
    assert_eq!(err.code, ErrorCode::AccountSuspendedUntil);
    assert_eq!(err.params.get("ends").map(String::as_str), Some("3 Sep 2026"));
}

/// A timestamp with no human date still isn't permanent — it just can't be
/// put in a sentence, so it falls back to the plain code.
#[test]
fn an_expiry_with_no_date_is_suspended_but_not_permanent() {
    let err = suspension_error(&serde_json::json!({ "expires_at": 1_788_000_000i64 }));
    assert_eq!(err.code, ErrorCode::AccountSuspended);
    assert_eq!(err.params.get("permanent").map(String::as_str), Some("false"));
}

#[test]
fn no_expiry_at_all_is_permanent() {
    let err = suspension_error(&serde_json::json!({ "error": "banned" }));
    assert_eq!(err.code, ErrorCode::AccountSuspended);
    assert_eq!(err.params.get("permanent").map(String::as_str), Some("true"));
}

/// The catalogue appends the reason when there is one — and "banned" as a
/// reason for a ban says nothing, so it is left off.
#[test]
fn only_a_meaningful_reason_rides_along() {
    let with = suspension_error(&serde_json::json!({ "reason": "boosting" }));
    assert_eq!(with.params.get("reason").map(String::as_str), Some("boosting"));

    for noise in ["banned", "BANNED", "", "   "] {
        let err = suspension_error(&serde_json::json!({ "reason": noise }));
        assert!(!err.params.contains_key("reason"), "{noise:?}");
    }
}
