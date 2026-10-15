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

  private let sessionId: String

  init(module: WhisperKitLocalModule, sessionId: String) {
    self.module = module
    self.sessionId = sessionId
  }

  func emitUpdate(
    _ update: LiveWhisperUpdateSnapshot
  ) {
    var payload = update.dictionary
    payload["sessionId"] = sessionId
    module?.sendEvent("onLiveUpdate", payload)
  }

  func emitError(
    _ message: String
  ) {
    module?.sendEvent(
      "onLiveError",
      ["message": message, "sessionId": sessionId]
    )
  }
}

// A request may stop waiting without abandoning ownership of the actual loader.
private final class WhisperModelLoadRequest: @unchecked Sendable {
  let id = UUID()
  private let lock = NSLock()
  private var cancelled = false
  private var claimed = false
  private var cancellation: (@Sendable () -> Void)?

  var isCancelled: Bool {
    lock.lock()
    defer { lock.unlock() }
    return cancelled
  }

  func checkCancellation() throws {
    if isCancelled { throw CancellationError() }
  }

  func bindCancellation(_ action: @escaping @Sendable () -> Void) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard !cancelled && !claimed else { return false }
    claimed = true
    cancellation = action
    return true
  }

  func finish() {
    lock.lock()
    cancellation = nil
    lock.unlock()
  }

  func cancel() {
    lock.lock()
    cancelled = true
    let action = cancellation
    cancellation = nil
    lock.unlock()
    action?() // Never call back into an actor while the request lock is held.
  }
}

private enum WhisperModelLoadFailure: Error, LocalizedError {
  case timedOut
  case cleanupPending
  case differentModelLoading

  var errorDescription: String? {
    switch self {
    case .timedOut:
      return "Model preparation timed out. Audio recording is preserved. The native loader is cancelling; retry when it finishes."
    case .cleanupPending:
      return "The previous model load is still terminating. No second load was started. Retry after it finishes; if it never finishes, restart the app. Saved audio is preserved."
    case .differentModelLoading:
      return "Another model is preparing. Retry after model preparation finishes."
    }
  }
}

