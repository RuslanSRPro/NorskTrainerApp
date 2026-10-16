import AVFoundation
import CoreML
import Foundation
import WhisperKit

private let liveSampleRate = Double(WhisperKit.sampleRate)

private final class LiveStopCompletionGate: @unchecked Sendable {
  private let lock = NSLock()
  private var completed = false

  func finish(
    _ value: Bool,
    continuation: CheckedContinuation<Bool, Never>
  ) {
    lock.lock()
    defer { lock.unlock() }

    guard !completed else {
      return
    }

    completed = true
    continuation.resume(
      returning: value
    )
  }
}

struct LiveWhisperSegmentSnapshot {
  let start: Double
  let end: Double
  let text: String
  let noSpeechProb: Double
  let avgLogProb: Double

  var dictionary: [String: Any] {
    [
      "start": start,
      "end": end,
      "text": text,
      "noSpeechProb": noSpeechProb,
      "avgLogProb": avgLogProb,
    ]
  }
}

struct LiveWhisperUpdateSnapshot {
  let isRecording: Bool
  let elapsedMillis: Int
  let partialText: String
  let confirmedSegments: [LiveWhisperSegmentSnapshot]
  let unconfirmedSegments: [LiveWhisperSegmentSnapshot]

  var dictionary: [String: Any] {
    [
      "isRecording": isRecording,
      "elapsedMillis": elapsedMillis,
      "partialText": partialText,
      "confirmedSegments": confirmedSegments.map(\.dictionary),
      "unconfirmedSegments": unconfirmedSegments.map(\.dictionary),
    ]
  }
}

struct LiveWhisperStopSnapshot {
  let audioUri: String
  let durationMillis: Int
  let bytes: Int64
  let writerError: String?
  let streamCleanupTimedOut: Bool
  var requiresFullTranscription: Bool = false

  var dictionary: [String: Any] {
    [
      "ok": writerError == nil,
      "audioUri": audioUri,
      "durationMillis": durationMillis,
      "bytes": bytes,
      "writerError": writerError ?? NSNull(),
      "streamCleanupTimedOut": streamCleanupTimedOut,
      "requiresFullTranscription": requiresFullTranscription,
    ]
  }
}

final class LiveRecorderAudioProcessor: AudioProcessing, @unchecked Sendable {
  private let outputURL: URL
  private let stateLock = NSLock()
  private var samplesStorage = ContiguousArray<Float>()
  private var relativeEnergyStorage: [Float] = []
  private var averageEnergyStorage: [Float] = []
  private var _relativeEnergyWindow = 20
  private var audioBufferCallback: (([Float]) -> Void)?
  private var pcmObserver: NSObjectProtocol?
  private var captureCancelled = false
  private var gapObserver: NSObjectProtocol?
  private var failureMessage: String?
  private var failureHandler: (@Sendable (String) -> Void)?
  private var windowOffset = 0.0
  private var capturedEnd = 0.0
  private var receivedFirstSample = false
  private let maximumSamples = Int(liveSampleRate * 150)
  private let maximumRetainedSamples = Int(liveSampleRate * 60)
  private let energyLimit = 32768

  var windowInfo: (samples: Int, offset: Double, duration: Double) {
    stateLock.lock(); defer { stateLock.unlock() }
    return (samplesStorage.count, windowOffset, Double(samplesStorage.count) / liveSampleRate)
  }
  var hasStreamingCallback: Bool {
    stateLock.lock(); defer { stateLock.unlock() }; return audioBufferCallback != nil
  }
  func setFailureHandler(_ action: @escaping @Sendable (String) -> Void) {
    stateLock.lock(); failureHandler = action; let failure = failureMessage; stateLock.unlock()
    if let failure { action(failure) }
  }
  func checkCaptureHealth() throws {
    stateLock.lock(); let failure = failureMessage; let cancelled = captureCancelled; stateLock.unlock()
    if let failure { throw NSError(domain: "LivePCM", code: 51, userInfo: [NSLocalizedDescriptionKey: failure]) }
    if cancelled { throw CancellationError() }
  }
  private func failCapture(_ message: String) {
    stateLock.lock()
    guard failureMessage == nil else { stateLock.unlock(); return }
    failureMessage = message; captureCancelled = true; audioBufferCallback = nil
    let handler = failureHandler
    stateLock.unlock()
    detachFromRecorder()
    handler?(message)
  }
  func cancelCapture() {
    stateLock.lock(); captureCancelled = true; audioBufferCallback = nil; stateLock.unlock()
    detachFromRecorder()
  }
  // Called only after the previous SDK streaming task has actually terminated.
  func rotateWindow(confirmedUntil: Double) throws -> Bool {
    try checkCaptureHealth()
    stateLock.lock()
    defer { stateLock.unlock() }
    guard !captureCancelled else { throw CancellationError() }
    let preferredDrop = Int(max(0, confirmedUntil - 3 - windowOffset) * liveSampleRate)
    let minimumDrop = max(0, samplesStorage.count - maximumRetainedSamples)
    let drop = min(samplesStorage.count, max(preferredDrop, minimumDrop))
    let retained = samplesStorage.count - drop
    samplesStorage = ContiguousArray(samplesStorage.suffix(retained))
    windowOffset = max(windowOffset, capturedEnd - Double(retained) / liveSampleRate)
    // Keep bounded energy history for VAD over the retained overlap.
    audioBufferCallback = nil
    return windowOffset > confirmedUntil + 0.05
  }

