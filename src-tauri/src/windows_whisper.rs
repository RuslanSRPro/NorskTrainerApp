use std::{
    fs,
    fs::File,
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use symphonia::{
    core::{
        audio::SampleBuffer,
        codecs::{DecoderOptions, CODEC_TYPE_NULL},
        errors::Error as SymphoniaError,
        formats::FormatOptions,
        io::MediaSourceStream,
        meta::MetadataOptions,
        probe::Hint,
    },
    default::{get_codecs, get_probe},
};
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const MODEL_FILE_NAME: &str = "ggml-large-v3-turbo-q5_0.bin";

const MODEL_NAME: &str = "large-v3-turbo-q5_0";

const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin?download=true";

const MODEL_MIN_BYTES: u64 = 500_000_000;

const WHISPER_SAMPLE_RATE: u32 = 16_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsWhisperProgress {
    stage: String,
    percent: u8,
    message: String,
    lecture_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsWhisperModelStatus {
    ready: bool,
    model: String,
    path: String,
    bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsTranscriptSegment {
    start: f64,
    end: f64,
    text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsTranscriptResult {
    ok: bool,
    model: String,
    language: String,
    text: String,
    segments: Vec<WindowsTranscriptSegment>,
    characters: usize,
    audio_loading_mode: String,
    chunking_strategy: String,
}

fn emit_progress(
    app: &AppHandle,
    stage: &str,
    percent: u8,
    message: impl Into<String>,
    lecture_id: Option<String>,
) {
    let _ = app.emit(
        "windows-whisper-progress",
        WindowsWhisperProgress {
            stage: stage.to_string(),
            percent,
            message: message.into(),
            lecture_id,
        },
    );
}

fn validate_lecture_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || !id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
    {
        return Err("Invalid lecture id.".to_string());
    }

    Ok(())
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve NorskTrainer data directory: {error}"))
}

fn lecture_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    validate_lecture_id(id)?;

    Ok(app_data_dir(app)?.join("lectures").join(id))
}

fn model_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("models").join(MODEL_FILE_NAME))
}

fn file_size(path: &Path) -> u64 {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .unwrap_or(0)
}

fn model_is_ready(path: &Path) -> bool {
    path.exists() && file_size(path) >= MODEL_MIN_BYTES
}

fn find_audio_file(directory: &Path) -> Result<PathBuf, String> {
    let entries = fs::read_dir(directory)
        .map_err(|error| format!("Could not read lecture directory: {error}"))?;

    let supported = ["wav", "m4a", "mp3", "aac", "caf", "mp4", "mpeg", "mpga"];

    for entry in entries.flatten() {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();

        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();

        if file_name.starts_with("audio.") && supported.contains(&extension.as_str()) {
            return Ok(path);
        }
    }

    Err("Lecture audio file is missing.".to_string())
}

