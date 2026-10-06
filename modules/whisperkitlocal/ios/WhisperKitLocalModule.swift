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

private final class LiveWhisperEventSink: @unchecked Sendable {
  weak var module: WhisperKitLocalModule?

  init(module: WhisperKitLocalModule) {
    self.module = module
  }

  func emitUpdate(
    _ update: LiveWhisperUpdateSnapshot
  ) {
    module?.sendEvent(
      "onLiveUpdate",
      update.dictionary
    )
  }

  func emitError(
    _ message: String
  ) {
    module?.sendEvent(
      "onLiveError",
      ["message": message]
    )
  }
}

public class WhisperKitLocalModule: Module {
  private var whisperKit: WhisperKit?
  private var loadedModel: String?

  /*
   * Live is deliberately additive. The existing full-file
   * transcribe() path is left unchanged because it is the
   * accuracy-first path already validated for saved lectures.
   */
  private var liveSession: LiveWhisperSession?
  private var livePendingProcessor: LiveFileAudioProcessor?
  private var liveCleanupSession: LiveWhisperSession?

  public func definition() -> ModuleDefinition {
    Name("WhisperKitLocal")

    Events(
      "onProgress",
      "onLiveUpdate",
      "onLiveError"
    )

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

    AsyncFunction("startLive") {
      (
        audioUri: String,
        language: String,
        model: String
      ) async throws -> [String: Any] in

      guard
        self.liveSession == nil,
        self.livePendingProcessor == nil,
        self.liveCleanupSession == nil
      else {
        throw NSError(
          domain: "WhisperKitLocal",
          code: 30,
          userInfo: [
            NSLocalizedDescriptionKey:
              "A Live transcription is already running."
          ]
        )
      }

      let selectedModel = model.isEmpty
        ? defaultWhisperModel
        : model

      let selectedLanguage = language.isEmpty
        ? "no"
        : language

      let outputPath = try self.filePath(
        from: audioUri
      )

      let outputURL = URL(
        fileURLWithPath: outputPath
      )

      /*
       * Step 8.2: begin microphone capture before model preparation.
       * This preserves the first words even when Core ML needs several
       * seconds to load on a cold Live start. AudioStreamTranscriber later
       * attaches to the same processor and consumes the buffered samples.
       */
      let processor = try LiveFileAudioProcessor(
        outputURL: outputURL
      )

      try processor.beginCapture()
      self.livePendingProcessor = processor

      do {
        let kit = try await self.getOrCreateWhisperKit(
          model: selectedModel
        )

        guard self.livePendingProcessor === processor else {
          processor.stopRecording()
          throw NSError(
            domain: "WhisperKitLocal",
            code: 32,
            userInfo: [
              NSLocalizedDescriptionKey:
                "Live startup was cancelled."
            ]
          )
        }

        let sink = LiveWhisperEventSink(
          module: self
        )

        let session = try LiveWhisperSession(
          whisperKit: kit,
          audioURL: outputURL,
          language: selectedLanguage,
          processor: processor,
          onUpdate: { update in
            sink.emitUpdate(update)
          },
          onError: { message in
            sink.emitError(message)
          }
        )

        self.livePendingProcessor = nil
        self.liveSession = session
        session.start()
      } catch {
        processor.stopRecording()
        if self.livePendingProcessor === processor {
          self.livePendingProcessor = nil
        }
        throw error
      }

      return [
        "ok": true,
        "model": selectedModel,
        "language": selectedLanguage,
        "audioUri": outputURL.absoluteString
      ]
    }

    AsyncFunction("stopLive") {
      () async throws -> [String: Any] in

      if let pending = self.livePendingProcessor {
        /*
         * Microphone capture begins before model preparation. Stop must
         * therefore work even while startLive() is still awaiting the
         * model and no LiveWhisperSession exists yet.
         */
        self.livePendingProcessor = nil
        let result =
          pending.stopAndSnapshot()
        return result.dictionary
      }

      guard let session = self.liveSession else {
        throw NSError(
          domain: "WhisperKitLocal",
          code: 31,
          userInfo: [
            NSLocalizedDescriptionKey:
              "No Live transcription is running."
          ]
        )
      }

      let result = await session.stop()

      if result.streamCleanupTimedOut {
        /*
         * Keep native ownership after the JS-visible timeout. A new Live
         * session must not reuse WhisperKit while the previous streaming
         * transcriber is still terminating.
         */
        // Establish cleanup ownership before releasing active ownership so
        // startLive() never observes both ownership slots empty.
        self.liveCleanupSession = session
        self.liveSession = nil

        Task { [weak self, weak session] in
          guard let session else {
            return
          }

          await session
            .awaitStreamCleanupCompletion()

          guard let self else {
            return
          }

          if self.liveCleanupSession === session {
            self.liveCleanupSession = nil
          }
        }
      } else {
        self.liveSession = nil
      }

      return result.dictionary
    }

    AsyncFunction("cancelLive") {
      () async -> [String: Any] in

      if self.liveCleanupSession != nil {
        // Cleanup ownership is intentionally retained until the background
        // owner task observes real Whisper termination. cancelLive() must
        // not turn that unbounded native cleanup into an unbounded JS wait.
        return [
          "ok": true,
          "cleanupPending": true
        ]
      }

      if let pending = self.livePendingProcessor {
        pending.stopRecording()
        self.livePendingProcessor = nil
      }

      guard let session = self.liveSession else {
        return ["ok": true]
      }

      let result = await session.stop()

      if result.streamCleanupTimedOut {
        /*
         * Keep ownership of the old Whisper session until its asynchronous
         * cleanup really finishes. This prevents a new Live session from
         * starting on top of a still-terminating stream.
         */
        self.liveCleanupSession = session
        self.liveSession = nil

        Task { [weak self, weak session] in
          guard let session else {
            return
          }

          await session.awaitStreamCleanupCompletion()

          guard let self else {
            return
          }

          if self.liveCleanupSession === session {
            self.liveCleanupSession = nil
          }
        }
      } else {
        self.liveSession = nil
      }

      // Cancellation is non-destructive. Return the finalized audio result
      // to JS so it can be promoted into the durable lecture library.
      return result.dictionary
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
