use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const SUPPORTED_AUDIO_EXTENSIONS: &[&str] =
    &["wav", "m4a", "mp3", "aac", "caf", "mp4", "mpeg", "mpga"];

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct LectureSession {
    #[serde(default)]
    id: String,
    #[serde(default)]
    created_at_millis: u64,
    #[serde(default)]
    language: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    audio_file: String,
    #[serde(default)]
    duration_millis: u64,
    #[serde(default)]
    audio_bytes: u64,
    #[serde(default)]
    sample_rate: u32,
    #[serde(default)]
    channels: u16,
    #[serde(default)]
    source: String,
    #[serde(default)]
    original_file_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsLectureMarker {
    id: String,
    time_millis: u64,
    marker_type: String,
    note: String,
    created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsLecture {
    id: String,
    path: String,
    audio_path: String,
    audio_file_name: String,
    title: Option<String>,
    created_at_millis: u64,
    duration_millis: u64,
    bytes: u64,
    sample_rate: u32,
    channels: u16,
    language: String,
    source: String,
    original_file_name: Option<String>,
    markers: Vec<WindowsLectureMarker>,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or(0)
}

fn modified_millis(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_millis() as u64)
        .unwrap_or_else(now_millis)
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve NorskTrainer data directory: {error}"))
}

fn lectures_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("lectures"))
}

fn recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("recordings"))
}

fn lecture_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    if id.is_empty()
        || !id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
    {
        return Err("Invalid lecture id.".to_string());
    }

    Ok(lectures_dir(app)?.join(id))
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn metadata_path(directory: &Path) -> PathBuf {
    directory.join("session.json")
}

fn markers_path(directory: &Path) -> PathBuf {
    directory.join("markers.json")
}

fn write_session(directory: &Path, session: &LectureSession) -> Result<(), String> {
    fs::create_dir_all(directory)
        .map_err(|error| format!("Could not create lecture directory: {error}"))?;

    let bytes = serde_json::to_vec_pretty(session)
        .map_err(|error| format!("Could not serialize lecture metadata: {error}"))?;

    fs::write(metadata_path(directory), bytes)
        .map_err(|error| format!("Could not save lecture metadata: {error}"))
}

fn read_session(directory: &Path) -> Result<LectureSession, String> {
    let path = metadata_path(directory);

    if !path.exists() {
        return Err("Lecture metadata does not exist.".to_string());
    }

    let bytes =
        fs::read(&path).map_err(|error| format!("Could not read lecture metadata: {error}"))?;

    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Could not parse lecture metadata: {error}"))
}

fn write_markers(directory: &Path, markers: &[WindowsLectureMarker]) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(markers)
        .map_err(|error| format!("Could not serialize lecture markers: {error}"))?;

    fs::write(markers_path(directory), bytes)
        .map_err(|error| format!("Could not save lecture markers: {error}"))
}

fn read_markers(directory: &Path) -> Vec<WindowsLectureMarker> {
    let path = markers_path(directory);

    if !path.exists() {
        return Vec::new();
    }

    let Ok(bytes) = fs::read(path) else {
        return Vec::new();
    };

    let Ok(mut markers) = serde_json::from_slice::<Vec<WindowsLectureMarker>>(&bytes) else {
        return Vec::new();
    };

    markers.sort_by_key(|marker| marker.time_millis);
    markers
}

fn audio_extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .filter(|value| SUPPORTED_AUDIO_EXTENSIONS.contains(&value.as_str()))
}

fn wav_info(path: &Path) -> Option<(u64, u32, u16)> {
    let reader = hound::WavReader::open(path).ok()?;
    let spec = reader.spec();

    if spec.sample_rate == 0 {
        return None;
    }

    let duration_millis = (reader.duration() as u64)
        .saturating_mul(1000)
        .checked_div(spec.sample_rate as u64)
        .unwrap_or(0);

    Some((duration_millis, spec.sample_rate, spec.channels))
}

fn find_audio_path(directory: &Path, session: &LectureSession) -> Option<PathBuf> {
    if !session.audio_file.is_empty() {
        let configured = directory.join(&session.audio_file);
        if configured.exists() {
            return Some(configured);
        }
    }

    let entries = fs::read_dir(directory).ok()?;

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

        if file_name.starts_with("audio.") && audio_extension(&path).is_some() {
            return Some(path);
        }
    }

    None
}

fn normalize_language(language: &str) -> String {
    let value = language.trim().to_ascii_lowercase();

    if value == "en" || value == "en-us" || value == "en-gb" {
        "en".to_string()
    } else {
        "nb-NO".to_string()
    }
}

