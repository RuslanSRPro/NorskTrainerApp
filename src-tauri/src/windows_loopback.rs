use std::{
    collections::VecDeque,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc, Arc, Mutex,
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use hound::{SampleFormat as WavSampleFormat, WavSpec, WavWriter};

use serde::Serialize;

use tauri::{AppHandle, Manager, State};

use wasapi::{
    deinitialize, initialize_mta, DeviceEnumerator, Direction, SampleType, StreamMode, WaveFormat,
};

const SAMPLE_RATE: u32 = 48_000;
const CHANNELS: u16 = 2;

#[derive(Default)]
pub struct SystemRecorderState {
    session: Mutex<Option<SystemRecorderSession>>,
}

struct SystemRecorderSession {
    stop: Arc<AtomicBool>,

    sample_count: Arc<AtomicU64>,

    error: Arc<Mutex<Option<String>>>,

    thread: Option<JoinHandle<()>>,

    path: PathBuf,

    started_at: Instant,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemRecordingStatus {
    is_recording: bool,
    elapsed_millis: u64,
    path: Option<String>,
    bytes: u64,
    sample_rate: u32,
    channels: u16,
    error: Option<String>,
}

fn path_string(path: &PathBuf) -> String {
    path.to_string_lossy().to_string()
}

fn file_size(path: &PathBuf) -> u64 {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0)
}

fn current_error(error: &Arc<Mutex<Option<String>>>) -> Option<String> {
    error.lock().ok().and_then(|value| value.clone())
}

fn duration_millis(sample_count: u64) -> u64 {
    let frames = sample_count as f64 / CHANNELS as f64;

    (frames / SAMPLE_RATE as f64 * 1000.0).round().max(0.0) as u64
}

fn status_for(session: &SystemRecorderSession) -> SystemRecordingStatus {
    SystemRecordingStatus {
        is_recording: true,

        elapsed_millis: session.started_at.elapsed().as_millis() as u64,

        path: Some(path_string(&session.path)),

        bytes: file_size(&session.path),

        sample_rate: SAMPLE_RATE,

        channels: CHANNELS,

        error: current_error(&session.error),
    }
}

fn drain_float_samples(
    queue: &mut VecDeque<u8>,

    writer: &mut WavWriter<std::io::BufWriter<std::fs::File>>,

    sample_count: &Arc<AtomicU64>,
) -> Result<(), String> {
    let mut written = 0u64;

    while queue.len() >= 4 {
        let bytes = [
            queue.pop_front().unwrap(),
            queue.pop_front().unwrap(),
            queue.pop_front().unwrap(),
            queue.pop_front().unwrap(),
        ];

        let sample = f32::from_le_bytes(bytes).clamp(-1.0, 1.0);

        let pcm = (sample * i16::MAX as f32) as i16;

        writer
            .write_sample(pcm)
            .map_err(|error| format!("Could not write system audio: {error}"))?;

        written += 1;
    }

    if written > 0 {
        sample_count.fetch_add(written, Ordering::Relaxed);
    }

    Ok(())
}

fn capture_system_audio(
    path: PathBuf,

    stop: Arc<AtomicBool>,

    sample_count: Arc<AtomicU64>,

    error_state: Arc<Mutex<Option<String>>>,

    ready: mpsc::SyncSender<Result<(), String>>,
) {
    let com_result = initialize_mta().ok();

    if let Err(error) = com_result {
        let text = format!("Could not initialize Windows audio: {error}");

        if let Ok(mut stored) = error_state.lock() {
            *stored = Some(text.clone());
        }

        let _ = ready.send(Err(text));

        return;
    }

    let result = capture_system_audio_inner(&path, &stop, &sample_count, &ready);

    deinitialize();

    if let Err(text) = result {
        if let Ok(mut stored) = error_state.lock() {
            *stored = Some(text.clone());
        }

        /*
         * This send succeeds only if setup
         * failed before the caller received
         * the initial OK.
         */
        let _ = ready.try_send(Err(text));
    }
}

fn capture_system_audio_inner(
    path: &PathBuf,

    stop: &Arc<AtomicBool>,

    sample_count: &Arc<AtomicU64>,

    ready: &mpsc::SyncSender<Result<(), String>>,
) -> Result<(), String> {
    /*
     * IMPORTANT:
     *
     * This is a RENDER endpoint opened
     * for CAPTURE in shared mode.
     *
     * wasapi-rs converts this combination
     * into AUDCLNT_STREAMFLAGS_LOOPBACK.
     *
     * We therefore record what Windows
     * is playing, not the microphone.
     */

    let enumerator = DeviceEnumerator::new()
        .map_err(|error| format!("Could not access Windows audio devices: {error}"))?;

    let device = enumerator
        .get_default_device(&Direction::Render)
        .map_err(|error| format!("Could not find the current Windows output device: {error}"))?;

    let mut audio_client = device
        .get_iaudioclient()
        .map_err(|error| format!("Could not open Windows output audio: {error}"))?;

    /*
     * Force one stable format for the
     * NorskTrainer Windows pipeline.
     *
     * WASAPI shared mode performs the
     * conversion from the actual output
     * device format when necessary.
     */
    let desired_format = WaveFormat::new(
        32,
        32,
        &SampleType::Float,
        SAMPLE_RATE as usize,
        CHANNELS as usize,
        None,
    );

    let mode = StreamMode::PollingShared {
        autoconvert: true,

        /*
         * 20 ms in 100 ns units.
         */
        buffer_duration_hns: 200_000,
    };

    audio_client
        .initialize_client(&desired_format, &Direction::Capture, &mode)
        .map_err(|error| format!("Could not initialize Windows system-audio loopback: {error}"))?;

    let capture_client = audio_client
        .get_audiocaptureclient()
        .map_err(|error| format!("Could not create Windows loopback capture client: {error}"))?;

    let spec = WavSpec {
        channels: CHANNELS,

        sample_rate: SAMPLE_RATE,

        bits_per_sample: 16,

        sample_format: WavSampleFormat::Int,
    };

    let mut writer = WavWriter::create(path, spec)
        .map_err(|error| format!("Could not create system-audio WAV: {error}"))?;

    audio_client
        .start_stream()
        .map_err(|error| format!("Could not start Windows system-audio capture: {error}"))?;

    ready
        .send(Ok(()))
        .map_err(|_| "Windows recorder startup channel closed.".to_string())?;

    let mut queue: VecDeque<u8> = VecDeque::new();

    let mut runtime_error: Option<String> = None;

    while !stop.load(Ordering::Relaxed) {
        loop {
            let frames = match capture_client.get_next_packet_size() {
                Ok(Some(value)) => value,

                Ok(None) => 0,

                Err(error) => {
                    runtime_error = Some(format!(
                        "Could not read Windows system-audio packet size: {error}"
                    ));

                    break;
                }
            };

            if frames == 0 {
                break;
            }

            if let Err(error) = capture_client.read_from_device_to_deque(&mut queue) {
                runtime_error = Some(format!("Could not read Windows system audio: {error}"));

                break;
            }

            if let Err(error) = drain_float_samples(&mut queue, &mut writer, sample_count) {
                runtime_error = Some(error);

                break;
            }
        }

        if runtime_error.is_some() {
            break;
        }

        thread::sleep(Duration::from_millis(5));
    }

    /*
     * Drain any complete final samples
     * already returned by WASAPI.
     */
    if runtime_error.is_none() {
        if let Err(error) = drain_float_samples(&mut queue, &mut writer, sample_count) {
            runtime_error = Some(error);
        }
    }

    let stop_result = audio_client.stop_stream();

    let finalize_result = writer.finalize();

    if let Some(error) = runtime_error {
        return Err(error);
    }

    stop_result.map_err(|error| format!("Could not stop Windows system audio: {error}"))?;

    finalize_result.map_err(|error| format!("Could not finalize system-audio WAV: {error}"))?;

    Ok(())
}

#[tauri::command]
pub fn start_system_recording(
    app: AppHandle,

    state: State<'_, SystemRecorderState>,
) -> Result<SystemRecordingStatus, String> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| "System recorder state lock failed.".to_string())?;

    if guard.is_some() {
        return Err("A system-audio recording is already active.".to_string());
    }

    let recordings_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve NorskTrainer data directory: {error}"))?
        .join("recordings");

    fs::create_dir_all(&recordings_dir)
        .map_err(|error| format!("Could not create recordings directory: {error}"))?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("System clock error: {error}"))?
        .as_millis();

    let path = recordings_dir.join(format!("recording-{timestamp}.wav"));

    let stop = Arc::new(AtomicBool::new(false));

    let sample_count = Arc::new(AtomicU64::new(0));

    let error = Arc::new(Mutex::new(None));

    let (ready_tx, ready_rx) = mpsc::sync_channel(1);

    let thread_path = path.clone();

    let thread_stop = Arc::clone(&stop);

    let thread_samples = Arc::clone(&sample_count);

    let thread_error = Arc::clone(&error);

    let capture_thread = thread::Builder::new()
        .name("NorskTrainer-SystemAudio".to_string())
        .spawn(move || {
            capture_system_audio(
                thread_path,
                thread_stop,
                thread_samples,
                thread_error,
                ready_tx,
            );
        })
        .map_err(|error| format!("Could not start Windows audio thread: {error}"))?;

    match ready_rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Ok(())) => {}

        Ok(Err(error)) => {
            stop.store(true, Ordering::Relaxed);

            let _ = capture_thread.join();

            return Err(error);
        }

        Err(error) => {
            stop.store(true, Ordering::Relaxed);

            let _ = capture_thread.join();

            return Err(format!(
                "Windows system-audio recorder did not start in time: {error}"
            ));
        }
    }

    let session = SystemRecorderSession {
        stop,
        sample_count,
        error,
        thread: Some(capture_thread),
        path,
        started_at: Instant::now(),
    };

    let status = status_for(&session);

    *guard = Some(session);

    Ok(status)
}

