#[path = "../src/windows_translation.rs"]
mod windows_translation;

use std::path::PathBuf;
use std::time::Instant;

use windows_translation::{
    translate_text,
    M2m100Translator,
    TranslationSourceLanguage,
    TranslationSourceSegment,
    TranslationTargetLanguage,
};

const TEST_TEXT: &str =
    "Det er viktig å forstå hvordan markedet fungerer før vi tar en beslutning.";

fn model_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(".translation-lab")
        .join("models")
        .join("m2m100-418m-int8")
}

#[test]
#[ignore = "loads the local 500 MB M2M100 model"]
fn m2m100_native_no_to_uk_and_ru() {
    let model = model_dir();

    println!("MODEL: {}", model.display());
    println!("SOURCE: {TEST_TEXT}");

    let started = Instant::now();

    let uk = translate_text(
        &model,
        TranslationSourceLanguage::Norwegian,
        TranslationTargetLanguage::Ukrainian,
        TEST_TEXT,
    )
    .expect("NO -> UK translation failed");

    let uk_elapsed = started.elapsed();

    println!();
    println!("UK: {uk}");
    println!("UK elapsed: {:.3}s", uk_elapsed.as_secs_f64());

    let started = Instant::now();

    let ru = translate_text(
        &model,
        TranslationSourceLanguage::Norwegian,
        TranslationTargetLanguage::Russian,
        TEST_TEXT,
    )
    .expect("NO -> RU translation failed");

    let ru_elapsed = started.elapsed();

    println!();
    println!("RU: {ru}");
    println!("RU elapsed: {:.3}s", ru_elapsed.as_secs_f64());

    assert!(!uk.trim().is_empty());
    assert!(!ru.trim().is_empty());
}

#[test]
#[ignore = "loads the local 500 MB M2M100 model"]
fn m2m100_native_en_to_uk_and_ru() {
    let model = model_dir();

    let text =
        "It is important to understand how the market works before we make a decision.";

    println!("MODEL: {}", model.display());
    println!("SOURCE: {text}");

    let started = Instant::now();

    let uk = translate_text(
        &model,
        TranslationSourceLanguage::English,
        TranslationTargetLanguage::Ukrainian,
        text,
    )
    .expect("EN -> UK translation failed");

    println!();
    println!("UK: {uk}");
    println!("UK elapsed: {:.3}s", started.elapsed().as_secs_f64());

    let started = Instant::now();

    let ru = translate_text(
        &model,
        TranslationSourceLanguage::English,
        TranslationTargetLanguage::Russian,
        text,
    )
    .expect("EN -> RU translation failed");

    println!();
    println!("RU: {ru}");
    println!("RU elapsed: {:.3}s", started.elapsed().as_secs_f64());

    assert!(!uk.trim().is_empty());
    assert!(!ru.trim().is_empty());
}

#[test]
#[ignore = "loads the local 500 MB M2M100 model"]
fn m2m100_reuses_loaded_model() {
    let model = model_dir();

    println!("MODEL: {}", model.display());

    let started = Instant::now();

    let translator = M2m100Translator::load(
        &model,
        TranslationSourceLanguage::Norwegian,
    )
    .expect("M2M100 load failed");

    let load_elapsed = started.elapsed();

    println!(
        "MODEL LOAD: {:.3}s",
        load_elapsed.as_secs_f64()
    );

    let samples = [
        "Det er viktig å forstå hvordan markedet fungerer før vi tar en beslutning.",
        "Vi må finne den beste løsningen for kunden.",
        "Transportkostnadene kan reduseres dersom vi analyserer hele avtalen.",
    ];

    for (index, text) in samples.iter().enumerate() {
        let started = Instant::now();

        let uk = translator
            .translate(
                TranslationTargetLanguage::Ukrainian,
                text,
            )
            .expect("warm NO -> UK translation failed");

        let elapsed = started.elapsed();

        println!();
        println!("SAMPLE {} UK: {}", index + 1, uk);
        println!(
            "SAMPLE {} elapsed: {:.3}s",
            index + 1,
            elapsed.as_secs_f64()
        );

        assert!(!uk.trim().is_empty());
    }

    let started = Instant::now();

    let ru = translator
        .translate(
            TranslationTargetLanguage::Russian,
            samples[0],
        )
        .expect("warm NO -> RU translation failed");

    println!();
    println!("WARM RU: {ru}");
    println!(
        "WARM RU elapsed: {:.3}s",
        started.elapsed().as_secs_f64()
    );

    assert!(!ru.trim().is_empty());
}

#[test]
#[ignore = "loads the local 500 MB M2M100 model"]
fn m2m100_translates_semantic_chunks_with_timestamps() {
    let model = model_dir();

    let translator = M2m100Translator::load(
        &model,
        TranslationSourceLanguage::Norwegian,
    )
    .expect("M2M100 load failed");

    let segments = vec![
        TranslationSourceSegment {
            start: 10.0,
            end: 13.2,
            text: "Det er viktig å forstå".to_owned(),
        },
        TranslationSourceSegment {
            start: 13.2,
            end: 15.1,
            text: "hvordan markedet fungerer".to_owned(),
        },
        TranslationSourceSegment {
            start: 15.1,
            end: 17.4,
            text: "før vi tar en beslutning.".to_owned(),
        },
    ];

    let started = Instant::now();

    let translated = translator
        .translate_chunks(
            TranslationTargetLanguage::Ukrainian,
            &segments,
        )
        .expect("semantic translation pipeline failed");

    println!();
    println!(
        "PIPELINE elapsed: {:.3}s",
        started.elapsed().as_secs_f64()
    );

    println!("RAW SEGMENTS: {}", segments.len());
    println!("TRANSLATED CHUNKS: {}", translated.len());

    for chunk in &translated {
        println!(
            "[{:.1}-{:.1}] {}",
            chunk.start,
            chunk.end,
            chunk.text
        );
    }

    assert_eq!(translated.len(), 1);

    assert_eq!(translated[0].start, 10.0);
    assert_eq!(translated[0].end, 17.4);

    assert!(!translated[0].text.trim().is_empty());

    assert!(
        translated[0]
            .text
            .contains("ринок"),
        "Expected Ukrainian translation to contain 'ринок', got: {}",
        translated[0].text
    );
}