  init(outputURL: URL) throws {
    self.outputURL = outputURL
  }

  deinit {
    detachFromRecorder()
  }

  static func loadAudio(
    fromPath audioFilePath: String,
    channelMode: ChannelMode,
    startTime: Double?,
    endTime: Double?,
    maxReadFrameSize: AVAudioFrameCount?
  ) throws -> AVAudioPCMBuffer {
    try AudioProcessor.loadAudio(
      fromPath: audioFilePath,
      channelMode: channelMode,
      startTime: startTime,
      endTime: endTime,
      maxReadFrameSize: maxReadFrameSize
    )
  }

  static func loadAudio(
    at audioPaths: [String],
    channelMode: ChannelMode
  ) async -> [Result<[Float], Swift.Error>] {
    await AudioProcessor.loadAudio(
      at: audioPaths,
      channelMode: channelMode
    )
  }

  static func padOrTrimAudio(
    fromArray audioArray: [Float],
    startAt startIndex: Int,
    toLength frameLength: Int,
    saveSegment: Bool
  ) -> MLMultiArray? {
    AudioProcessor.padOrTrimAudio(
      fromArray: audioArray,
      startAt: startIndex,
      toLength: frameLength,
      saveSegment: saveSegment
    )
  }

  var audioSamples: ContiguousArray<Float> {
    stateLock.lock()
    defer { stateLock.unlock() }
    return samplesStorage
  }

  func purgeAudioSamples(keepingLast keep: Int) {
    // Window rotation replaces the actor before rebasing; in-place trimming
    // would invalidate AudioStreamTranscriber's lastBufferSize/clip timestamps.
    _ = keep
  }

  var relativeEnergy: [Float] {
    stateLock.lock()
    defer { stateLock.unlock() }
    return relativeEnergyStorage
  }

  var relativeEnergyWindow: Int {
    get {
      stateLock.lock()
      defer { stateLock.unlock() }
      return _relativeEnergyWindow
    }
    set {
      stateLock.lock()
      _relativeEnergyWindow = min(energyLimit, max(1, newValue))
      stateLock.unlock()
    }
  }

  func startRecordingLive(
    inputDeviceID: DeviceID?,
    callback: (([Float]) -> Void)?
  ) throws {
    _ = inputDeviceID

    try checkCaptureHealth()
    stateLock.lock()
    guard !captureCancelled else { stateLock.unlock(); throw CancellationError() }
    audioBufferCallback = callback
    let alreadyAttached = pcmObserver != nil
    stateLock.unlock()

    if alreadyAttached {
      return
    }

    attachToRecorder()
  }

  func beginCapture() throws {
    stateLock.lock()
    if captureCancelled {
      stateLock.unlock()
      throw CancellationError()
    }
    samplesStorage = []
    receivedFirstSample = false; windowOffset = 0; capturedEnd = 0
    relativeEnergyStorage = []
    averageEnergyStorage = []
    stateLock.unlock()

    try startRecordingLive(
      inputDeviceID: nil,
      callback: nil
    )
  }