fn create_session_for_audio(
    id: String,
    audio_path: &Path,
    language: &str,
    source: &str,
    original_file_name: Option<String>,
    created_at_millis: u64,
) -> Result<LectureSession, String> {
    let metadata = fs::metadata(audio_path)
        .map_err(|error| format!("Could not inspect audio file: {error}"))?;

    let (duration_millis, sample_rate, channels) = if audio_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("wav"))
        .unwrap_or(false)
    {
        wav_info(audio_path).unwrap_or((0, 0, 0))
    } else {
        (0, 0, 0)
    };

    let audio_file = audio_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Audio file name is invalid.".to_string())?
        .to_string();

    Ok(LectureSession {
        id,
        created_at_millis,
        language: normalize_language(language),
        title: None,
        audio_file,
        duration_millis,
        audio_bytes: metadata.len(),
        sample_rate,
        channels,
        source: source.to_string(),
        original_file_name,
    })
}

fn migrate_legacy_recordings(app: &AppHandle) -> Result<(), String> {
    let source_root = recordings_dir(app)?;

    if !source_root.exists() {
        return Ok(());
    }

    let target_root = lectures_dir(app)?;
    fs::create_dir_all(&target_root)
        .map_err(|error| format!("Could not create lecture library: {error}"))?;

    let entries = fs::read_dir(&source_root)
        .map_err(|error| format!("Could not read legacy recordings: {error}"))?;

    for entry in entries.flatten() {
        let source = entry.path();

        if !source.is_file() {
            continue;
        }

        let is_wav = source
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("wav"))
            .unwrap_or(false);

        if !is_wav {
            continue;
        }

        let Some(stem) = source.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };

        let id = stem.to_string();
        let destination_dir = target_root.join(&id);

        if destination_dir.exists() {
            continue;
        }

        fs::create_dir_all(&destination_dir)
            .map_err(|error| format!("Could not create migrated lecture: {error}"))?;

        let destination = destination_dir.join("audio.wav");

        match fs::rename(&source, &destination) {
            Ok(()) => {}
            Err(_) => {
                fs::copy(&source, &destination)
                    .map_err(|error| format!("Could not migrate recording: {error}"))?;
                let _ = fs::remove_file(&source);
            }
        }

        let session = create_session_for_audio(
            id,
            &destination,
            "nb-NO",
            "recorded",
            None,
            modified_millis(&destination),
        )?;

        write_session(&destination_dir, &session)?;
    }

    Ok(())
}

fn session_to_lecture(
    directory: &Path,
    mut session: LectureSession,
) -> Result<WindowsLecture, String> {
    let audio_path = find_audio_path(directory, &session)
        .ok_or_else(|| "Lecture audio file is missing.".to_string())?;

    let metadata = fs::metadata(&audio_path)
        .map_err(|error| format!("Could not inspect lecture audio: {error}"))?;

    if session.duration_millis == 0 {
        if let Some((duration, sample_rate, channels)) = wav_info(&audio_path) {
            session.duration_millis = duration;
            session.sample_rate = sample_rate;
            session.channels = channels;
            session.audio_bytes = metadata.len();
            let _ = write_session(directory, &session);
        }
    }

    let audio_file_name = audio_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("audio")
        .to_string();

    Ok(WindowsLecture {
        id: session.id,
        path: path_string(directory),
        audio_path: path_string(&audio_path),
        audio_file_name,
        title: session.title,
        created_at_millis: session.created_at_millis,
        duration_millis: session.duration_millis,
        bytes: metadata.len(),
        sample_rate: session.sample_rate,
        channels: session.channels,
        language: normalize_language(&session.language),
        source: session.source,
        original_file_name: session.original_file_name,
        markers: read_markers(directory),
    })
}

#[tauri::command]
pub fn list_lectures(app: AppHandle) -> Result<Vec<WindowsLecture>, String> {
    migrate_legacy_recordings(&app)?;

    let root = lectures_dir(&app)?;

    if !root.exists() {
        fs::create_dir_all(&root)
            .map_err(|error| format!("Could not create lecture library: {error}"))?;
        return Ok(Vec::new());
    }

    let entries =
        fs::read_dir(&root).map_err(|error| format!("Could not read lecture library: {error}"))?;

    let mut lectures = Vec::new();

    for entry in entries.flatten() {
        let directory = entry.path();

        if !directory.is_dir() {
            continue;
        }

        let Ok(session) = read_session(&directory) else {
            continue;
        };

        if let Ok(lecture) = session_to_lecture(&directory, session) {
            lectures.push(lecture);
        }
    }

    lectures.sort_by(|a, b| b.created_at_millis.cmp(&a.created_at_millis));

    Ok(lectures)
}