async fn ensure_model(app: &AppHandle, lecture_id: Option<String>) -> Result<PathBuf, String> {
    let path = model_path(app)?;

    if model_is_ready(&path) {
        emit_progress(app, "model-ready", 100, "Whisper model ready", lecture_id);

        return Ok(path);
    }

    let parent = path
        .parent()
        .ok_or_else(|| "Invalid Whisper model path.".to_string())?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create model directory: {error}"))?;

    let partial = path.with_extension("bin.part");

    if partial.exists() {
        let _ = fs::remove_file(&partial);
    }

    emit_progress(
        app,
        "downloading-model",
        0,
        "Downloading Whisper model",
        lecture_id.clone(),
    );

    let client = reqwest::Client::builder()
        .user_agent("NorskTrainer-Windows/1.0")
        .build()
        .map_err(|error| format!("Could not create model download client: {error}"))?;

    let mut response = client
        .get(MODEL_URL)
        .send()
        .await
        .map_err(|error| format!("Could not download Whisper model: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Whisper model download failed: {error}"))?;

    let expected = response.content_length();

    let mut file = File::create(&partial)
        .map_err(|error| format!("Could not create Whisper model file: {error}"))?;

    let mut written = 0u64;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Whisper model download interrupted: {error}"))?
    {
        file.write_all(&chunk)
            .map_err(|error| format!("Could not write Whisper model: {error}"))?;

        written = written.saturating_add(chunk.len() as u64);

        let percent = expected
            .filter(|value| *value > 0)
            .map(|value| (written.saturating_mul(100) / value).min(99) as u8)
            .unwrap_or(0);

        emit_progress(
            app,
            "downloading-model",
            percent,
            format!("Downloading Whisper model · {} MB", written / 1_000_000),
            lecture_id.clone(),
        );
    }

    file.flush()
        .map_err(|error| format!("Could not finalize Whisper model download: {error}"))?;

    drop(file);

    if file_size(&partial) < MODEL_MIN_BYTES {
        let bytes = file_size(&partial);

        let _ = fs::remove_file(&partial);

        return Err(format!(
            "Whisper model download is incomplete ({bytes} bytes)."
        ));
    }

    if path.exists() {
        let _ = fs::remove_file(&path);
    }

    fs::rename(&partial, &path)
        .map_err(|error| format!("Could not activate Whisper model: {error}"))?;

    emit_progress(app, "model-ready", 100, "Whisper model ready", lecture_id);

    Ok(path)
}

fn decode_audio_to_mono(path: &Path) -> Result<(Vec<f32>, u32), String> {
    let source = File::open(path).map_err(|error| format!("Could not open audio file: {error}"))?;

    let mss = MediaSourceStream::new(Box::new(source), Default::default());

    let mut hint = Hint::new();

    if let Some(extension) = path.extension().and_then(|value| value.to_str()) {
        hint.with_extension(extension);
    }

    let probed = get_probe()
        .format(
            &hint,
            mss,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|error| format!("Unsupported audio format: {error}"))?;

    let mut format = probed.format;

    let track = format
        .tracks()
        .iter()
        .find(|track| track.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| "No supported audio track found.".to_string())?;

    let track_id = track.id;

    let codec_params = track.codec_params.clone();

    let declared_rate = codec_params.sample_rate.unwrap_or(0);

    let mut decoder = get_codecs()
        .make(&codec_params, &DecoderOptions::default())
        .map_err(|error| format!("Unsupported audio codec: {error}"))?;

    let mut mono = Vec::<f32>::new();

    let mut actual_rate = declared_rate;

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,

            Err(SymphoniaError::IoError(ref error)) if error.kind() == ErrorKind::UnexpectedEof => {
                break;
            }

            Err(SymphoniaError::ResetRequired) => {
                return Err("Audio stream changed while decoding.".to_string());
            }

            Err(error) => {
                return Err(format!("Could not decode audio container: {error}"));
            }
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,

            Err(SymphoniaError::DecodeError(_)) => {
                continue;
            }

            Err(SymphoniaError::IoError(_)) => {
                continue;
            }

            Err(error) => {
                return Err(format!("Could not decode audio: {error}"));
            }
        };

        let spec = *decoded.spec();

        actual_rate = spec.rate;

        let channels = spec.channels.count().max(1);

        let mut buffer = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);

        buffer.copy_interleaved_ref(decoded);

        for frame in buffer.samples().chunks(channels) {
            if frame.len() < channels {
                continue;
            }

            let mut sum = 0.0f32;

            for sample in frame {
                if sample.is_finite() {
                    sum += *sample;
                }
            }

            mono.push(sum / channels as f32);
        }
    }

    if mono.is_empty() {
        return Err("Audio decoding returned no samples.".to_string());
    }

    if actual_rate == 0 {
        return Err("Audio sample rate is unknown.".to_string());
    }

    Ok((mono, actual_rate))
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

        let sample = source[left] + (source[right] - source[left]) * fraction;

        output.push(sample);
    }

    output
}

