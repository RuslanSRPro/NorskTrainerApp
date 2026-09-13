use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use ct2rs::tokenizers::sentencepiece::Tokenizer as SentencePieceTokenizer;
use ct2rs::{
    ComputeType,
    Config,
    Device,
    Tokenizer,
    TranslationOptions,
    Translator,
};

const EOS_TOKEN: &str = "</s>";
const BOS_TOKEN: &str = "<s>";
const PAD_TOKEN: &str = "<pad>";

#[derive(Debug, Clone, Copy)]
pub enum TranslationSourceLanguage {
    Norwegian,
    English,
}

impl TranslationSourceLanguage {
    fn token(self) -> &'static str {
        match self {
            Self::Norwegian => "__no__",
            Self::English => "__en__",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum TranslationTargetLanguage {
    Ukrainian,
    Russian,
}

impl TranslationTargetLanguage {
    fn token(self) -> &'static str {
        match self {
            Self::Ukrainian => "__uk__",
            Self::Russian => "__ru__",
        }
    }
}

pub struct M2m100Tokenizer {
    inner: SentencePieceTokenizer,
    source_language: TranslationSourceLanguage,
}

impl M2m100Tokenizer {
    pub fn new(
        sentencepiece_model: &Path,
        source_language: TranslationSourceLanguage,
    ) -> Result<Self> {
        let inner = SentencePieceTokenizer::from_file(
            sentencepiece_model,
            sentencepiece_model,
        )?;

        Ok(Self {
            inner,
            source_language,
        })
    }
}

impl Tokenizer for M2m100Tokenizer {
    fn encode(&self, input: &str) -> Result<Vec<String>> {
        let mut tokens = self.inner.encode(input)?;

        tokens.insert(
            0,
            self.source_language.token().to_owned(),
        );

        Ok(tokens)
    }

    fn decode(&self, tokens: Vec<String>) -> Result<String> {
        let filtered = tokens
            .into_iter()
            .filter(|token| {
                token != EOS_TOKEN
                    && token != BOS_TOKEN
                    && token != PAD_TOKEN
                    && !is_language_token(token)
            })
            .collect::<Vec<_>>();

        self.inner.decode(filtered)
    }
}

fn is_language_token(token: &str) -> bool {
    token.starts_with("__") && token.ends_with("__")
}

pub struct M2m100Translator {
    translator: Translator<M2m100Tokenizer>,
}

impl M2m100Translator {
    pub fn load(
        model_dir: &Path,
        source_language: TranslationSourceLanguage,
    ) -> Result<Self> {
        validate_model(model_dir)?;

        let sentencepiece_model =
            model_dir.join("sentencepiece.bpe.model");

        let tokenizer = M2m100Tokenizer::new(
            &sentencepiece_model,
            source_language,
        )?;

        let config = Config {
            device: Device::CPU,
            compute_type: ComputeType::INT8,
            num_threads_per_replica: 4,
            ..Default::default()
        };

        let translator = Translator::with_tokenizer(
            model_dir,
            tokenizer,
            &config,
        )?;

        Ok(Self { translator })
    }

