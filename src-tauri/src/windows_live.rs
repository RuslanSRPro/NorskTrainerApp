use std::{
    fs,
    fs::File,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};

use hound::WavReader;
use serde::Serialize;
use tauri::{AppHandle, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const LIVE_MODEL_FILE_NAME: &str = "ggml-base-q5_1.bin";

const LIVE_MODEL_NAME: &str = "base-q5_1";

const LIVE_MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin?download=true";

const LIVE_MODEL_MIN_BYTES: u64 = 50_000_000;

const WHISPER_SAMPLE_RATE: u32 = 16_000;

static LIVE_CONTEXT: OnceLock<Mutex<Option<(PathBuf, Arc<WhisperContext>, String)>>> =
    OnceLock::new();

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsLiveModelStatus {
    ready: bool,
    model: String,
    path: String,
    bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsLiveSegment {
    start: f64,
    end: f64,
    text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsLiveSnapshot {
    ok: bool,
    model: String,
    backend: String,
    language: String,
    text: String,
    segments: Vec<WindowsLiveSegment>,
    window_start: f64,
    duration: f64,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve NorskTrainer data directory: {error}"))
}

fn live_model_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("models").join(LIVE_MODEL_FILE_NAME))
}

fn file_size(path: &Path) -> u64 {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0)
}

fn model_ready(path: &Path) -> bool {
    path.exists() && file_size(path) >= LIVE_MODEL_MIN_BYTES
}

async fn ensure_live_model(app: &AppHandle) -> Result<PathBuf, String> {
    let path = live_model_path(app)?;

    if model_ready(&path) {
        return Ok(path);
    }

    let parent = path
        .parent()
        .ok_or_else(|| "Invalid Live Whisper model path.".to_string())?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create model directory: {error}"))?;

    let partial = path.with_extension("bin.part");

    if partial.exists() {
        let _ = fs::remove_file(&partial);
    }

    let client = reqwest::Client::builder()
        .user_agent("NorskTrainer-Windows/1.0")
        .build()
        .map_err(|error| format!("Could not create Live model download client: {error}"))?;

    let mut response = client
        .get(LIVE_MODEL_URL)
        .send()
        .await
        .map_err(|error| format!("Could not download Live Whisper model: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Live Whisper model download failed: {error}"))?;

    let mut file = File::create(&partial)
        .map_err(|error| format!("Could not create Live Whisper model file: {error}"))?;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Live Whisper model download interrupted: {error}"))?
    {
        file.write_all(&chunk)
            .map_err(|error| format!("Could not write Live Whisper model: {error}"))?;
    }

    file.flush()
        .map_err(|error| format!("Could not finalize Live Whisper model download: {error}"))?;

    drop(file);

    if file_size(&partial) < LIVE_MODEL_MIN_BYTES {
        let bytes = file_size(&partial);

        let _ = fs::remove_file(&partial);

        return Err(format!(
            "Live Whisper model download is incomplete ({bytes} bytes)."
        ));
    }

    if path.exists() {
        let _ = fs::remove_file(&path);
    }

    fs::rename(&partial, &path)
        .map_err(|error| format!("Could not activate Live Whisper model: {error}"))?;

    Ok(path)
}

fn validate_recording_path(app: &AppHandle, raw_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw_path);

    if !path.exists() || !path.is_file() {
        return Err("Live recording file is missing.".to_string());
    }

    let root = app_data_dir(app)?.join("recordings");

    let canonical_path = path
        .canonicalize()
        .map_err(|error| format!("Could not validate Live recording path: {error}"))?;

    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Could not validate recording directory: {error}"))?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("Live recording is outside the NorskTrainer recordings directory.".to_string());
    }

    Ok(canonical_path)
}

fn tail_chars(raw: &str, maximum: usize) -> String {
    let chars = raw.chars().collect::<Vec<_>>();

    if chars.len() <= maximum {
        return raw.trim().to_string();
    }

    chars[chars.len() - maximum..]
        .iter()
        .collect::<String>()
        .trim()
        .to_string()
}

fn clean_text(raw: &str) -> String {
    let mut output = String::with_capacity(raw.len());

    let chars = raw.chars().collect::<Vec<_>>();

    let mut index = 0usize;

    while index < chars.len() {
        if index + 1 < chars.len() && chars[index] == '<' && chars[index + 1] == '|' {
            index += 2;

            while index + 1 < chars.len() {
                if chars[index] == '|' && chars[index + 1] == '>' {
                    index += 2;
                    break;
                }

                index += 1;
            }

            continue;
        }

        output.push(chars[index]);

        index += 1;
    }

    output.trim().to_string()
}

