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

  var dictionary: [String: Any] {
    [
      "ok": writerError == nil,
      "audioUri": audioUri,
      "durationMillis": durationMillis,
      "bytes": bytes,
      "writerError": writerError ?? NSNull(),
      "streamCleanupTimedOut": streamCleanupTimedOut,
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
    stateLock.lock()
    defer { stateLock.unlock() }
    if samplesStorage.count > keep {
      samplesStorage.removeFirst(samplesStorage.count - keep)
    }
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
      _relativeEnergyWindow = max(1, newValue)
      stateLock.unlock()
    }
  }

  func startRecordingLive(
    inputDeviceID: DeviceID?,
    callback: (([Float]) -> Void)?
  ) throws {
    _ = inputDeviceID

    stateLock.lock()
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
    samplesStorage = []
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
      bufferingPolicy: .unbounded
    )

    pair.continuation.onTermination = { [weak self] _ in
      self?.stopRecording()
    }

    do {
      try startRecordingLive(inputDeviceID: inputDeviceID) { samples in
        pair.continuation.yield(samples)
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
    detachFromRecorder()
    stateLock.lock()
    audioBufferCallback = nil
    stateLock.unlock()
  }

  func stopAndSnapshot() -> LiveWhisperStopSnapshot {
    stopRecording()
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
    return Int((Double(samplesStorage.count) / liveSampleRate) * 1000.0)
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
      guard let buffer = notification.object as? AVAudioPCMBuffer else {
        return
      }
      self?.handleRecorderBuffer(buffer)
    }

    stateLock.lock()
    if pcmObserver == nil {
      pcmObserver = observer
      stateLock.unlock()
    } else {
      stateLock.unlock()
      NotificationCenter.default.removeObserver(observer)
    }
  }

  private func detachFromRecorder() {
    stateLock.lock()
    let observer = pcmObserver
    pcmObserver = nil
    stateLock.unlock()

    if let observer {
      NotificationCenter.default.removeObserver(observer)
    }
  }

  private func handleRecorderBuffer(_ buffer: AVAudioPCMBuffer) {
    guard buffer.frameLength > 0 else { return }

    guard let whisperBuffer = AudioProcessor.resampleAudio(
      fromBuffer: buffer,
      toSampleRate: liveSampleRate,
      channelCount: 1
    ) else {
      return
    }

    let samples = AudioProcessor.convertBufferToArray(buffer: whisperBuffer)
    guard !samples.isEmpty else { return }
    consumeWhisperSamples(samples)
  }

  private func consumeWhisperSamples(_ samples: [Float]) {
    let signalEnergy = AudioProcessor.calculateEnergy(of: samples)

    stateLock.lock()
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
    let callback = audioBufferCallback
    stateLock.unlock()

    callback?(samples)
  }
}

private final class LiveWhisperStateSink: @unchecked Sendable {
  weak var session: LiveWhisperSession?

  func receive(
    _ state: AudioStreamTranscriber.State
  ) {
    session?.receive(
      state
    )
  }
}

final class LiveWhisperSession: @unchecked Sendable {
  typealias UpdateHandler = @Sendable (
    LiveWhisperUpdateSnapshot
  ) -> Void

  typealias ErrorHandler = @Sendable (
    String
  ) -> Void

  private let processor: LiveRecorderAudioProcessor
  private var streamCleanupTask: Task<Void, Never>?
  private let transcriber: AudioStreamTranscriber
  private let audioURL: URL
  private let onUpdate: UpdateHandler
  private let onError: ErrorHandler
  private let stateSink: LiveWhisperStateSink

  private let stateLock = NSLock()
  private var latestConfirmed:
    [LiveWhisperSegmentSnapshot] = []
  private var latestUnconfirmed:
    [LiveWhisperSegmentSnapshot] = []
  private var latestPartialText = ""
  private var lastEmittedConfirmedCount = 0
  private var lastEmitTime = Date.distantPast
  private var task: Task<Void, Never>?

  init(
    whisperKit: WhisperKit,
    audioURL: URL,
    language: String,
    processor: LiveRecorderAudioProcessor,
    onUpdate: @escaping UpdateHandler,
    onError: @escaping ErrorHandler
  ) throws {
    guard let tokenizer = whisperKit.tokenizer else {
      throw NSError(
        domain: "LiveWhisperSession",
        code: 20,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Whisper tokenizer is not ready for Live mode."
        ]
      )
    }

    let stateSink = LiveWhisperStateSink()

    let options = DecodingOptions(
      task: .transcribe,
      language: language,
      skipSpecialTokens: true,
      wordTimestamps: false,
      maxInitialTimestamp: 1.0,
      chunkingStrategy: .none
    )

    self.processor = processor
    self.audioURL = audioURL
    self.onUpdate = onUpdate
    self.onError = onError
    self.stateSink = stateSink