#[tauri::command]
pub fn adopt_recording(
    app: AppHandle,
    recording_path: String,
    language: String,
) -> Result<WindowsLecture, String> {
    let source = PathBuf::from(recording_path);

    if !source.exists() || !source.is_file() {
        return Err("Recorded audio file is missing.".to_string());
    }

    let recordings_root = recordings_dir(&app)?;
    let canonical_source = source
        .canonicalize()
        .map_err(|error| format!("Could not validate recording path: {error}"))?;

    let canonical_root = recordings_root
        .canonicalize()
        .map_err(|error| format!("Could not validate recordings directory: {error}"))?;

    if !canonical_source.starts_with(&canonical_root) {
        return Err("Recorded audio is outside the NorskTrainer recording directory.".to_string());
    }

    let base_id = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("recording")
        .to_string();

    let mut id = base_id;

    let root = lectures_dir(&app)?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create lecture library: {error}"))?;

    while root.join(&id).exists() {
        id = format!("recording-{}", Uuid::new_v4());
    }

    let directory = root.join(&id);
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create lecture directory: {error}"))?;

    let destination = directory.join("audio.wav");

    match fs::rename(&source, &destination) {
        Ok(()) => {}
        Err(_) => {
            fs::copy(&source, &destination)
                .map_err(|error| format!("Could not save recording to lecture library: {error}"))?;
            let _ = fs::remove_file(&source);
        }
    }

    let session = create_session_for_audio(
        id.clone(),
        &destination,
        &language,
        "recorded",
        None,
        modified_millis(&destination),
    )?;

    write_session(&directory, &session)?;
    write_markers(&directory, &[])?;

    session_to_lecture(&directory, session)
}

#[tauri::command]
pub fn import_audio(
    app: AppHandle,
    source_path: String,
    language: String,
) -> Result<WindowsLecture, String> {
    let source = PathBuf::from(source_path);

    if !source.exists() || !source.is_file() {
        return Err("Selected audio file does not exist.".to_string());
    }

    let extension =
        audio_extension(&source).ok_or_else(|| "Unsupported audio format.".to_string())?;

    let id = format!("import-{}", Uuid::new_v4());

    let directory = lecture_dir(&app, &id)?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create imported lecture: {error}"))?;

    let destination = directory.join(format!("audio.{extension}"));

    fs::copy(&source, &destination)
        .map_err(|error| format!("Could not copy imported audio: {error}"))?;

    let original_file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string());

    let session = create_session_for_audio(
        id,
        &destination,
        &language,
        "imported",
        original_file_name,
        now_millis(),
    )?;

    write_session(&directory, &session)?;
    write_markers(&directory, &[])?;

    session_to_lecture(&directory, session)
}

#[tauri::command]
pub fn rename_lecture(app: AppHandle, id: String, title: String) -> Result<WindowsLecture, String> {
    let directory = lecture_dir(&app, &id)?;
    let mut session = read_session(&directory)?;

    let normalized = title.trim().chars().take(120).collect::<String>();

    session.title = if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    };

    write_session(&directory, &session)?;
    session_to_lecture(&directory, session)
}

#[tauri::command]
pub fn delete_lecture(app: AppHandle, id: String) -> Result<bool, String> {
    let directory = lecture_dir(&app, &id)?;

    if directory.exists() {
        fs::remove_dir_all(&directory)
            .map_err(|error| format!("Could not delete lecture: {error}"))?;
    }

    Ok(true)
}

#[tauri::command]
pub fn save_lecture_markers(
    app: AppHandle,
    id: String,
    markers: Vec<WindowsLectureMarker>,
) -> Result<Vec<WindowsLectureMarker>, String> {
    let directory = lecture_dir(&app, &id)?;

    if !directory.exists() {
        return Err("Lecture does not exist.".to_string());
    }

    let mut normalized = markers;
    normalized.sort_by_key(|marker| marker.time_millis);

    write_markers(&directory, &normalized)?;
    Ok(normalized)
}

#[tauri::command]
pub fn update_lecture_duration(
    app: AppHandle,
    id: String,
    duration_millis: u64,
) -> Result<bool, String> {
    let directory = lecture_dir(&app, &id)?;
    let mut session = read_session(&directory)?;

    if duration_millis > 0 {
        session.duration_millis = duration_millis;
        write_session(&directory, &session)?;
    }

    Ok(true)
}

#[tauri::command]
pub fn set_lecture_language(
    app: AppHandle,
    id: String,
    language: String,
) -> Result<WindowsLecture, String> {
    let directory = lecture_dir(&app, &id)?;
    let mut session = read_session(&directory)?;

    session.language = normalize_language(&language);

    write_session(&directory, &session)?;
    session_to_lecture(&directory, session)
}
