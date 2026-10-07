import AVFoundation
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
  private var livePendingProcessor: LiveRecorderAudioProcessor?
  private var liveCleanupSession: LiveWhisperSession?
  private let timingQueue = DispatchQueue(
    label: "com.norsktrainer.whisper-audio-timing",
    qos: .utility
  )

  private func appendTimingEvent(
    _ event: String,
    timingLogUri: String,
    details: String? = nil
  ) {
    guard
      let logURL = URL(string: timingLogUri),
      logURL.isFileURL
    else {
      return
    }

    let timestamp = ISO8601DateFormatter().string(from: Date())
    let uptimeMillis = Int(ProcessInfo.processInfo.systemUptime * 1000.0)
    let suffix = details.map { " | \($0)" } ?? ""
    let line = "\(timestamp) | uptimeMs=\(uptimeMillis) | \(event) | lecture=-\(suffix)\n"

    timingQueue.async {
      do {
        try FileManager.default.createDirectory(
          at: logURL.deletingLastPathComponent(),
          withIntermediateDirectories: true
        )
        let data = Data(line.utf8)
        if FileManager.default.fileExists(atPath: logURL.path) {
          let handle = try FileHandle(forWritingTo: logURL)
          defer { try? handle.close() }
          try handle.seekToEnd()
          try handle.write(contentsOf: data)
        } else {
          try data.write(to: logURL, options: .atomic)
        }
      } catch {
        // Telemetry must never change Live behavior.
      }
    }
  }

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

    AsyncFunction("transcribeSegment") {
      (
        previousAudioUri: String,
        audioUri: String,
        language: String,
        model: String,
        globalStartSeconds: Double,
        overlapSeconds: Double
      ) async throws -> [String: Any] in

      let selectedModel = model.isEmpty
        ? defaultWhisperModel
        : model

      let selectedLanguage = language.isEmpty
        ? "no"
        : language

      let currentPath = try self.filePath(
        from: audioUri
      )

      guard FileManager.default.fileExists(
        atPath: currentPath
      ) else {
        throw NSError(
          domain: "WhisperKitLocal",
          code: 41,
          userInfo: [
            NSLocalizedDescriptionKey:
              "Segment audio file does not exist: \(currentPath)"
          ]
        )
      }

      let previousPath = previousAudioUri.isEmpty
        ? nil
        : try self.filePath(from: previousAudioUri)

      if let previousPath {
        guard FileManager.default.fileExists(
          atPath: previousPath
        ) else {
          throw NSError(
            domain: "WhisperKitLocal",
            code: 42,
            userInfo: [
              NSLocalizedDescriptionKey:
                "Previous segment audio file does not exist: \(previousPath)"
            ]
          )
        }
      }

      let window = try await self.makeSegmentTranscriptionWindow(
        previousPath: previousPath,
        currentPath: currentPath,
        requestedOverlapSeconds: overlapSeconds
      )

      defer {
        try? FileManager.default.removeItem(
          at: window.url
        )
      }

      let globalOffsetSeconds = max(
        0,
        globalStartSeconds - window.actualOverlapSeconds
      )

      let kit = try await self.getOrCreateWhisperKit(
        model: selectedModel
      )

      let sink = WhisperEventSink(
        module: self
      )

      sink.emit(
        stage: "transcribing",
        message: "Transcribing durable segment window"
      )

      let decodingOptions = DecodingOptions(
        task: .transcribe,
        language: selectedLanguage,
        skipSpecialTokens: true,
        wordTimestamps: false,
        maxInitialTimestamp: 1.0,
        chunkingStrategy: .none
      )

      let results = try await kit.transcribe(
        audioPath: window.url.path,
        decodeOptions: decodingOptions,
        callback: { progress in
          sink.emit(
            stage: "transcribing",
            text: progress.text,
            window: progress.windowId,
            message: "Processing durable segment"
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
              "start":
                Double(segment.start) + globalOffsetSeconds,
              "end":
                Double(segment.end) + globalOffsetSeconds,
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
        message: "Durable segment transcript ready"
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
        "chunkingStrategy": "none",
        "source": "segment-window",
        "globalOffsetSeconds": globalOffsetSeconds,
        "overlapSeconds": window.actualOverlapSeconds
      ]
    }

    AsyncFunction("transcribeTail") {
      (
        audioUri: String,
        language: String,
        model: String,
        startSeconds: Double,
        overlapSeconds: Double
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
          code: 51,
          userInfo: [
            NSLocalizedDescriptionKey:
              "Tail transcription audio file does not exist: \(audioPath)"
          ]
        )
      }

      let window = try await self.makeTailTranscriptionWindow(
        audioPath: audioPath,
        requestedStartSeconds: startSeconds,
        requestedOverlapSeconds: overlapSeconds
      )

      defer {
        try? FileManager.default.removeItem(
          at: window.url
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
        message: "Transcribing final Live tail"
      )

      let decodingOptions = DecodingOptions(
        task: .transcribe,
        language: selectedLanguage,
        skipSpecialTokens: true,
        wordTimestamps: false,
        maxInitialTimestamp: 1.0,
        chunkingStrategy: .none
      )

      let results = try await kit.transcribe(
        audioPath: window.url.path,
        decodeOptions: decodingOptions,
        callback: { progress in
          sink.emit(
            stage: "transcribing",
            text: progress.text,
            window: progress.windowId,
            message: "Processing final Live tail"
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

      let orderedSegments = results
        .flatMap(\.segments)
        .sorted {
          $0.start < $1.start
        }

      let segments: [[String: Any]] =
        orderedSegments.map { segment in
          [
            "start":
              Double(segment.start) + window.globalOffsetSeconds,
            "end":
              Double(segment.end) + window.globalOffsetSeconds,
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
        message: "Final Live tail transcript ready"
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
        "chunkingStrategy": "none",
        "source": "tail-window",
        "globalOffsetSeconds": window.globalOffsetSeconds,
        "overlapSeconds": window.actualOverlapSeconds,
        "requestedStartSeconds": max(0, startSeconds)
      ]
    }

    AsyncFunction("startLive") {
      (
        audioUri: String,
        language: String,
        model: String,
        timingLogUri: String
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
      let processor = try LiveRecorderAudioProcessor(
        outputURL: outputURL
      )

      try processor.beginCapture()
      self.livePendingProcessor = processor

      do {
        self.appendTimingEvent(
          "LIVE_MODEL_LOADING",
          timingLogUri: timingLogUri,
          details: "model=\(selectedModel)"
        )

        let kit = try await self.getOrCreateWhisperKit(
          model: selectedModel
        )

        self.appendTimingEvent(
          "LIVE_MODEL_READY",
          timingLogUri: timingLogUri,
          details: "model=\(selectedModel)"
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

  private struct SegmentTranscriptionWindow {
    let url: URL
    let actualOverlapSeconds: Double
  }

  private func makeSegmentTranscriptionWindow(
    previousPath: String?,
    currentPath: String,
    requestedOverlapSeconds: Double
  ) async throws -> SegmentTranscriptionWindow {
    let currentURL = URL(fileURLWithPath: currentPath)
    let currentAsset = AVURLAsset(url: currentURL)

    guard
      let currentTrack = currentAsset
        .tracks(withMediaType: .audio)
        .first
    else {
      throw NSError(
        domain: "WhisperKitLocal",
        code: 43,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Current durable segment has no readable audio track."
        ]
      )
    }

    let currentDuration = currentAsset.duration

    guard
      currentDuration.isValid,
      currentDuration.seconds.isFinite,
      currentDuration.seconds > 0
    else {
      throw NSError(
        domain: "WhisperKitLocal",
        code: 44,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Current durable segment has an invalid duration."
        ]
      )
    }

    let composition = AVMutableComposition()

    guard
      let compositionTrack = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
      )
    else {
      throw NSError(
        domain: "WhisperKitLocal",
        code: 45,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Could not create a segment transcription composition."
        ]
      )
    }

    var cursor = CMTime.zero
    var actualOverlapSeconds = 0.0

    if
      let previousPath,
      requestedOverlapSeconds > 0
    {
      let previousURL = URL(fileURLWithPath: previousPath)
      let previousAsset = AVURLAsset(url: previousURL)

      guard
        let previousTrack = previousAsset
          .tracks(withMediaType: .audio)
          .first
      else {
        throw NSError(
          domain: "WhisperKitLocal",
          code: 46,
          userInfo: [
            NSLocalizedDescriptionKey:
              "Previous durable segment has no readable audio track."
          ]
        )
      }

      let previousDuration = previousAsset.duration

      guard
        previousDuration.isValid,
        previousDuration.seconds.isFinite,
        previousDuration.seconds > 0
      else {
        throw NSError(
          domain: "WhisperKitLocal",
          code: 47,
          userInfo: [
            NSLocalizedDescriptionKey:
              "Previous durable segment has an invalid duration."
          ]
        )
      }

      actualOverlapSeconds = min(
        max(0, requestedOverlapSeconds),
        previousDuration.seconds
      )

      if actualOverlapSeconds > 0 {
        let overlapDuration = CMTime(
          seconds: actualOverlapSeconds,
          preferredTimescale: 600
        )

        let overlapStart = CMTimeSubtract(
          previousDuration,
          overlapDuration
        )

        try compositionTrack.insertTimeRange(
          CMTimeRange(
            start: overlapStart,
            duration: overlapDuration
          ),
          of: previousTrack,
          at: cursor
        )

        cursor = CMTimeAdd(
          cursor,
          overlapDuration
        )
      }
    }

    try compositionTrack.insertTimeRange(
      CMTimeRange(
        start: .zero,
        duration: currentDuration
      ),
      of: currentTrack,
      at: cursor
    )

    let temporaryURL = FileManager.default
      .temporaryDirectory
      .appendingPathComponent(
        "norsktrainer-segment-window-\(UUID().uuidString).m4a"
      )

    guard
      let exporter = AVAssetExportSession(
        asset: composition,
        presetName: AVAssetExportPresetAppleM4A
      )
    else {
      throw NSError(
        domain: "WhisperKitLocal",
        code: 48,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Could not create the segment transcription export session."
        ]
      )
    }

    exporter.outputURL = temporaryURL
    exporter.outputFileType = .m4a
    exporter.shouldOptimizeForNetworkUse = false

    try await withCheckedThrowingContinuation {
      (continuation: CheckedContinuation<Void, Error>) in
      exporter.exportAsynchronously {
        switch exporter.status {
        case .completed:
          continuation.resume(returning: ())

        case .failed,
             .cancelled:
          continuation.resume(
            throwing:
              exporter.error ?? NSError(
                domain: "WhisperKitLocal",
                code: 49,
                userInfo: [
                  NSLocalizedDescriptionKey:
                    "Segment transcription window export failed."
                ]
              )
          )

        default:
          continuation.resume(
            throwing: NSError(
              domain: "WhisperKitLocal",
              code: 50,
              userInfo: [
                NSLocalizedDescriptionKey:
                  "Segment transcription window export ended in an unexpected state."
              ]
            )
          )
        }
      }
    }

    return SegmentTranscriptionWindow(
      url: temporaryURL,
      actualOverlapSeconds: actualOverlapSeconds
    )
  }

  private struct TailTranscriptionWindow {
    let url: URL
    let globalOffsetSeconds: Double
    let actualOverlapSeconds: Double
  }

  private func makeTailTranscriptionWindow(
    audioPath: String,
    requestedStartSeconds: Double,
    requestedOverlapSeconds: Double
  ) async throws -> TailTranscriptionWindow {
    let audioURL = URL(fileURLWithPath: audioPath)
    let asset = AVURLAsset(url: audioURL)

    guard
      let track = asset
        .tracks(withMediaType: .audio)
        .first
    else {
      throw NSError(
        domain: "WhisperKitLocal",
        code: 52,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Live tail source has no readable audio track."
        ]
      )
    }

    let duration = asset.duration

    guard
      duration.isValid,
      duration.seconds.isFinite,
      duration.seconds > 0
    else {
      throw NSError(
        domain: "WhisperKitLocal",
        code: 53,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Live tail source has an invalid duration."
        ]
      )
    }

    let safeStart = min(
      max(0, requestedStartSeconds),
      duration.seconds
    )

    let actualOverlap = min(
      max(0, requestedOverlapSeconds),
      safeStart
    )

    let windowStart = max(
      0,
      safeStart - actualOverlap
    )

    let windowDurationSeconds =
      duration.seconds - windowStart

    guard windowDurationSeconds > 0 else {
      throw NSError(
        domain: "WhisperKitLocal",
        code: 54,
        userInfo: [
          NSLocalizedDescriptionKey:
            "No Live audio remains after the requested tail start."
        ]
      )
    }

    let composition = AVMutableComposition()

    guard
      let compositionTrack = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
      )
    else {
      throw NSError(
        domain: "WhisperKitLocal",
        code: 55,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Could not create the Live tail transcription composition."
        ]
      )
    }

    try compositionTrack.insertTimeRange(
      CMTimeRange(
        start: CMTime(
          seconds: windowStart,
          preferredTimescale: 600
        ),
        duration: CMTime(
          seconds: windowDurationSeconds,
          preferredTimescale: 600
        )
      ),
      of: track,
      at: .zero
    )

    let temporaryURL = FileManager.default
      .temporaryDirectory
      .appendingPathComponent(
        "norsktrainer-live-tail-\(UUID().uuidString).m4a"
      )

    guard
      let exporter = AVAssetExportSession(
        asset: composition,
        presetName: AVAssetExportPresetAppleM4A
      )
    else {
      throw NSError(
        domain: "WhisperKitLocal",
        code: 56,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Could not create the Live tail export session."
        ]
      )
    }

    exporter.outputURL = temporaryURL
    exporter.outputFileType = .m4a
    exporter.shouldOptimizeForNetworkUse = false

    try await withCheckedThrowingContinuation {
      (continuation: CheckedContinuation<Void, Error>) in
      exporter.exportAsynchronously {
        switch exporter.status {
        case .completed:
          continuation.resume(returning: ())

        case .failed,
             .cancelled:
          continuation.resume(
            throwing:
              exporter.error ?? NSError(
                domain: "WhisperKitLocal",
                code: 57,
                userInfo: [
                  NSLocalizedDescriptionKey:
                    "Live tail transcription window export failed."
                ]
              )
          )

        default:
          continuation.resume(
            throwing: NSError(
              domain: "WhisperKitLocal",
              code: 58,
              userInfo: [
                NSLocalizedDescriptionKey:
                  "Live tail transcription window export ended in an unexpected state."
              ]
            )
          )
        }
      }
    }

    return TailTranscriptionWindow(
      url: temporaryURL,
      globalOffsetSeconds: windowStart,
      actualOverlapSeconds: actualOverlap
    )
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