  func startStreamingRecordingLive(
    inputDeviceID: DeviceID?
  ) -> (
    AsyncThrowingStream<[Float], Error>,
    AsyncThrowingStream<[Float], Error>.Continuation
  ) {
    let pair = AsyncThrowingStream<[Float], Error>.makeStream(
      bufferingPolicy: .bufferingNewest(8)
    )

    pair.continuation.onTermination = { [weak self] _ in
      self?.cancelCapture()
    }

    do {
      try startRecordingLive(inputDeviceID: inputDeviceID) { samples in
        if case .dropped = pair.continuation.yield(samples) {
          self.failCapture("Live PCM stream overflowed. Durable audio continues; retry transcription after Stop.")
          pair.continuation.finish(throwing: CancellationError())
        }
      }
    } catch {
      pair.continuation.finish(throwing: error)
    }

    return (pair.stream, pair.continuation)
  }

  func pauseRecording() {
    // Capture ownership belongs to LectureRecorder. Live can detach only.
  }

  func stopRecording() {
    // SDK window shutdown is not permanent capture cancellation. The observer
    // keeps a bounded handoff buffer while the old inference task finishes.
    stateLock.lock(); audioBufferCallback = nil; stateLock.unlock()
  }

  func stopAndSnapshot() -> LiveWhisperStopSnapshot {
    cancelCapture()
    return LiveWhisperStopSnapshot(
      audioUri: outputURL.absoluteString,
      durationMillis: durationMillis,
      bytes: 0,
      writerError: nil,
      streamCleanupTimedOut: false
    )
  }

  func resumeRecordingLive(
    inputDeviceID: DeviceID?,
    callback: (([Float]) -> Void)?
  ) throws {
    try startRecordingLive(
      inputDeviceID: inputDeviceID,
      callback: callback
    )
  }

  func padOrTrim(
    fromArray audioArray: [Float],
    startAt startIndex: Int,
    toLength frameLength: Int
  ) -> (any AudioProcessorOutputType)? {
    Self.padOrTrimAudio(
      fromArray: audioArray,
      startAt: startIndex,
      toLength: frameLength,
      saveSegment: false
    )
  }

  var durationMillis: Int {
    stateLock.lock()
    defer { stateLock.unlock() }
    return Int((capturedEnd * 1000.0).rounded())
  }

  var writerError: String? { nil }
  var bytes: Int64 { 0 }

  private func attachToRecorder() {
    let observer = NotificationCenter.default.addObserver(
      forName: Notification.Name(
        "NorskTrainer.LectureRecorder.PCMBuffer"
      ),
      object: nil,
      queue: nil
    ) { [weak self] notification in
      guard notification.userInfo?["sourceURI"] as? String == self?.outputURL.absoluteString,
        let buffer = notification.object as? AVAudioPCMBuffer else {
        return
      }
      self?.handleRecorderBuffer(buffer,
        captureStart: (notification.userInfo?["captureStartSeconds"] as? NSNumber)?.doubleValue)
    }

    let gap = NotificationCenter.default.addObserver(
      forName: Notification.Name("NorskTrainer.LectureRecorder.PCMGap"), object: nil, queue: nil
    ) { [weak self] notification in
      guard let self, notification.userInfo?["sourceURI"] as? String == self.outputURL.absoluteString else { return }
      self.failCapture("Live PCM delivery exceeded its queue budget. Audio capture continues; Stop can finish transcription from saved audio.")
    }
    stateLock.lock()
    if pcmObserver == nil && !captureCancelled {
      gapObserver = gap
      pcmObserver = observer
      stateLock.unlock()
    } else {
      stateLock.unlock()
      NotificationCenter.default.removeObserver(observer)
      NotificationCenter.default.removeObserver(gap)
    }
  }

  private func detachFromRecorder() {
    stateLock.lock()
    let observer = pcmObserver
    pcmObserver = nil
    let gap = gapObserver; gapObserver = nil
    stateLock.unlock()

    if let observer { NotificationCenter.default.removeObserver(observer) }
    if let gap { NotificationCenter.default.removeObserver(gap) }
  }

  private func handleRecorderBuffer(_ buffer: AVAudioPCMBuffer, captureStart: Double?) {
    guard buffer.frameLength > 0 else { return }

    guard let whisperBuffer = AudioProcessor.resampleAudio(
      fromBuffer: buffer,
      toSampleRate: liveSampleRate,
      channelCount: 1
    ) else {
      failCapture("Live PCM resampling failed. Saved audio remains available for transcription.")
      return
    }

    let samples = AudioProcessor.convertBufferToArray(buffer: whisperBuffer)
    guard !samples.isEmpty else {
      failCapture("Live PCM conversion returned no samples. Retry from saved audio.")
      return
    }
    consumeWhisperSamples(samples, captureStart: captureStart, sourceDuration: Double(buffer.frameLength) / buffer.format.sampleRate)
  }