#[tauri::command]
pub fn get_system_recording_status(
    state: State<'_, SystemRecorderState>,
) -> Result<SystemRecordingStatus, String> {
    let guard = state
        .session
        .lock()
        .map_err(|_| "System recorder state lock failed.".to_string())?;

    match guard.as_ref() {
        Some(session) => Ok(status_for(session)),

        None => Ok(SystemRecordingStatus {
            is_recording: false,

            elapsed_millis: 0,

            path: None,

            bytes: 0,

            sample_rate: SAMPLE_RATE,

            channels: CHANNELS,

            error: None,
        }),
    }
}

#[tauri::command]
pub fn stop_system_recording(
    state: State<'_, SystemRecorderState>,
) -> Result<SystemRecordingStatus, String> {
    let mut session = {
        let mut guard = state
            .session
            .lock()
            .map_err(|_| "System recorder state lock failed.".to_string())?;

        guard
            .take()
            .ok_or_else(|| "No system-audio recording is active.".to_string())?
    };

    session.stop.store(true, Ordering::Relaxed);

    if let Some(handle) = session.thread.take() {
        handle
            .join()
            .map_err(|_| "Windows system-audio thread crashed.".to_string())?;
    }

    let samples = session.sample_count.load(Ordering::Relaxed);

    let error = current_error(&session.error);

    if let Some(message) = error.clone() {
        return Err(message);
    }

    Ok(SystemRecordingStatus {
        is_recording: false,

        elapsed_millis: duration_millis(samples),

        path: Some(path_string(&session.path)),

        bytes: file_size(&session.path),

        sample_rate: SAMPLE_RATE,

        channels: CHANNELS,

        error,
    })
}
