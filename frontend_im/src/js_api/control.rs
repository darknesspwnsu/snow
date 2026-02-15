use std::ffi::CString;
use std::os::raw::c_char;

extern "C" {
    fn js_snapshot_take_kind() -> i32;
    fn js_snapshot_take_request_id() -> u32;
    fn js_snapshot_complete_save(request_id: u32);
    fn js_snapshot_complete_loaded(request_id: u32);
    fn js_snapshot_complete_error(request_id: u32, error: *const c_char);
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SnapshotCommandKind {
    Save,
    Load,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SnapshotCommand {
    pub kind: SnapshotCommandKind,
    pub request_id: u32,
}

pub fn take_snapshot_command() -> Option<SnapshotCommand> {
    let kind = unsafe { js_snapshot_take_kind() };
    if kind == 0 {
        return None;
    }
    let request_id = unsafe { js_snapshot_take_request_id() };
    if request_id == 0 {
        return None;
    }
    let kind = match kind {
        1 => SnapshotCommandKind::Save,
        2 => SnapshotCommandKind::Load,
        _ => return None,
    };
    Some(SnapshotCommand {kind, request_id})
}

pub fn complete_snapshot_save(request_id: u32) {
    unsafe {
        js_snapshot_complete_save(request_id);
    }
}

pub fn complete_snapshot_loaded(request_id: u32) {
    unsafe {
        js_snapshot_complete_loaded(request_id);
    }
}

pub fn complete_snapshot_error(request_id: u32, message: &str) {
    let sanitized = message.replace('\0', " ");
    if let Ok(c_message) = CString::new(sanitized) {
        unsafe {
            js_snapshot_complete_error(request_id, c_message.as_ptr());
        }
    }
}