  private func consumeWhisperSamples(_ samples: [Float], captureStart: Double?, sourceDuration: Double) {
    let signalEnergy = AudioProcessor.calculateEnergy(of: samples)

    stateLock.lock()
    guard !captureCancelled else { stateLock.unlock(); return }
    guard samplesStorage.count + samples.count <= maximumSamples else {
      stateLock.unlock()
      failCapture("Whisper did not finish its previous window before the bounded PCM buffer filled. Durable audio continues; Stop and retry transcription.")
      return
    }
    if !receivedFirstSample {
      windowOffset = max(0, captureStart ?? 0); capturedEnd = windowOffset; receivedFirstSample = true
    }
    capturedEnd = max(capturedEnd, (captureStart ?? capturedEnd) + sourceDuration)
    let baseline: Float? = {
      let window = averageEnergyStorage.suffix(_relativeEnergyWindow)
      return window.min()
    }()
    let relative = AudioProcessor.calculateRelativeEnergy(
      of: samples,
      relativeTo: baseline
    )
    samplesStorage.append(contentsOf: samples)
    averageEnergyStorage.append(signalEnergy.avg)
    relativeEnergyStorage.append(relative)
    if averageEnergyStorage.count > energyLimit { averageEnergyStorage.removeFirst(averageEnergyStorage.count - energyLimit) }
    if relativeEnergyStorage.count > energyLimit { relativeEnergyStorage.removeFirst(relativeEnergyStorage.count - energyLimit) }
    let callback = audioBufferCallback
    stateLock.unlock()

    callback?(samples)
  }
}

private final class LiveWindowCompletion: @unchecked Sendable {
  private let lock = NSLock()
  private var done = false
  private var failure: String?
  func finish(_ message: String?) { lock.lock(); failure = message; done = true; lock.unlock() }
  var snapshot: (done: Bool, error: String?) {
    lock.lock(); defer { lock.unlock() }; return (done, failure)
  }
}

private final class LiveWhisperStateSink: @unchecked Sendable {
  weak var session: LiveWhisperSession?
  let id: UUID
  let offset: Double
  init(session: LiveWhisperSession, id: UUID, offset: Double) {
    self.session = session; self.id = id; self.offset = offset
  }
  func receive(_ state: AudioStreamTranscriber.State) {
    session?.receive(state, id: id, offset: offset)
  }
}

final class LiveWhisperSession: @unchecked Sendable {
  typealias UpdateHandler = @Sendable (LiveWhisperUpdateSnapshot) -> Void
  typealias ErrorHandler = @Sendable (String, Bool) -> Void
  private let processor: LiveRecorderAudioProcessor
  private let inferenceLease: WhisperInferenceLease
  private let kit: WhisperKit
  private let language: String
  private let onUpdate: UpdateHandler
  private let onError: ErrorHandler
  private let lifecycleLock = NSLock()
  private var stopping = false
  private var rotating = false
  private var task: Task<Void, Never>?
  private var transcriber: AudioStreamTranscriber?
  private var windowTask: Task<Void, Never>?
  private var streamCleanupTask: Task<Void, Never>?
  private let stateLock = NSLock()
  private var activeWindowID = UUID()
  private var requiresFullTranscription = false
  private var confirmedUntil = 0.0
  private var lastEmittedConfirmedCount = 0
  private var lastEmitTime = Date.distantPast

  init(whisperKit: WhisperKit, audioURL: URL, language: String,
       processor: LiveRecorderAudioProcessor, inferenceLease: WhisperInferenceLease,
       onUpdate: @escaping UpdateHandler, onError: @escaping ErrorHandler) throws {
    guard whisperKit.tokenizer != nil else {
      throw NSError(domain: "LiveWhisperSession", code: 20,
        userInfo: [NSLocalizedDescriptionKey: "Whisper tokenizer is not ready."])
    }
    self.kit = whisperKit; self.language = language
    self.processor = processor; self.inferenceLease = inferenceLease
    self.onUpdate = onUpdate; self.onError = onError
    processor.setFailureHandler { [weak self] message in
      guard let self else { return }
      self.onError(message, false)
      _ = self.beginStop()
    }
  }