fn resample_linear(source: &[f32], source_rate: u32, target_rate: u32) -> Vec<f32> {
    if source.is_empty() || source_rate == 0 || target_rate == 0 {
        return Vec::new();
    }

    if source_rate == target_rate {
        return source.to_vec();
    }

    let output_len =
        (source.len() as u64 * target_rate as u64 / source_rate as u64).max(1) as usize;

    let ratio = source_rate as f64 / target_rate as f64;

    let mut output = Vec::with_capacity(output_len);

    for index in 0..output_len {
        let position = index as f64 * ratio;

        let left = position.floor() as usize;

        let right = (left + 1).min(source.len() - 1);

        let fraction = (position - left as f64) as f32;

        output.push(source[left] + (source[right] - source[left]) * fraction);
    }

    output
}

fn read_live_window(path: &Path, window_seconds: f64) -> Result<(Vec<f32>, f64, f64), String> {
    let mut reader =
        WavReader::open(path).map_err(|error| format!("Live WAV is not ready yet: {error}"))?;

    let spec = reader.spec();

    if spec.sample_rate == 0 || spec.channels == 0 {
        return Err("Live WAV has an invalid audio format.".to_string());
    }

    if spec.bits_per_sample != 16 {
        return Err(format!(
            "Live WAV must be 16-bit PCM, got {} bits.",
            spec.bits_per_sample
        ));
    }

    let channels = spec.channels as usize;

    let samples = reader
        .samples::<i16>()
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    let total_frames = samples.len() / channels;

    if total_frames == 0 {
        return Err("Live WAV does not contain audio yet.".to_string());
    }

    let duration = total_frames as f64 / spec.sample_rate as f64;

    let requested_frames =
        (window_seconds.max(3.0).min(20.0) * spec.sample_rate as f64).round() as usize;

    let start_frame = total_frames.saturating_sub(requested_frames);

    let window_start = start_frame as f64 / spec.sample_rate as f64;

    let mut mono = Vec::<f32>::with_capacity(total_frames - start_frame);

    for frame_index in start_frame..total_frames {
        let base = frame_index * channels;

        let mut sum = 0.0f32;

        for channel in 0..channels {
            sum += samples[base + channel] as f32 / i16::MAX as f32;
        }

        mono.push(sum / channels as f32);
    }

    let resampled = resample_linear(&mono, spec.sample_rate, WHISPER_SAMPLE_RATE);

    Ok((resampled, window_start, duration))
}

fn load_live_context(model_path: &Path) -> Result<(Arc<WhisperContext>, String), String> {
    let cache = LIVE_CONTEXT.get_or_init(|| Mutex::new(None));

    {
        let guard = cache
            .lock()
            .map_err(|_| "Live Whisper context lock failed.".to_string())?;

        if let Some((cached_path, context, backend)) = guard.as_ref() {
            if cached_path == model_path {
                return Ok((Arc::clone(context), backend.clone()));
            }
        }
    }

    let mut gpu_params = WhisperContextParameters::default();

    gpu_params.use_gpu = true;

    let (context, backend) = match WhisperContext::new_with_params(model_path, gpu_params) {
        Ok(context) => (context, "vulkan".to_string()),

        Err(gpu_error) => {
            let mut cpu_params = WhisperContextParameters::default();

            cpu_params.use_gpu = false;

            let context =
                    WhisperContext::new_with_params(
                        model_path,
                        cpu_params,
                    )
                    .map_err(
                        |cpu_error| {
                            format!(
                                "Could not load Live Whisper model on Vulkan ({gpu_error}) or CPU ({cpu_error})"
                            )
                        }
                    )?;

            (context, "cpu-fallback".to_string())
        }
    };

    let context = Arc::new(context);

    let mut guard = cache
        .lock()
        .map_err(|_| "Live Whisper context lock failed.".to_string())?;

    *guard = Some((
        model_path.to_path_buf(),
        Arc::clone(&context),
        backend.clone(),
    ));

    Ok((context, backend))
}

