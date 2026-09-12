use std::{
    fs,
    io::BufWriter,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    SampleFormat, Stream,
};
use hound::{SampleFormat as WavSampleFormat, WavSpec, WavWriter};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

type SharedWriter = Arc<Mutex<Option<WavWriter<BufWriter<std::fs::File>>>>>;

#[derive(Default)]
pub struct RecorderState {
    session: Mutex<Option<RecorderSession>>,
}

struct RecorderSession {
    stream: Stream,
    writer: SharedWriter,
    path: PathBuf,
    sample_rate: u32,
    channels: u16,
    sample_count: Arc<AtomicU64>,
    started_at: Instant,
    error: Arc<Mutex<Option<String>>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStatus {
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

fn current_error(error: &Arc<Mutex<Option<String>>>) -> Option<String> {
    error.lock().ok().and_then(|value| value.clone())
}

fn file_size(path: &PathBuf) -> u64 {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0)
}

fn duration_millis(sample_count: u64, sample_rate: u32, channels: u16) -> u64 {
    if sample_rate == 0 || channels == 0 {
        return 0;
    }

    let frames = sample_count as f64 / channels as f64;

    ((frames / sample_rate as f64) * 1000.0).round().max(0.0) as u64
}

fn make_status(session: &RecorderSession) -> RecordingStatus {
    let samples = session.sample_count.load(Ordering::Relaxed);

    RecordingStatus {
        is_recording: true,
        elapsed_millis: session.started_at.elapsed().as_millis() as u64,
        path: Some(path_string(&session.path)),
        bytes: file_size(&session.path),
        sample_rate: session.sample_rate,
        channels: session.channels,
        error: current_error(&session.error),
    }
}

#[tauri::command]
pub fn start_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<RecordingStatus, String> {
    let mut guard = state
        .session
        .lock()
        .map_err(|_| "Recorder state lock failed.".to_string())?;

    if guard.is_some() {
        return Err("A recording is already active.".to_string());
    }

    let host = cpal::default_host();

    let device = host
        .default_input_device()
        .ok_or_else(|| "No Windows microphone was found.".to_string())?;

    /*
     * Prefer an explicit F32 input format.
     * It is the normal realtime format on modern
     * WASAPI devices and keeps the first recorder
     * implementation deterministic.
     */
    let supported = device
        .supported_input_configs()
        .map_err(|error| format!("Could not read microphone formats: {error}"))?;

    let selected = supported
        .filter(|range| range.sample_format() == SampleFormat::F32)
        .find_map(|range| range.try_with_standard_sample_rate())
        .ok_or_else(|| {
            "The selected Windows microphone does not expose an F32 input format.".to_string()
        })?;

    let config = selected.config();
    let sample_rate = config.sample_rate;
    let channels = config.channels;

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

    let spec = WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: WavSampleFormat::Int,
    };

    let writer = WavWriter::create(&path, spec)
        .map_err(|error| format!("Could not create WAV file: {error}"))?;

    let writer: SharedWriter = Arc::new(Mutex::new(Some(writer)));

    let callback_writer = Arc::clone(&writer);

    let sample_count = Arc::new(AtomicU64::new(0));

    let callback_sample_count = Arc::clone(&sample_count);

    let stream_error = Arc::new(Mutex::new(None));

    let callback_stream_error = Arc::clone(&stream_error);

    let data_error = Arc::clone(&stream_error);

    let stream = device
        .build_input_stream(
            config,
            move |data: &[f32], _| {
                let mut writer_guard = match callback_writer.lock() {
                    Ok(value) => value,
                    Err(_) => {
                        if let Ok(mut error) = data_error.lock() {
                            *error = Some("Audio writer lock failed.".to_string());
                        }
                        return;
                    }
                };

                let Some(writer) = writer_guard.as_mut() else {
                    return;
                };

                let mut written = 0u64;

                for sample in data {
                    let normalized = sample.clamp(-1.0, 1.0);

                    let pcm = (normalized * i16::MAX as f32) as i16;

                    if let Err(error) = writer.write_sample(pcm) {
                        if let Ok(mut stored) = data_error.lock() {
                            *stored = Some(format!("Audio write failed: {error}"));
                        }

                        break;
                    }

                    written += 1;
                }

                callback_sample_count.fetch_add(written, Ordering::Relaxed);
            },
            move |error| {
                if let Ok(mut stored) = callback_stream_error.lock() {
                    *stored = Some(format!("Microphone stream error: {error}"));
                }
            },
            None,
        )
        .map_err(|error| format!("Could not open Windows microphone: {error}"))?;

    stream
        .play()
        .map_err(|error| format!("Could not start Windows microphone: {error}"))?;

    let session = RecorderSession {
        stream,
        writer,
        path,
        sample_rate,
        channels,
        sample_count,
        started_at: Instant::now(),
        error: stream_error,
    };

    let status = make_status(&session);

    *guard = Some(session);

    Ok(status)
}

#[tauri::command]
pub fn get_recording_status(state: State<'_, RecorderState>) -> Result<RecordingStatus, String> {
    let guard = state
        .session
        .lock()
        .map_err(|_| "Recorder state lock failed.".to_string())?;

    match guard.as_ref() {
        Some(session) => Ok(make_status(session)),

        None => Ok(RecordingStatus {
            is_recording: false,
            elapsed_millis: 0,
            path: None,
            bytes: 0,
            sample_rate: 0,
            channels: 0,
            error: None,
        }),
    }
}

#[tauri::command]
pub fn stop_recording(state: State<'_, RecorderState>) -> Result<RecordingStatus, String> {
    let session = {
        let mut guard = state
            .session
            .lock()
            .map_err(|_| "Recorder state lock failed.".to_string())?;

        guard
            .take()
            .ok_or_else(|| "No recording is active.".to_string())?
    };

    /*
     * Drop the CPAL stream first so the microphone
     * callback cannot write while WAV finalization runs.
     */
    drop(session.stream);

    let samples = session.sample_count.load(Ordering::Relaxed);

    {
        let mut writer_guard = session
            .writer
            .lock()
            .map_err(|_| "Audio writer lock failed.".to_string())?;

        if let Some(writer) = writer_guard.take() {
            writer
                .finalize()
                .map_err(|error| format!("Could not finalize WAV file: {error}"))?;
        }
    }

    let bytes = file_size(&session.path);

    let elapsed = duration_millis(samples, session.sample_rate, session.channels);

    Ok(RecordingStatus {
        is_recording: false,
        elapsed_millis: elapsed,
        path: Some(path_string(&session.path)),
        bytes,
        sample_rate: session.sample_rate,
        channels: session.channels,
        error: current_error(&session.error),
    })
}
