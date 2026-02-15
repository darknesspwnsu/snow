// JavaScript exports for Snow Emscripten frontend
// Should only be used in the js_api module, and exposed as safe Rust functions
// outside of it.

const SNAPSHOT_NONE = 0;
const SNAPSHOT_SAVE = 1;
const SNAPSHOT_LOAD = 2;

const snapshotPathForSave = requestId =>
    `/tmp/outgoing-vm-snapshot-${requestId}.snows`;
const snapshotPathForLoad = requestId =>
    `/tmp/incoming-vm-snapshot-${requestId}.snows`;

const snapshotMailbox = {
    queue: [],
    active: null,
    enqueue(command) {
        this.queue.push(command);
    },
    ensureActive() {
        if (!this.active && this.queue.length > 0) {
            this.active = this.queue.shift();
        }
    },
    peekKind() {
        this.ensureActive();
        return this.active?.kind ?? SNAPSHOT_NONE;
    },
    consumeRequestId() {
        this.ensureActive();
        if (!this.active) {
            return 0;
        }
        const requestId = this.active.requestId;
        this.active = null;
        return requestId;
    },
};

globalThis.__snowRequestVMSnapshotSave = requestId => {
    snapshotMailbox.enqueue({
        kind: SNAPSHOT_SAVE,
        requestId,
    });
};

globalThis.__snowRequestVMSnapshotLoad = (requestId, data) => {
    if (!globalThis.FS) {
        throw new Error("Emscripten FS is unavailable.");
    }
    try {
        FS.mkdir("/tmp");
    } catch (_) {
        // directory already exists
    }
    const path = snapshotPathForLoad(requestId);
    FS.writeFile(path, data);
    snapshotMailbox.enqueue({
        kind: SNAPSHOT_LOAD,
        requestId,
    });
};

mergeInto(LibraryManager.library, {
    // Runtime
    js_sleep(seconds) {
        workerApi.sleep(seconds);
    },
    js_check_for_periodic_tasks() {
        workerApi.checkForPeriodicTasks();
    },
    js_snapshot_take_kind() {
        return snapshotMailbox.peekKind();
    },
    js_snapshot_take_request_id() {
        return snapshotMailbox.consumeRequestId();
    },
    js_snapshot_complete_save(requestId) {
        const path = snapshotPathForSave(requestId);
        let data;
        try {
            data = FS.readFile(path);
        } catch (err) {
            postMessage({
                type: "emulator_vm_snapshot_error",
                requestId,
                error: String(err),
            });
            return;
        }
        postMessage(
            {
                type: "emulator_vm_snapshot_saved",
                requestId,
                data,
            },
            [data.buffer]
        );
        try {
            FS.unlink(path);
        } catch (_) {
            // noop
        }
    },
    js_snapshot_complete_loaded(requestId) {
        const path = snapshotPathForLoad(requestId);
        postMessage({
            type: "emulator_vm_snapshot_loaded",
            requestId,
        });
        try {
            FS.unlink(path);
        } catch (_) {
            // noop
        }
    },
    js_snapshot_complete_error(requestId, errorPtr) {
        postMessage({
            type: "emulator_vm_snapshot_error",
            requestId,
            error: UTF8ToString(errorPtr),
        });
    },

    // Video
    js_did_open_video(width, height) {
        workerApi.didOpenVideo(width, height);
    },
    js_blit(bufPtr, bufSize) {
        workerApi.blit(bufPtr, bufSize);
    },

    // Audio
    js_did_open_audio(sampleRate, sampleSize, channels) {
        workerApi.didOpenAudio(sampleRate, sampleSize, channels);
    },
    js_audio_buffer_size() {
        return workerApi.audioBufferSize();
    },
    js_enqueue_audio(bufPtr, bufSize) {
        workerApi.enqueueAudio(bufPtr, bufSize);
    },

    // Disks
    js_disk_open(ptr) {
        return workerApi.disks.open(UTF8ToString(ptr));
    },
    js_disk_close(diskId) {
        workerApi.disks.close(diskId);
    },
    js_disk_size(diskId) {
        return workerApi.disks.size(diskId);
    },
    js_disk_read(diskId, bufPtr, offset, length) {
        return workerApi.disks.read(diskId, bufPtr, offset, length);
    },
    js_disk_write(diskId, bufPtr, offset, length) {
        return workerApi.disks.write(diskId, bufPtr, offset, length);
    },
    js_consume_cdrom_name() {
        const diskName = workerApi.disks.consumeCdromName();
        if (!diskName || !diskName.length) {
            return 0;
        }
        const diskNameLength = lengthBytesUTF8(diskName) + 1;
        const diskNameCstr = _malloc(diskNameLength);
        stringToUTF8(diskName, diskNameCstr, diskNameLength);
        return diskNameCstr;
    },
    js_free(ptr) {
        _free(ptr);
    },

    // Input
    js_acquire_input_lock() {
        return workerApi.acquireInputLock();
    },
    js_release_input_lock() {
        workerApi.releaseInputLock();
    },
    js_has_mouse_position() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.mousePositionFlagAddr
        );
    },
    js_get_mouse_x_position() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.mousePositionXAddr
        );
    },
    js_get_mouse_y_position() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.mousePositionYAddr
        );
    },
    js_get_mouse_delta_x() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.mouseDeltaXAddr
        );
    },
    js_get_mouse_delta_y() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.mouseDeltaYAddr
        );
    },
    js_get_mouse_button_state() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.mouseButtonStateAddr
        );
    },
    js_has_key_event() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.keyEventFlagAddr
        );
    },
    js_get_key_code() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.keyCodeAddr
        );
    },
    js_get_key_state() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.keyStateAddr
        );
    },
    js_has_speed_event() {
        return workerApi.getInputValue(
            workerApi.InputBufferAddresses.speedFlagAddr
        );
    },
    js_get_speed() {
        return workerApi.getInputValue(workerApi.InputBufferAddresses.speedAddr);
    },
});