fn clean_segment_text(raw: &str) -> String {
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

fn run_whisper(
    app: &AppHandle,
    lecture_id: &str,
    model_path: &Path,
    pcm: &[f32],
    language: &str,
    retry: bool,
) -> Result<WindowsTranscriptResult, String> {
    let path_string = model_path.to_string_lossy().to_string();

    let mut context_params = WhisperContextParameters::default();

    /*
     * CPU is the portability baseline for the first Windows
     * implementation. GPU backends can be enabled later without
     * changing the JS contract.
     */
    context_params.use_gpu = false;

    let context = WhisperContext::new_with_params(&path_string, context_params)
        .map_err(|error| format!("Could not load Whisper model: {error}"))?;

    let mut state = context
        .create_state()
        .map_err(|error| format!("Could not create Whisper state: {error}"))?;

    let strategy = if retry {
        SamplingStrategy::BeamSearch {
            beam_size: 5,
            patience: -1.0,
        }
    } else {
        SamplingStrategy::Greedy { best_of: 5 }
    };

    let mut params = FullParams::new(strategy);

    let threads = std::thread::available_parallelism()
        .map(|value| value.get().clamp(1, 8))
        .unwrap_or(4);

    params.set_n_threads(threads as i32);

    params.set_translate(false);
    params.set_language(Some(language));
    params.set_detect_language(false);
    params.set_no_context(false);
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

    let progress_app = app.clone();

    let progress_lecture = lecture_id.to_string();

    params.set_progress_callback_safe(move |percent: i32| {
        emit_progress(
            &progress_app,
            "transcribing",
            percent.clamp(0, 100) as u8,
            "Transcribing locally with Whisper",
            Some(progress_lecture.clone()),
        );
    });

    state
        .full(params, pcm)
        .map_err(|error| format!("Whisper transcription failed: {error}"))?;

    let mut segments = Vec::<WindowsTranscriptSegment>::new();

    let mut full_text = String::new();

    for segment in state.as_iter() {
        let text = clean_segment_text(&segment.to_string());

        if text.is_empty() {
            continue;
        }

        let start = segment.start_timestamp() as f64 / 100.0;

        let end = segment.end_timestamp() as f64 / 100.0;

        if !start.is_finite() || !end.is_finite() || start < 0.0 || end < start {
            continue;
        }

        if !full_text.is_empty() && !full_text.ends_with(char::is_whitespace) {
            full_text.push(' ');
        }

        full_text.push_str(&text);

        segments.push(WindowsTranscriptSegment { start, end, text });
    }

    let text = full_text.trim().to_string();

    Ok(WindowsTranscriptResult {
        ok: !text.is_empty(),
        model: MODEL_NAME.to_string(),
        language: language.to_string(),
        characters: text.chars().count(),
        text,
        segments,
        audio_loading_mode: "full-file".to_string(),
        chunking_strategy: "none".to_string(),
    })
}

fn persist_transcript(directory: &Path, result: &WindowsTranscriptResult) -> Result<(), String> {
    fs::write(directory.join("transcript.txt"), result.text.as_bytes())
        .map_err(|error| format!("Could not save transcript: {error}"))?;

    let segments = serde_json::to_vec_pretty(&result.segments)
        .map_err(|error| format!("Could not serialize transcript timestamps: {error}"))?;

    fs::write(directory.join("transcript-segments.json"), segments)
        .map_err(|error| format!("Could not save transcript timestamps: {error}"))?;

    let debug = serde_json::json!({
        "ok": result.ok,
        "model": result.model,
        "language": result.language,
        "text": result.text,
        "segments": result.segments,
        "characters": result.characters,
        "audioLoadingMode": "full-file",
        "chunkingStrategy": "none",
    });

    fs::write(
        directory.join("whisper-debug.json"),
        serde_json::to_vec_pretty(&debug)
            .map_err(|error| format!("Could not serialize Whisper diagnostics: {error}"))?,
    )
    .map_err(|error| format!("Could not save Whisper diagnostics: {error}"))?;

    /*
     * Match iOS re-transcribe semantics:
     * translations are invalidated only after a successful new transcript.
     */
    for name in [
        "translation-uk.txt",
        "translation-ru.txt",
        "translation-uk-segments.json",
        "translation-ru-segments.json",
    ] {
        let path = directory.join(name);

        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_whisper_model_status(app: AppHandle) -> Result<WindowsWhisperModelStatus, String> {
    let path = model_path(&app)?;

    Ok(WindowsWhisperModelStatus {
        ready: model_is_ready(&path),
        model: MODEL_NAME.to_string(),
        bytes: file_size(&path),
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn prepare_whisper_model(app: AppHandle) -> Result<WindowsWhisperModelStatus, String> {
    let path = ensure_model(&app, None).await?;

    Ok(WindowsWhisperModelStatus {
        ready: true,
        model: MODEL_NAME.to_string(),
        bytes: file_size(&path),
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn get_saved_transcript(
    app: AppHandle,
    id: String,
) -> Result<Option<WindowsTranscriptResult>, String> {
    let directory = lecture_dir(&app, &id)?;

    let transcript_path = directory.join("transcript.txt");

    let segments_path = directory.join("transcript-segments.json");

    if !transcript_path.exists() {
        return Ok(None);
    }

    let text = fs::read_to_string(&transcript_path)
        .map_err(|error| format!("Could not read transcript: {error}"))?
        .trim()
        .to_string();

    if text.is_empty() {
        return Ok(None);
    }

    let segments = if segments_path.exists() {
        fs::read(&segments_path)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Vec<WindowsTranscriptSegment>>(&bytes).ok())
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    let language = fs::read_to_string(directory.join("whisper-debug.json"))
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .and_then(|value| {
            value
                .get("language")
                .and_then(|item| item.as_str())
                .map(|item| item.to_string())
        })
        .unwrap_or_else(|| "no".to_string());

    Ok(Some(WindowsTranscriptResult {
        ok: true,
        model: MODEL_NAME.to_string(),
        language,
        characters: text.chars().count(),
        text,
        segments,
        audio_loading_mode: "full-file".to_string(),
        chunking_strategy: "none".to_string(),
    }))
}

#[tauri::command]
pub async fn transcribe_lecture(
    app: AppHandle,
    id: String,
    language: String,
) -> Result<WindowsTranscriptResult, String> {
    validate_lecture_id(&id)?;

    let whisper_language = match language.trim().to_ascii_lowercase().as_str() {
        "en" | "en-us" | "en-gb" => "en".to_string(),

        _ => "no".to_string(),
    };

    let directory = lecture_dir(&app, &id)?;

    if !directory.exists() {
        return Err("Lecture does not exist.".to_string());
    }

    let audio_path = find_audio_file(&directory)?;

    let model = ensure_model(&app, Some(id.clone())).await?;

    emit_progress(
        &app,
        "decoding-audio",
        0,
        "Decoding audio",
        Some(id.clone()),
    );

    let task_app = app.clone();

    let task_id = id.clone();

    let task_directory = directory.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        let (source_pcm, source_rate) = decode_audio_to_mono(&audio_path)?;

        emit_progress(
            &task_app,
            "decoding-audio",
            100,
            "Audio ready",
            Some(task_id.clone()),
        );

        let pcm = resample_linear(&source_pcm, source_rate, WHISPER_SAMPLE_RATE);

        if pcm.len() < (WHISPER_SAMPLE_RATE as usize / 4) {
            return Err("Audio is too short for transcription.".to_string());
        }

        let mut result = run_whisper(&task_app, &task_id, &model, &pcm, &whisper_language, false)?;

        if result.text.trim().is_empty() {
            emit_progress(
                &task_app,
                "retrying",
                0,
                "No text found · retrying",
                Some(task_id.clone()),
            );

            result = run_whisper(&task_app, &task_id, &model, &pcm, &whisper_language, true)?;
        }

        if result.text.trim().is_empty() {
            return Err("Whisper returned an empty transcript after two attempts.".to_string());
        }

        persist_transcript(&task_directory, &result)?;

        emit_progress(&task_app, "done", 100, "Transcript ready", Some(task_id));

        Ok::<WindowsTranscriptResult, String>(result)
    })
    .await
    .map_err(|error| format!("Whisper worker failed: {error}"))??;

    Ok(result)
}