  func start() {
    lifecycleLock.lock()
    defer { lifecycleLock.unlock() }
    guard task == nil && !stopping else { return }
    task = Task { [weak self] in
      guard let self else { return }
      await self.runWindows()
    }
  }
  private var stopRequested: Bool {
    lifecycleLock.lock(); defer { lifecycleLock.unlock() }; return stopping
  }
  private func setRotating(_ value: Bool) {
    lifecycleLock.lock(); rotating = value; lifecycleLock.unlock()
  }
  private func lifecycleSnapshot() -> (stopping: Bool, rotating: Bool) {
    lifecycleLock.lock(); defer { lifecycleLock.unlock() }; return (stopping, rotating)
  }
  private func reportCoverageGap(_ message: String) {
    stateLock.lock(); requiresFullTranscription = true; stateLock.unlock()
    onError(message, true)
  }
  private func coverageGapSnapshot() -> Bool {
    stateLock.lock(); defer { stateLock.unlock() }; return requiresFullTranscription
  }
  private func confirmedSnapshot() -> Double {
    stateLock.lock(); defer { stateLock.unlock() }; return confirmedUntil
  }
  private func prepareState(_ id: UUID) {
    stateLock.lock(); activeWindowID = id; lastEmittedConfirmedCount = 0
    lastEmitTime = .distantPast; stateLock.unlock()
  }
  private func install(_ value: AudioStreamTranscriber, completion: LiveWindowCompletion) -> Task<Void, Never>? {
    lifecycleLock.lock()
    defer { lifecycleLock.unlock() }
    guard !stopping else { return nil }
    transcriber = value
    let worker = Task {
      do {
        try Task.checkCancellation()
        try await value.startStreamTranscription()
        completion.finish(nil)
      } catch { completion.finish(error.localizedDescription) }
    }
    windowTask = worker
    return worker
  }
  private func clearWindow() {
    lifecycleLock.lock(); transcriber = nil; windowTask = nil; rotating = false; lifecycleLock.unlock()
  }
  private func makeTranscriber(id: UUID, offset: Double) throws -> AudioStreamTranscriber {
    guard let tokenizer = kit.tokenizer else { throw CancellationError() }
    let sink = LiveWhisperStateSink(session: self, id: id, offset: offset)
    let options = DecodingOptions(task: .transcribe, language: language,
      skipSpecialTokens: true, wordTimestamps: false, maxInitialTimestamp: 1.0, chunkingStrategy: .none)
    return AudioStreamTranscriber(audioEncoder: kit.audioEncoder, featureExtractor: kit.featureExtractor,
      segmentSeeker: kit.segmentSeeker, textDecoder: kit.textDecoder, tokenizer: tokenizer,
      audioProcessor: processor, decodingOptions: options, requiredSegmentsForConfirmation: 1,
      silenceThreshold: 0.3, compressionCheckWindow: 60, useVAD: true,
      stateChangeCallback: { _, state in sink.receive(state) })
  }

  private func runWindows() async {
    // Capture starts before model loading. Wait for the first timestamped PCM,
    // without blocking durable capture or holding an inference/lifecycle lock.
    let firstDeadline = ProcessInfo.processInfo.systemUptime + 3
    while processor.windowInfo.samples == 0 && !stopRequested {
      if ProcessInfo.processInfo.systemUptime >= firstDeadline {
        onError("Live PCM did not arrive. Durable audio capture remains available.", false)
        processor.cancelCapture(); _ = beginStop(); return
      }
      try? await Task.sleep(nanoseconds: 20_000_000)
    }
    if processor.windowInfo.offset > 0.25 {
      reportCoverageGap("Live attached after the beginning of captured audio. Full transcription is required to verify the prefix.")
    }
    while !stopRequested && !Task.isCancelled {
      do {
        try processor.checkCaptureHealth()
        let id = UUID()
        prepareState(id)
        let value = try makeTranscriber(id: id, offset: processor.windowInfo.offset)
        let completion = LiveWindowCompletion()
        guard let worker = install(value, completion: completion) else { return }
        while !stopRequested && !Task.isCancelled && !completion.snapshot.done &&
          !(processor.windowInfo.duration >= 120 && processor.hasStreamingCallback) {
          try? await Task.sleep(nanoseconds: 50_000_000)
        }
        let rollover = !stopRequested && !Task.isCancelled && !completion.snapshot.done
        setRotating(rollover)
        // The previous SDK actor/task must really finish before its PCM array is
        // reset or another actor touches the shared model. Cancellation is not proof.
        worker.cancel()
        await value.stopStreamTranscription()
        await worker.value
        let finished = completion.snapshot
        clearWindow()
        if stopRequested || Task.isCancelled { return }
        if !rollover {
          onError(finished.error ?? "Live recognition ended unexpectedly. Audio capture continues.", false)
          processor.cancelCapture(); _ = beginStop(); return
        }
        let gap = try processor.rotateWindow(confirmedUntil: confirmedSnapshot())
        if gap {
          reportCoverageGap("An unconfirmed Live interval exceeded the retained overlap. Audio is saved; full transcription is required to close the gap.")
        }
      } catch {
        if !stopRequested { onError(error.localizedDescription, false) }
        processor.cancelCapture(); _ = beginStop(); return
      }
    }
  }

