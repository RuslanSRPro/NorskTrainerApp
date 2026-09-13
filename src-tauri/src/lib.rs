mod windows_library;
mod windows_live;
mod windows_loopback;
mod windows_recorder;
mod windows_translation;
mod windows_whisper;

#[cfg(target_os = "windows")]
use tauri::{Manager, PhysicalPosition, PhysicalSize};

use windows_library::{
    adopt_recording, delete_lecture, get_saved_translation, import_audio, list_lectures,
    rename_lecture, save_lecture_markers, save_lecture_translation, set_lecture_language,
    update_lecture_duration,
};

use windows_live::{
    get_live_whisper_model_status, prepare_live_whisper_model, transcribe_live_snapshot,
};

use windows_loopback::{
    get_system_recording_status, start_system_recording, stop_system_recording, SystemRecorderState,
};

use windows_recorder::{
    get_recording_status, list_recordings, start_recording, stop_recording, RecorderState,
};

use windows_translation::translate_windows_segments;

use windows_whisper::{
    get_saved_transcript, get_whisper_model_status, prepare_whisper_model, transcribe_lecture,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(RecorderState::default())
        .manage(SystemRecorderState::default())
        .invoke_handler(tauri::generate_handler![
            start_recording,
            get_recording_status,
            stop_recording,
            list_recordings,
            start_system_recording,
            get_system_recording_status,
            stop_system_recording,
            list_lectures,
            adopt_recording,
            import_audio,
            rename_lecture,
            delete_lecture,
            save_lecture_markers,
            update_lecture_duration,
            set_lecture_language,
            save_lecture_translation,
            get_saved_translation,
            translate_windows_segments,
            get_live_whisper_model_status,
            prepare_live_whisper_model,
            transcribe_live_snapshot,
            get_whisper_model_status,
            prepare_whisper_model,
            get_saved_transcript,
            transcribe_lecture
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let monitor = window
                        .current_monitor()?
                        .or(window.primary_monitor()?);

                    if let Some(monitor) = monitor {
                        // Keep the complete native window inside the Windows
                        // work area, which already excludes the taskbar.
                        const EDGE_MARGIN: u32 = 8;

                        // Phone-like outer-window aspect ratio.
                        const PHONE_WIDTH: f64 = 390.0;
                        const PHONE_HEIGHT: f64 = 844.0;
                        const PHONE_RATIO: f64 =
                            PHONE_WIDTH / PHONE_HEIGHT;

                        let work = monitor.work_area();

                        let available_height =
                            work.size.height.saturating_sub(
                                EDGE_MARGIN * 2
                            );

                        // Measure Windows decorations/title bar so that
                        // set_size(inner) produces the requested OUTER size.
                        let current_outer =
                            window.outer_size()?;
                        let current_inner =
                            window.inner_size()?;

                        let chrome_width =
                            current_outer
                                .width
                                .saturating_sub(
                                    current_inner.width
                                );

                        let chrome_height =
                            current_outer
                                .height
                                .saturating_sub(
                                    current_inner.height
                                );

                        let target_outer_height =
                            available_height;

                        let target_outer_width =
                            (
                                target_outer_height as f64 *
                                PHONE_RATIO
                            )
                            .round()
                            .max(280.0) as u32;

                        let target_inner_width =
                            target_outer_width
                                .saturating_sub(chrome_width)
                                .max(240);

                        let target_inner_height =
                            target_outer_height
                                .saturating_sub(chrome_height)
                                .max(320);

                        window.set_size(
                            PhysicalSize::new(
                                target_inner_width,
                                target_inner_height,
                            )
                        )?;

                        // Center horizontally in the monitor work area.
                        // Keep a small native gap at top and above taskbar.
                        let x =
                            work.position.x +
                            (
                                (
                                    work.size.width
                                        .saturating_sub(
                                            target_outer_width
                                        )
                                ) / 2
                            ) as i32;

                        let y =
                            work.position.y +
                            EDGE_MARGIN as i32;

                        window.set_position(
                            PhysicalPosition::new(x, y)
                        )?;
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