// Only this actor owns loader tasks and publication into the cache.
// A deadline completes waiters, but never pretends the underlying task exited.
// A cancelled generation stays quarantined until its worker actually returns.
private actor WhisperModelLoadCoordinator<Model: Sendable> {
  typealias Factory = @Sendable (String) async throws -> Model
  private struct Waiter {
    let request: WhisperModelLoadRequest
    let continuation: CheckedContinuation<Model, Error>
  }
  private struct Operation {
    let id: UUID
    let model: String
    var worker: Task<Void, Never>?
    var deadline: Task<Void, Never>?
    var waiters: [UUID: Waiter] = [:]
    var cancelling = false
  }

  private let factory: Factory
  private let timeoutNanoseconds: UInt64
  private var cached: Model?
  private var cachedModel: String?
  private var active: Operation?

  init(timeoutNanoseconds: UInt64 = 40_000_000_000, factory: @escaping Factory) {
    self.timeoutNanoseconds = timeoutNanoseconds
    self.factory = factory
  }

  var cleanupPending: Bool { active?.cancelling == true }
  var waitingRequestCount: Int { active?.waiters.count ?? 0 }

  func load(model: String, request: WhisperModelLoadRequest) async throws -> Model {
    try Task.checkCancellation()
    try request.checkCancellation()
    if let cached, cachedModel == model { return cached }
    return try await withTaskCancellationHandler(operation: {
      try await withCheckedThrowingContinuation { continuation in
        register(model: model, request: request, continuation: continuation)
      }
    }, onCancel: { request.cancel() })
  }

  private func register(model: String, request: WhisperModelLoadRequest,
    continuation: CheckedContinuation<Model, Error>) {
    let requestID = request.id
    guard request.bindCancellation({ [weak self] in
      Task { await self?.cancelRequest(requestID) }
    }) else {
      continuation.resume(throwing: CancellationError())
      return
    }
    if let operation = active {
      guard !operation.cancelling, operation.model == model else {
        request.finish()
        continuation.resume(throwing: operation.cancelling
          ? WhisperModelLoadFailure.cleanupPending : WhisperModelLoadFailure.differentModelLoading)
        return
      }
      active?.waiters[request.id] = Waiter(request: request, continuation: continuation)
      return
    }
    let id = UUID()
    let factory = self.factory
    let timeout = timeoutNanoseconds
    active = Operation(id: id, model: model,
      waiters: [request.id: Waiter(request: request, continuation: continuation)])
    // Unstructured owner tasks are intentional: cancelling a waiter must not
    // await a non-cooperative SDK task as a structured task-group scope would.
    active?.worker = Task.detached { [weak self] in
      let result: Result<Model, Error>
      do {
        try Task.checkCancellation()
        let loaded = try await factory(model)
        try Task.checkCancellation()
        result = .success(loaded)
      } catch { result = .failure(error) }
      await self?.finished(id: id, result: result)
    }
    active?.deadline = Task.detached { [weak self] in
      do { try await Task.sleep(nanoseconds: timeout) }
      catch { return }
      await self?.expire(id: id)
    }
  }

  private func cancelRequest(_ id: UUID) {
    guard let waiter = active?.waiters.removeValue(forKey: id) else { return }
    waiter.request.finish()
    waiter.continuation.resume(throwing: CancellationError())
    if active?.waiters.isEmpty == true {
      active?.cancelling = true
      active?.worker?.cancel()
      active?.deadline?.cancel()
      active?.deadline = nil
    }
  }

  private func expire(id: UUID) {
    guard let operation = active, operation.id == id else { return }
    active?.cancelling = true
    active?.worker?.cancel()
    active?.deadline = nil
    active?.waiters = [:]
    for waiter in operation.waiters.values {
      waiter.request.finish()
      waiter.continuation.resume(throwing: WhisperModelLoadFailure.timedOut)
    }
  }

  private func finished(id: UUID, result: Result<Model, Error>) {
    guard let operation = active, operation.id == id else { return }
    active = nil
    operation.deadline?.cancel()
    let hasCurrentWaiter = operation.waiters.values.contains { !$0.request.isCancelled }
    if !operation.cancelling, hasCurrentWaiter, case let .success(model) = result {
      cached = model
      cachedModel = operation.model
    }
    for waiter in operation.waiters.values {
      waiter.request.finish()
      if waiter.request.isCancelled { waiter.continuation.resume(throwing: CancellationError()) }
      else { waiter.continuation.resume(with: result) }
    }
  }
}


// The object under construction is private to the loader generation. It never
// becomes an inference target until all stages finish and the cache publishes it.
private final class WhisperPreparedModel: @unchecked Sendable {
  let kit: WhisperKit
  init(_ kit: WhisperKit) { self.kit = kit }
}

private func prepareWhisperModel(_ model: String) async throws -> WhisperPreparedModel {
  let config = WhisperKitConfig(model: model, verbose: false, prewarm: false,
    load: false, download: true, useBackgroundDownloadSession: false)
  try Task.checkCancellation()
  let kit = try await WhisperKit(config)
  try Task.checkCancellation()
  try await kit.prewarmModels()
  try Task.checkCancellation()
  try await kit.loadModels()
  try Task.checkCancellation()
  return WhisperPreparedModel(kit)
}

// One inference owner across Live, cleanup, file, segment and tail paths.
// A lease remains held until the real native task exits, not a JS timeout.
final class WhisperInferenceLease: @unchecked Sendable {
  private let lock = NSLock()
  private var releaseAction: (() -> Void)?
  init(_ release: @escaping () -> Void) { releaseAction = release }
  func release() {
    lock.lock()
    let action = releaseAction
    releaseAction = nil
    lock.unlock()
    action?()
  }
  deinit { release() }
}

private final class WhisperInferenceAdmission: @unchecked Sendable {
  private let lock = NSLock()
  private var owner: UUID?
  func acquire() throws -> WhisperInferenceLease {
    lock.lock()
    guard owner == nil else {
      lock.unlock()
      throw NSError(domain: "WhisperKitLocal", code: 33, userInfo: [
        NSLocalizedDescriptionKey: "Whisper is still busy. Audio is saved; retry transcription shortly."
      ])
    }
    let id = UUID()
    owner = id
    lock.unlock()
    return WhisperInferenceLease { [weak self] in self?.finish(id) }
  }
  private func finish(_ id: UUID) {
    lock.lock()
    if owner == id { owner = nil }
    lock.unlock()
  }
  var isBusy: Bool {
    lock.lock()
    defer { lock.unlock() }
    return owner != nil
  }
}

