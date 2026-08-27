import ExpoModulesCore
import Foundation
import WhisperKit

private let defaultWhisperModel = "large-v3-v20240930_626MB"

private final class WhisperEventSink: @unchecked Sendable {
  weak var module: WhisperKitLocalModule?

  init(module: WhisperKitLocalModule) {
    self.module = module
  }

  func emit(
    stage: String,
    text: String = "",
    window: Int = 0,
    message: String = ""
  ) {
    module?.sendEvent("onProgress", [
      "stage": stage,
      "text": text,
      "window": window,
      "message": message
    ])
  }
}

public class WhisperKitLocalModule: Module {
  private var whisperKit: WhisperKit?
  private var loadedModel: String?

  public func definition() -> ModuleDefinition {
    Name("WhisperKitLocal")

    Events("onProgress")

    AsyncFunction("prepareModel") {
      (model: String) async throws -> [String: Any] in

      let selectedModel = model.isEmpty
        ? defaultWhisperModel
        : model

      self.sendEvent("onProgress", [
        "stage": "preparing-model",
        "text": "",
        "window": 0,
        "message": selectedModel
      ])

      _ = try await self.getOrCreateWhisperKit(
        model: selectedModel
      )

      self.sendEvent("onProgress", [
        "stage": "model-ready",
        "text": "",
        "window": 0,
        "message": selectedModel
      ])

      return [
        "ok": true,
        "model": selectedModel
      ]
    }

    AsyncFunction("transcribe") {
      (
        audioUri: String,
        language: String,
        model: String
      ) async throws -> [String: Any] in

      let selectedModel = model.isEmpty
        ? defaultWhisperModel
        : model

      let selectedLanguage = language.isEmpty
        ? "no"
        : language

      let audioPath = try self.filePath(
        from: audioUri
      )

      guard FileManager.default.fileExists(
        atPath: audioPath
      ) else {
        throw NSError(
          domain: "WhisperKitLocal",
          code: 1,
          userInfo: [
            NSLocalizedDescriptionKey:
              "Audio file does not exist: \(audioPath)"
          ]
        )
      }

      let kit = try await self.getOrCreateWhisperKit(
        model: selectedModel
      )

      let sink = WhisperEventSink(
        module: self
      )

      sink.emit(
        stage: "transcribing",
        message: "Starting local transcription"
      )

      /*
       * Accuracy-first mode for lecture testing.
       *
       * Do not use incremental loading here: WhisperKit can
       * split incremental input with VAD before decoding.
       * Full-file loading lets the decoder inspect the complete
       * recording, including speech near the beginning.
       */
      let decodingOptions = DecodingOptions(
        task: .transcribe,
        language: selectedLanguage,
        skipSpecialTokens: true,
        wordTimestamps: false,
        maxInitialTimestamp: 1.0,
        chunkingStrategy: .none
      )

      let results = try await kit.transcribe(
        audioPath: audioPath,
        decodeOptions: decodingOptions,
        callback: { progress in
          sink.emit(
            stage: "transcribing",
            text: progress.text,
            window: progress.windowId,
            message: "Processing"
          )

          return true
        }
      )

      let text = results
        .map(\.text)
        .joined(separator: " ")
        .replacingOccurrences(
          of: #"\s+"#,
          with: " ",
          options: .regularExpression
        )
        .trimmingCharacters(
          in: .whitespacesAndNewlines
        )

      let orderedSegments =
        results
          .flatMap(\.segments)
          .sorted {
            $0.start < $1.start
          }

      let segments: [[String: Any]] =
        orderedSegments
          .map { segment in
            [
              "start": Double(segment.start),
              "end": Double(segment.end),
              "text": segment.text,
              "noSpeechProb":
                Double(segment.noSpeechProb),
              "avgLogProb":
                Double(segment.avgLogprob)
            ]
          }

      sink.emit(
        stage: "done",
        text: text,
        message: "Transcript ready"
      )

      return [
        "ok": true,
        "model": selectedModel,
        "language":
          results.first?.language
          ?? selectedLanguage,
        "text": text,
        "segments": segments,
        "characters": text.count,
        "audioLoadingMode": "full-file",
        "chunkingStrategy": "none"
      ]
    }
  }

  private func getOrCreateWhisperKit(
    model: String
  ) async throws -> WhisperKit {

    if let existing = whisperKit,
       loadedModel == model {
      return existing
    }

    /*
     * prewarm=true lowers peak model-specialization memory.
     * download=true downloads the Core ML model on first use.
     */
    let config = WhisperKitConfig(
      model: model,
      verbose: false,
      prewarm: true,
      load: true,
      download: true,
      useBackgroundDownloadSession: false
    )

    let created = try await WhisperKit(
      config
    )

    whisperKit = created
    loadedModel = model

    return created
  }

  private func filePath(
    from value: String
  ) throws -> String {

    if value.hasPrefix("file://") {
      if let url = URL(
        string: value
      ) {
        return url.path
      }
    }

    return value
  }
}