    pub fn translate(
        &self,
        target_language: TranslationTargetLanguage,
        text: &str,
    ) -> Result<String> {
        if text.trim().is_empty() {
            return Ok(String::new());
        }

        let sources = vec![text];

        let target_prefixes = vec![
            vec![target_language.token()],
        ];

        let options = TranslationOptions::<String, String> {
            beam_size: 4,
            num_hypotheses: 1,
            ..Default::default()
        };

        let results =
            self.translator.translate_batch_with_target_prefix(
                &sources,
                &target_prefixes,
                &options,
                None,
            )?;

        results
            .into_iter()
            .next()
            .map(|(text, _score)| text)
            .ok_or_else(|| {
                anyhow!("M2M100 returned no translation")
            })
    }
}


#[derive(Debug, Clone, PartialEq)]
pub struct TranslatedChunk {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

impl M2m100Translator {
    pub fn translate_chunks(
        &self,
        target_language: TranslationTargetLanguage,
        segments: &[TranslationSourceSegment],
    ) -> Result<Vec<TranslatedChunk>> {
        let chunks = build_translation_chunks(segments);

        let mut translated = Vec::with_capacity(chunks.len());

        for chunk in chunks {
            let text = self.translate(
                target_language,
                &chunk.text,
            )?;

            translated.push(TranslatedChunk {
                start: chunk.start,
                end: chunk.end,
                text,
            });
        }

        Ok(translated)
    }
}
fn validate_model(model_dir: &Path) -> Result<()> {
    let model_file = model_dir.join("model.bin");

    if !model_file.is_file() {
        return Err(anyhow!(
            "M2M100 model.bin not found: {}",
            model_file.display()
        ));
    }

    let sentencepiece_model =
        model_dir.join("sentencepiece.bpe.model");

    if !sentencepiece_model.is_file() {
        return Err(anyhow!(
            "M2M100 SentencePiece model not found: {}",
            sentencepiece_model.display()
        ));
    }

    Ok(())
}

pub fn translate_text(
    model_dir: &Path,
    source_language: TranslationSourceLanguage,
    target_language: TranslationTargetLanguage,
    text: &str,
) -> Result<String> {
    let translator =
        M2m100Translator::load(model_dir, source_language)?;

    translator.translate(target_language, text)
}

#[derive(Debug, Clone, PartialEq)]
pub struct TranslationSourceSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TranslationChunk {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

const TRANSLATION_CHUNK_MAX_CHARS: usize = 260;
const TRANSLATION_CHUNK_MAX_SECONDS: f64 = 18.0;
const TRANSLATION_CHUNK_PAUSE_SECONDS: f64 = 1.2;

pub fn build_translation_chunks(
    segments: &[TranslationSourceSegment],
) -> Vec<TranslationChunk> {
    let mut chunks = Vec::new();

    let mut current_start = 0.0;
    let mut current_end = 0.0;
    let mut current_text = String::new();
    let mut has_current = false;

    for segment in segments {
        let text = segment.text.trim();

        if text.is_empty() {
            continue;
        }

        if !has_current {
            current_start = segment.start;
            current_end = segment.end;
            current_text.push_str(text);
            has_current = true;
        } else {
            let pause =
                (segment.start - current_end).max(0.0);

            let projected_chars =
                current_text.len() + 1 + text.len();

            let projected_duration =
                segment.end - current_start;

            let previous_is_complete =
                ends_sentence(&current_text);

            let should_flush_before =
                previous_is_complete
                    || pause >= TRANSLATION_CHUNK_PAUSE_SECONDS
                    || projected_chars > TRANSLATION_CHUNK_MAX_CHARS
                    || projected_duration > TRANSLATION_CHUNK_MAX_SECONDS;

            if should_flush_before {
                chunks.push(TranslationChunk {
                    start: current_start,
                    end: current_end,
                    text: current_text.trim().to_owned(),
                });

                current_start = segment.start;
                current_end = segment.end;
                current_text.clear();
                current_text.push_str(text);
            } else {
                current_text.push(' ');
                current_text.push_str(text);
                current_end = segment.end;
            }
        }

        if ends_sentence(&current_text) {
            chunks.push(TranslationChunk {
                start: current_start,
                end: current_end,
                text: current_text.trim().to_owned(),
            });

            current_text.clear();
            has_current = false;
        }
    }

    if has_current && !current_text.trim().is_empty() {
        chunks.push(TranslationChunk {
            start: current_start,
            end: current_end,
            text: current_text.trim().to_owned(),
        });
    }

    chunks
}

fn ends_sentence(text: &str) -> bool {
    let trimmed = text.trim_end();

    trimmed.ends_with('.')
        || trimmed.ends_with('!')
        || trimmed.ends_with('?')
        || trimmed.ends_with('…')
}


const TRANSLATION_MODEL_DIR_NAME: &str = "m2m100-418m-int8";

static NORWEGIAN_TRANSLATOR: OnceLock<
    Mutex<Option<(PathBuf, Arc<M2m100Translator>)>>,
> = OnceLock::new();

static ENGLISH_TRANSLATOR: OnceLock<
    Mutex<Option<(PathBuf, Arc<M2m100Translator>)>>,
> = OnceLock::new();

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsTranslationInputSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsNativeTranslationSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowsNativeTranslationResult {
    pub source: String,
    pub target: String,
    pub text: String,
    pub segments: Vec<WindowsNativeTranslationSegment>,
}

fn translation_model_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| {
            path.join("models")
                .join(TRANSLATION_MODEL_DIR_NAME)
        })
        .map_err(|error| {
            format!(
                "Could not resolve NorskTrainer translation model directory: {error}"
            )
        })
}

fn normalize_source_language(
    language: &str,
) -> Result<TranslationSourceLanguage, String> {
    match language.trim().to_ascii_lowercase().as_str() {
        "no" | "nb" => Ok(TranslationSourceLanguage::Norwegian),
        "en" => Ok(TranslationSourceLanguage::English),
        _ => Err(
            "Unsupported translation source language.".to_string()
        ),
    }
}

fn normalize_target_language(
    language: &str,
) -> Result<TranslationTargetLanguage, String> {
    match language.trim().to_ascii_lowercase().as_str() {
        "uk" => Ok(TranslationTargetLanguage::Ukrainian),
        "ru" => Ok(TranslationTargetLanguage::Russian),
        _ => Err(
            "Unsupported translation target language.".to_string()
        ),
    }
}

fn translator_cache(
    source: TranslationSourceLanguage,
) -> &'static Mutex<Option<(PathBuf, Arc<M2m100Translator>)>> {
    match source {
        TranslationSourceLanguage::Norwegian => {
            NORWEGIAN_TRANSLATOR.get_or_init(|| Mutex::new(None))
        }
        TranslationSourceLanguage::English => {
            ENGLISH_TRANSLATOR.get_or_init(|| Mutex::new(None))
        }
    }
}