public class WhisperKitLocalModule: Module {
  private let modelLoader = WhisperModelLoadCoordinator<WhisperPreparedModel> {
    try await prepareWhisperModel($0)
  }
  private let inferenceAdmission = WhisperInferenceAdmission()
  private let liveStateLock = NSLock()

  // No await, model work, callbacks or filesystem I/O inside this lock.
  private func withLiveState<T>(_ body: () -> T) -> T {
    liveStateLock.lock()
    defer { liveStateLock.unlock() }
    return body()
  }

  private func claimLiveStop() -> (LiveRecorderAudioProcessor?, WhisperModelLoadRequest?, LiveWhisperSession?, Bool) {
    withLiveState {
      if liveCleanupSession != nil { return (nil, nil, nil, true) }
      if let pending = livePendingProcessor {
        let request = livePendingLoadRequest
        livePendingProcessor = nil
        livePendingLoadRequest = nil
        return (pending, request, nil, false)
      }
      if let session = liveSession {
        // Reserve cleanup ownership BEFORE releasing running ownership.
        liveCleanupSession = session
        liveSession = nil
        return (nil, nil, session, false)
      }
      return (nil, nil, nil, false)
    }
  }

  private func completeLiveStop(_ session: LiveWhisperSession) {
    withLiveState {
      if liveCleanupSession === session { liveCleanupSession = nil }
    }
  }

  /*
   * Live is deliberately additive. The existing full-file
   * transcribe() path is left unchanged because it is the
   * accuracy-first path already validated for saved lectures.
   */
  private var liveSession: LiveWhisperSession?
  private var livePendingProcessor: LiveRecorderAudioProcessor?
  private var livePendingLoadRequest: WhisperModelLoadRequest?
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
      let inferenceLease = try self.inferenceAdmission.acquire()
      defer { inferenceLease.release() }


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
      let inferenceLease = try self.inferenceAdmission.acquire()
      defer { inferenceLease.release() }


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
      let inferenceLease = try self.inferenceAdmission.acquire()
      defer { inferenceLease.release() }


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
      (audioUri: String, language: String, model: String, timingLogUri: String) async throws -> [String: Any] in