    self.transcriber = AudioStreamTranscriber(
      audioEncoder: whisperKit.audioEncoder,
      featureExtractor: whisperKit.featureExtractor,
      segmentSeeker: whisperKit.segmentSeeker,
      textDecoder: whisperKit.textDecoder,
      tokenizer: tokenizer,
      audioProcessor: processor,
      decodingOptions: options,
      requiredSegmentsForConfirmation: 1,
      silenceThreshold: 0.3,
      compressionCheckWindow: 60,
      useVAD: true,
      stateChangeCallback: {
        _, newState in
        stateSink.receive(
          newState
        )
      }
    )

    stateSink.session = self
  }

  func start() {
    guard task == nil else {
      return
    }

    task = Task {
      [weak self] in

      guard let self else {
        return
      }

      do {
        try await self.transcriber
          .startStreamTranscription()
      } catch is CancellationError {
        return
      } catch {
        self.onError(
          error.localizedDescription
        )
      }
    }
  }

  func awaitStreamCleanupCompletion() async {
    if let streamCleanupTask {
      await streamCleanupTask.value
    }
  }

  func stop() async -> LiveWhisperStopSnapshot {
    /*
     * Audio is primary: finalize M4A first. Then give streaming Whisper
     * a bounded opportunity to terminate. If it misses the deadline, JS
     * keeps the audio but must defer the authoritative full-file pass so
     * two Whisper operations never race.
     */
    let audioSnapshot =
      processor.stopAndSnapshot()

    let streamingTask = self.task
    streamingTask?.cancel()

    let transcriber = self.transcriber
    let cleanupTask = Task {
      await transcriber
        .stopStreamTranscription()

      // Do not release native ownership until the original streaming task
      // has actually exited as well.
      if let streamingTask {
        await streamingTask.value
      }
    }
    self.streamCleanupTask = cleanupTask

    let cleanupFinished =
      await withCheckedContinuation {
        (continuation: CheckedContinuation<Bool, Never>) in

        let gate =
          LiveStopCompletionGate()

        Task {
          await cleanupTask.value
          gate.finish(
            true,
            continuation: continuation
          )
        }

        DispatchQueue.global(
          qos: .utility
        ).asyncAfter(
          deadline: .now() + 5.0
        ) {
          gate.finish(
            false,
            continuation: continuation
          )
        }
      }

    return LiveWhisperStopSnapshot(
      audioUri: audioSnapshot.audioUri,
      durationMillis:
        audioSnapshot.durationMillis,
      bytes: audioSnapshot.bytes,
      writerError:
        audioSnapshot.writerError,
      streamCleanupTimedOut:
        !cleanupFinished
    )
  }

  func receive(
    _ state: AudioStreamTranscriber.State
  ) {
    let confirmed = state.confirmedSegments
      .map(Self.snapshot)

    let unconfirmed = state.unconfirmedSegments
      .map(Self.snapshot)

    let partialParts = [
      unconfirmed
        .map(\.text)
        .joined(separator: " "),
      state.currentText,
    ]
      .map {
        $0.trimmingCharacters(
          in: .whitespacesAndNewlines
        )
      }
      .filter {
        !$0.isEmpty
      }

    let partialText = partialParts
      .joined(separator: " ")
      .replacingOccurrences(
        of: #"\s+"#,
        with: " ",
        options: .regularExpression
      )
      .trimmingCharacters(
        in: .whitespacesAndNewlines
      )

    let now = Date()

    stateLock.lock()

    latestConfirmed = confirmed
    latestUnconfirmed = unconfirmed
    latestPartialText = partialText

    let newConfirmed = confirmed.count >
      lastEmittedConfirmedCount
      ? Array(
          confirmed.dropFirst(
            lastEmittedConfirmedCount
          )
        )
      : []

    let shouldEmit =
      !newConfirmed.isEmpty ||
      now.timeIntervalSince(
        lastEmitTime
      ) >= 0.25 ||
      !state.isRecording

    if shouldEmit {
      lastEmittedConfirmedCount =
        confirmed.count
      lastEmitTime = now
    }

    stateLock.unlock()

    guard shouldEmit else {
      return
    }

    onUpdate(
      LiveWhisperUpdateSnapshot(
        isRecording: state.isRecording,
        elapsedMillis: processor.durationMillis,
        partialText: partialText,
        confirmedSegments: newConfirmed,
        unconfirmedSegments: unconfirmed
      )
    )
  }

  private static func snapshot(
    _ segment: TranscriptionSegment
  ) -> LiveWhisperSegmentSnapshot {
    LiveWhisperSegmentSnapshot(
      start: Double(segment.start),
      end: Double(segment.end),
      text: segment.text
        .trimmingCharacters(
          in: .whitespacesAndNewlines
        ),
      noSpeechProb:
        Double(segment.noSpeechProb),
      avgLogProb:
        Double(segment.avgLogprob)
    )
  }
}