fn load_cached_translator(
    model_dir: &Path,
    source: TranslationSourceLanguage,
) -> Result<Arc<M2m100Translator>, String> {
    let cache = translator_cache(source);

    {
        let guard = cache
            .lock()
            .map_err(|_| {
                "Translation model cache lock failed.".to_string()
            })?;

        if let Some((cached_path, translator)) = guard.as_ref() {
            if cached_path == model_dir {
                return Ok(Arc::clone(translator));
            }
        }
    }

    let translator = Arc::new(
        M2m100Translator::load(
            model_dir,
            source,
        )
        .map_err(|error| {
            format!(
                "Could not load M2M100 translation model: {error}"
            )
        })?,
    );

    let mut guard = cache
        .lock()
        .map_err(|_| {
            "Translation model cache lock failed.".to_string()
        })?;

    *guard = Some((
        model_dir.to_path_buf(),
        Arc::clone(&translator),
    ));

    Ok(translator)
}

#[tauri::command]
pub async fn translate_windows_segments(
    app: AppHandle,
    source: String,
    target: String,
    segments: Vec<WindowsTranslationInputSegment>,
) -> Result<WindowsNativeTranslationResult, String> {
    let source_language =
        normalize_source_language(&source)?;

    let target_language =
        normalize_target_language(&target)?;

    let model_dir = translation_model_dir(&app)?;

    let source_segments = segments
        .into_iter()
        .map(|segment| TranslationSourceSegment {
            start: segment.start,
            end: segment.end,
            text: segment.text,
        })
        .collect::<Vec<_>>();

    if source_segments.is_empty() {
        return Err(
            "No transcript segments to translate.".to_string()
        );
    }

    /*
     * CTranslate2 inference is blocking CPU work.
     * Keep it off the Tauri async runtime thread.
     */
    let translated = tauri::async_runtime::spawn_blocking(
        move || -> Result<Vec<TranslatedChunk>, String> {
            let translator = load_cached_translator(
                &model_dir,
                source_language,
            )?;

            translator
                .translate_chunks(
                    target_language,
                    &source_segments,
                )
                .map_err(|error| {
                    format!("Translation failed: {error}")
                })
        },
    )
    .await
    .map_err(|error| {
        format!("Translation worker failed: {error}")
    })??;

    let output_segments = translated
        .into_iter()
        .map(|segment| WindowsNativeTranslationSegment {
            start: segment.start,
            end: segment.end,
            text: segment.text,
        })
        .collect::<Vec<_>>();

    let text = output_segments
        .iter()
        .map(|segment| segment.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");

    Ok(WindowsNativeTranslationResult {
        source: match source_language {
            TranslationSourceLanguage::Norwegian => "no",
            TranslationSourceLanguage::English => "en",
        }
        .to_string(),

        target: match target_language {
            TranslationTargetLanguage::Ukrainian => "uk",
            TranslationTargetLanguage::Russian => "ru",
        }
        .to_string(),

        text,
        segments: output_segments,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segment(
        start: f64,
        end: f64,
        text: &str,
    ) -> TranslationSourceSegment {
        TranslationSourceSegment {
            start,
            end,
            text: text.to_owned(),
        }
    }

    #[test]
    fn chunker_merges_whisper_segments_into_sentence() {
        let segments = vec![
            segment(
                10.0,
                13.2,
                "Det er viktig å forstå",
            ),
            segment(
                13.2,
                15.1,
                "hvordan markedet fungerer",
            ),
            segment(
                15.1,
                17.4,
                "før vi tar en beslutning.",
            ),
        ];

        let chunks = build_translation_chunks(&segments);

        assert_eq!(chunks.len(), 1);

        assert_eq!(chunks[0].start, 10.0);
        assert_eq!(chunks[0].end, 17.4);

        assert_eq!(
            chunks[0].text,
            "Det er viktig å forstå hvordan markedet fungerer før vi tar en beslutning."
        );
    }

    #[test]
    fn chunker_starts_new_chunk_after_sentence_boundary() {
        let segments = vec![
            segment(
                0.0,
                2.0,
                "Dette er første setning.",
            ),
            segment(
                2.1,
                4.0,
                "Dette er neste",
            ),
            segment(
                4.0,
                5.5,
                "setning.",
            ),
        ];

        let chunks = build_translation_chunks(&segments);

        assert_eq!(chunks.len(), 2);

        assert_eq!(
            chunks[0].text,
            "Dette er første setning."
        );

        assert_eq!(
            chunks[1].text,
            "Dette er neste setning."
        );

        assert_eq!(chunks[0].start, 0.0);
        assert_eq!(chunks[0].end, 2.0);

        assert_eq!(chunks[1].start, 2.1);
        assert_eq!(chunks[1].end, 5.5);
    }

    #[test]
    fn chunker_splits_on_long_pause_without_punctuation() {
        let segments = vec![
            segment(
                0.0,
                2.0,
                "Vi analyserer avtalen",
            ),
            segment(
                3.5,
                5.0,
                "og finner besparelser",
            ),
        ];

        let chunks = build_translation_chunks(&segments);

        assert_eq!(chunks.len(), 2);

        assert_eq!(
            chunks[0].text,
            "Vi analyserer avtalen"
        );

        assert_eq!(
            chunks[1].text,
            "og finner besparelser"
        );
    }

    #[test]
    fn chunker_ignores_empty_segments() {
        let segments = vec![
            segment(
                0.0,
                1.0,
                "   ",
            ),
            segment(
                1.0,
                2.0,
                "Dette fungerer.",
            ),
            segment(
                2.0,
                3.0,
                "",
            ),
        ];

        let chunks = build_translation_chunks(&segments);

        assert_eq!(chunks.len(), 1);

        assert_eq!(
            chunks[0].text,
            "Dette fungerer."
        );

        assert_eq!(chunks[0].start, 1.0);
        assert_eq!(chunks[0].end, 2.0);
    }
}