  private func beginStop() -> Task<Void, Never> {
    // Permanent detach also prevents an actor start already queued behind Stop
    // from resurrecting capture via startRecordingLive.
    processor.cancelCapture()
    lifecycleLock.lock()
    defer { lifecycleLock.unlock() }
    if let cleanup = streamCleanupTask { return cleanup }
    stopping = true
    let streamingTask = task
    let current = transcriber
    streamingTask?.cancel(); windowTask?.cancel()
    let lease = inferenceLease
    let cleanup = Task {
      if let current { await current.stopStreamTranscription() }
      if let streamingTask { await streamingTask.value }
      lease.release() // Only actual outer + per-window task completion releases it.
    }
    streamCleanupTask = cleanup
    return cleanup
  }
  private func cleanupSnapshot() -> Task<Void, Never>? {
    lifecycleLock.lock(); defer { lifecycleLock.unlock() }; return streamCleanupTask
  }
  func awaitStreamCleanupCompletion() async {
    if let cleanup = cleanupSnapshot() { await cleanup.value }
  }
  func stop() async -> LiveWhisperStopSnapshot {
    let audio = processor.stopAndSnapshot()
    let cleanup = beginStop()
    let finished = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
      let gate = LiveStopCompletionGate()
      Task { await cleanup.value; gate.finish(true, continuation: continuation) }
      DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 5) {
        gate.finish(false, continuation: continuation)
      }
    }
    return LiveWhisperStopSnapshot(audioUri: audio.audioUri, durationMillis: audio.durationMillis,
      bytes: audio.bytes, writerError: audio.writerError, streamCleanupTimedOut: !finished,
      requiresFullTranscription: coverageGapSnapshot())
  }

  func receive(_ state: AudioStreamTranscriber.State, id: UUID, offset: Double) {
    let lifecycle = lifecycleSnapshot()
    guard !lifecycle.stopping else { return }
    let confirmed = state.confirmedSegments.map { Self.snapshot($0, offset: offset) }
    let unconfirmed = state.unconfirmedSegments.map { Self.snapshot($0, offset: offset) }
    let partial = (unconfirmed.map(\.text) + [state.currentText]).joined(separator: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    let now = Date()
    stateLock.lock()
    guard activeWindowID == id else { stateLock.unlock(); return }
    let fresh = Array(confirmed.dropFirst(min(lastEmittedConfirmedCount, confirmed.count)))
      .filter { $0.end > confirmedUntil + 0.01 }
    if let end = fresh.last?.end { confirmedUntil = max(confirmedUntil, end) }
    let emit = !fresh.isEmpty || now.timeIntervalSince(lastEmitTime) >= 0.25 || !state.isRecording
    if emit { lastEmittedConfirmedCount = confirmed.count; lastEmitTime = now }
    stateLock.unlock()
    guard emit else { return }
    onUpdate(LiveWhisperUpdateSnapshot(isRecording: state.isRecording || lifecycle.rotating,
      elapsedMillis: processor.durationMillis, partialText: partial,
      confirmedSegments: fresh, unconfirmedSegments: unconfirmed))
  }
  private static func snapshot(_ segment: TranscriptionSegment, offset: Double) -> LiveWhisperSegmentSnapshot {
    LiveWhisperSegmentSnapshot(start: offset + Double(segment.start), end: offset + Double(segment.end),
      text: segment.text.trimmingCharacters(in: .whitespacesAndNewlines),
      noSpeechProb: Double(segment.noSpeechProb), avgLogProb: Double(segment.avgLogprob))
  }
}