      // Pending model preparation has its own cancellation/ownership domain.
      // Only a ready model can acquire inference admission.
      let request = WhisperModelLoadRequest()
      var lease: WhisperInferenceLease?
      var transferred = false
      defer { if !transferred { lease?.release() } }
      let selectedModel = model.isEmpty ? defaultWhisperModel : model
      let selectedLanguage = language.isEmpty ? "no" : language
      let outputURL = URL(fileURLWithPath: try self.filePath(from: audioUri))
      let processor = try LiveRecorderAudioProcessor(outputURL: outputURL)
      let admitted = self.withLiveState { () -> Bool in
        guard self.liveSession == nil, self.livePendingProcessor == nil,
              self.liveCleanupSession == nil else { return false }
        self.livePendingProcessor = processor
        self.livePendingLoadRequest = request
        return true
      }
      guard admitted else {
        throw NSError(domain: "WhisperKitLocal", code: 30, userInfo: [
          NSLocalizedDescriptionKey: "A Live transcription is already running or finishing."
        ])
      }
      do {
        // Attachment itself is synchronized inside the processor: Cancel cannot
        // race between pending admission and beginCapture and reattach old audio.
        try processor.beginCapture()
        self.appendTimingEvent("LIVE_MODEL_LOADING", timingLogUri: timingLogUri,
          details: "model=\(selectedModel)")
        let kit = try await self.getOrCreateWhisperKit(model: selectedModel, request: request)
        try request.checkCancellation()
        let readyLease = try self.inferenceAdmission.acquire()
        lease = readyLease
        try request.checkCancellation()
        try Task.checkCancellation()
        self.appendTimingEvent("LIVE_MODEL_READY", timingLogUri: timingLogUri,
          details: "model=\(selectedModel)")
        let sink = LiveWhisperEventSink(module: self, sessionId: audioUri)
        let session = try LiveWhisperSession(whisperKit: kit, audioURL: outputURL,
          language: selectedLanguage, processor: processor, inferenceLease: readyLease,
          onUpdate: { update in sink.emitUpdate(update) },
          onError: { message in sink.emitError(message) })
        let installed = self.withLiveState { () -> Bool in
          guard self.livePendingProcessor === processor,
                self.livePendingLoadRequest === request else { return false }
          self.livePendingProcessor = nil
          self.livePendingLoadRequest = nil
          self.liveSession = session
          return true
        }
        guard installed else {
          throw NSError(domain: "WhisperKitLocal", code: 32, userInfo: [
            NSLocalizedDescriptionKey: "Live startup was cancelled."
          ])
        }
        transferred = true
        session.start() // start() cannot resurrect a concurrently stopped session.
      } catch {
        request.cancel()
        processor.stopRecording()
        self.withLiveState {
          if self.livePendingProcessor === processor {
            self.livePendingProcessor = nil
            self.livePendingLoadRequest = nil
          }
        }
        throw error
      }
      return ["ok": true, "model": selectedModel, "language": selectedLanguage,
              "audioUri": outputURL.absoluteString]
    }

    AsyncFunction("stopLive") {
      () async throws -> [String: Any] in
      let (pending, request, session, cleanupPending) = self.claimLiveStop()
      if let pending {
        request?.cancel()
        var result = pending.stopAndSnapshot().dictionary
        // Its waiter is cancelled now. A non-cooperative loader still owns
        // its separate quarantined generation, never an inference lease.
        result["streamCleanupTimedOut"] = true
        return result
      }
      guard let session else {
        if cleanupPending {
          return ["ok": true, "streamCleanupTimedOut": true,
                  "audioUri": "", "durationMillis": 0, "bytes": 0]
        }
        throw NSError(domain: "WhisperKitLocal", code: 31, userInfo: [
          NSLocalizedDescriptionKey: "No Live transcription is running."
        ])
      }
      let result = await session.stop()
      if result.streamCleanupTimedOut {
        Task { [weak self] in
          await session.awaitStreamCleanupCompletion()
          self?.completeLiveStop(session)
        }
      } else { self.completeLiveStop(session) }
      return result.dictionary
    }

    AsyncFunction("cancelLive") {
      () async -> [String: Any] in
      let (pending, request, session, cleanupPending) = self.claimLiveStop()
      if let pending {
        request?.cancel()
        var result = pending.stopAndSnapshot().dictionary
        result["streamCleanupTimedOut"] = true
        return result
      }
      guard let session else { return ["ok": true, "cleanupPending": cleanupPending] }
      let result = await session.stop()
      if result.streamCleanupTimedOut {
        Task { [weak self] in
          await session.awaitStreamCleanupCompletion()
          self?.completeLiveStop(session)
        }
      } else { self.completeLiveStop(session) }
      return result.dictionary
    }

    // A bounded retry hook: never hold the lifecycle lock across a suspension.
    // False is an explicit retryable outcome, not an eternal processing state.
    AsyncFunction("waitForLiveCleanup") {
      (timeoutMillis: Int) async -> [String: Any] in
      let boundedMillis = min(15000, max(0, timeoutMillis))
      let deadline = ProcessInfo.processInfo.systemUptime + Double(boundedMillis) / 1000
      repeat {
        let idle = self.withLiveState {
          self.liveSession == nil && self.livePendingProcessor == nil && self.liveCleanupSession == nil
        }
        let loaderCleanup = await self.modelLoader.cleanupPending
        if idle && !loaderCleanup && !self.inferenceAdmission.isBusy { return ["ready": true] }
        if Task.isCancelled || ProcessInfo.processInfo.systemUptime >= deadline { break }
        try? await Task.sleep(nanoseconds: 100_000_000)
      } while true
      return ["ready": false]
    }
  }

  private func getOrCreateWhisperKit(
    model: String,
    request: WhisperModelLoadRequest = WhisperModelLoadRequest()
  ) async throws -> WhisperKit {
    let prepared = try await modelLoader.load(model: model, request: request)
    try request.checkCancellation()
    try Task.checkCancellation()
    return prepared.kit
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