fn transcribe_window(
    context: &WhisperContext,
    pcm: &[f32],
    language: &str,
    prompt: &str,
    window_start: f64,
) -> Result<(String, Vec<WindowsLiveSegment>), String> {
    let mut state = context
        .create_state()
        .map_err(|error| format!("Could not create Live Whisper state: {error}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

    let threads = std::thread::available_parallelism()
        .map(|value| value.get().clamp(1, 4))
        .unwrap_or(4);

    params.set_n_threads(threads as i32);

    params.set_translate(false);

    params.set_language(Some(language));

    params.set_detect_language(false);

    params.set_no_context(true);

    params.set_no_timestamps(false);

    params.set_single_segment(false);

    params.set_print_special(false);

    params.set_print_progress(false);

    params.set_print_realtime(false);

    params.set_print_timestamps(false);

    params.set_token_timestamps(false);

    params.set_suppress_blank(true);

    params.set_suppress_nst(true);

    params.set_temperature(0.0);

    params.set_max_initial_ts(1.0);

    let prompt = tail_chars(prompt, 240);

    if !prompt.is_empty() {
        params.set_initial_prompt(&prompt);
    }

    state
        .full(params, pcm)
        .map_err(|error| format!("Live Whisper transcription failed: {error}"))?;

    let mut segments = Vec::<WindowsLiveSegment>::new();

    let mut full_text = String::new();

    for segment in state.as_iter() {
        let text = clean_text(&segment.to_string());

        if text.is_empty() {
            continue;
        }

        let start = window_start + segment.start_timestamp() as f64 / 100.0;

        let end = window_start + segment.end_timestamp() as f64 / 100.0;

        if !start.is_finite() || !end.is_finite() || start < 0.0 || end < start {
            continue;
        }

        if !full_text.is_empty() {
            full_text.push(' ');
        }

        full_text.push_str(&text);

        segments.push(WindowsLiveSegment { start, end, text });
    }

    Ok((full_text.trim().to_string(), segments))
}

#[tauri::command]
pub fn get_live_whisper_model_status(app: AppHandle) -> Result<WindowsLiveModelStatus, String> {
    let path = live_model_path(&app)?;

    Ok(WindowsLiveModelStatus {
        ready: model_ready(&path),
        model: LIVE_MODEL_NAME.to_string(),
        path: path.to_string_lossy().to_string(),
        bytes: file_size(&path),
    })
}

#[tauri::command]
pub async fn prepare_live_whisper_model(app: AppHandle) -> Result<WindowsLiveModelStatus, String> {
    let path = ensure_live_model(&app).await?;

    /*
     * Warm the context after download so the first Live snapshot
     * does not pay the full model initialization cost.
     */
    let warm_path = path.clone();

    tauri::async_runtime::spawn_blocking(move || load_live_context(&warm_path))
        .await
        .map_err(|error| format!("Live Whisper model warm-up failed: {error}"))??;

    Ok(WindowsLiveModelStatus {
        ready: true,
        model: LIVE_MODEL_NAME.to_string(),
        path: path.to_string_lossy().to_string(),
        bytes: file_size(&path),
    })
}

#[tauri::command]
pub async fn transcribe_live_snapshot(
    app: AppHandle,
    recording_path: String,
    language: String,
    window_seconds: Option<f64>,
    prompt: Option<String>,
) -> Result<WindowsLiveSnapshot, String> {
    let path = validate_recording_path(&app, &recording_path)?;

    let model_path = ensure_live_model(&app).await?;

    let whisper_language = match language.trim().to_ascii_lowercase().as_str() {
        "en" | "en-us" | "en-gb" => "en".to_string(),

        _ => "no".to_string(),
    };

    let window_seconds = window_seconds.unwrap_or(12.0).clamp(6.0, 18.0);

    let prompt = prompt.unwrap_or_default();

    tauri::async_runtime::spawn_blocking(move || {
        let (pcm, window_start, duration) = read_live_window(&path, window_seconds)?;

        if pcm.len() < WHISPER_SAMPLE_RATE as usize {
            return Err("Waiting for more speech.".to_string());
        }

        let (context, backend) = load_live_context(&model_path)?;

        let (text, segments) =
            transcribe_window(&context, &pcm, &whisper_language, &prompt, window_start)?;

        Ok(WindowsLiveSnapshot {
            ok: !text.is_empty(),
            model: LIVE_MODEL_NAME.to_string(),
            backend,
            language: whisper_language,
            text,
            segments,
            window_start,
            duration,
        })
    })
    .await
    .map_err(|error| format!("Live Whisper worker failed: {error}"))?
}
