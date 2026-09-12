import AVFoundation
import CoreML
import Foundation
import WhisperKit

private let liveSampleRate = Double(WhisperKit.sampleRate)

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

  var dictionary: [String: Any] {
    [
      "ok": writerError == nil,
      "audioUri": audioUri,
      "durationMillis": durationMillis,
      "bytes": bytes,
      "writerError": writerError ?? NSNull(),
    ]
  }
}

final class LiveFileAudioProcessor: AudioProcessing, @unchecked Sendable {
  private let outputURL: URL

  private let stateLock = NSLock()
  private let writerQueue = DispatchQueue(
    label: "NorskTrainer.LiveWhisper.AudioWriter"
  )

  private var samplesStorage = ContiguousArray<Float>()
  private var relativeEnergyStorage: [Float] = []
  private var averageEnergyStorage: [Float] = []
  private var _relativeEnergyWindow = 20
  private var audioBufferCallback: (([Float]) -> Void)?

  private var audioEngine: AVAudioEngine?
  private var inputTapInstalled = false

  private var audioFile: AVAudioFile?
  private var storedWriterError: String?

  init(outputURL: URL) throws {
    self.outputURL = outputURL

    let directoryURL = outputURL.deletingLastPathComponent()
    try FileManager.default.createDirectory(
      at: directoryURL,
      withIntermediateDirectories: true
    )

    if FileManager.default.fileExists(atPath: outputURL.path) {
      try FileManager.default.removeItem(at: outputURL)
    }

    /*
     * Do NOT open an AAC writer here at Whisper's 16 kHz sample rate.
     * Some iPhone AAC routes reject that encoder configuration with
     * CoreAudio '!dat' / 560226676 before Live recording even starts.
     *
     * The writer is opened lazily from the first real microphone buffer
     * and therefore uses the route's actual PCM processing format, while
     * a separate 16 kHz mono copy is fed to WhisperKit.
     */
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

  func purgeAudioSamples(
    keepingLast keep: Int
  ) {
    stateLock.lock()
    defer { stateLock.unlock() }

    if samplesStorage.count > keep {
      samplesStorage.removeFirst(
        samplesStorage.count - keep
      )
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
    _ = inputDeviceID // iOS always uses the active/default route.

    /*
     * Step 8.2: Live audio capture may already be running while the
     * Whisper model is still loading. When AudioStreamTranscriber later
     * attaches its callback, keep the existing engine and accumulated
     * samples instead of restarting capture and losing the first words.
     */
    stateLock.lock()
    audioBufferCallback = callback
    stateLock.unlock()

    if audioEngine != nil {
      return
    }

    stateLock.lock()
    samplesStorage = []
    relativeEnergyStorage = []
    averageEnergyStorage = []
    stateLock.unlock()

    writerQueue.sync {
      audioFile = nil
      storedWriterError = nil
    }

    try configureAudioSession()

    let engine = AVAudioEngine()
    let inputNode = engine.inputNode

    /*
     * This intentionally mirrors the route-safe capture path used by the
     * stable lecture recorder: install the tap with the input node's actual
     * OUTPUT processing format. WhisperKit's stock AudioProcessor rebuilds
     * a format from inputFormat(forBus:) and can fail on real iPhone routes
     * with CoreAudio '!dat' (560226676).
     */
    let recordingFormat = inputNode.outputFormat(
      forBus: 0
    )

    guard
      recordingFormat.sampleRate > 0,
      recordingFormat.channelCount > 0,
      recordingFormat.commonFormat != .otherFormat
    else {
      throw NSError(
        domain: "LiveWhisperSession",
        code: 13,
        userInfo: [
          NSLocalizedDescriptionKey:
            "The microphone has no usable output processing format."
        ]
      )
    }

    inputNode.installTap(
      onBus: 0,
      bufferSize: 2048,
      format: recordingFormat
    ) { [weak self] buffer, _ in
      self?.handleMicrophoneBuffer(buffer)
    }

    inputTapInstalled = true
    engine.prepare()

    do {
      try engine.start()
    } catch {
      inputNode.removeTap(onBus: 0)
      inputTapInstalled = false

      stateLock.lock()
      audioBufferCallback = nil
      stateLock.unlock()

      let nsError = error as NSError
      throw NSError(
        domain: "LiveWhisperSession",
        code: 14,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Live AVAudioEngine could not start. " +
            "format=\(recordingFormat.sampleRate)Hz/\(recordingFormat.channelCount)ch, " +
            "underlying=\(nsError.domain) \(nsError.code): \(nsError.localizedDescription)"
        ]
      )
    }

    audioEngine = engine
  }


  func beginCapture() throws {
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
    let pair = AsyncThrowingStream<[Float], Error>
      .makeStream(
        bufferingPolicy: .unbounded
      )

    pair.continuation.onTermination = {
      [weak self] _ in
      self?.stopRecording()
    }

    do {
      try startRecordingLive(
        inputDeviceID: inputDeviceID
      ) { samples in
        pair.continuation.yield(samples)
      }
    } catch {
      pair.continuation.finish(
        throwing: error
      )
    }

    return (
      pair.stream,
      pair.continuation
    )
  }

  func pauseRecording() {
    audioEngine?.pause()
  }

  func stopRecording() {
    if let engine = audioEngine {
      if inputTapInstalled {
        engine.inputNode.removeTap(
          onBus: 0
        )
        inputTapInstalled = false
      }

      engine.stop()
      audioEngine = nil
    }

    stateLock.lock()
    audioBufferCallback = nil
    stateLock.unlock()

    /*
     * Wait for all queued microphone writes and then release the last
     * AVAudioFile reference. On iOS < 18 this is how the M4A container is
     * finalized because AVAudioFile.close() is unavailable.
     */
    writerQueue.sync {
      audioFile = nil
    }
  }

  func resumeRecordingLive(
    inputDeviceID: DeviceID?,
    callback: (([Float]) -> Void)?
  ) throws {
    _ = inputDeviceID

    if let callback {
      stateLock.lock()
      audioBufferCallback = callback
      stateLock.unlock()
    }

    guard let engine = audioEngine else {
      try startRecordingLive(
        inputDeviceID: nil,
        callback: callback
      )
      return
    }

    try configureAudioSession()
    try engine.start()
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

    return Int(
      (Double(samplesStorage.count) /
        liveSampleRate) * 1000.0
    )
  }

  var writerError: String? {
    writerQueue.sync {
      storedWriterError
    }
  }

  var bytes: Int64 {
    writerQueue.sync {
      let attributes = try? FileManager.default
        .attributesOfItem(
          atPath: outputURL.path
        )

      return (
        attributes?[.size]
        as? NSNumber
      )?.int64Value ?? 0
    }
  }

  private func configureAudioSession() throws {
    let session = AVAudioSession.sharedInstance()

    try session.setCategory(
      .playAndRecord,
      mode: .default,
      options: [
        .defaultToSpeaker,
        .allowBluetoothHFP,
      ]
    )

    // Preferences only. The actual route format is read after activation.
    try? session.setPreferredSampleRate(44_100.0)
    try? session.setPreferredInputNumberOfChannels(1)
    try session.setActive(true)
  }

  private func handleMicrophoneBuffer(
    _ buffer: AVAudioPCMBuffer
  ) {
    guard buffer.frameLength > 0 else {
      return
    }

    // Preserve the real route format for the M4A writer.
    if let copiedBuffer = copyPCMBuffer(buffer) {
      writerQueue.async { [weak self] in
        self?.writeMicrophoneBuffer(copiedBuffer)
      }
    } else {
      writerQueue.async { [weak self] in
        if self?.storedWriterError == nil {
          self?.storedWriterError =
            "Could not copy a Live microphone buffer."
        }
      }
    }

    // WhisperKit expects 16 kHz mono Float32 samples.
    guard let whisperBuffer = AudioProcessor.resampleAudio(
      fromBuffer: buffer,
      toSampleRate: liveSampleRate,
      channelCount: 1
    ) else {
      return
    }

    let samples = AudioProcessor.convertBufferToArray(
      buffer: whisperBuffer
    )

    guard !samples.isEmpty else {
      return
    }

    consumeWhisperSamples(samples)
  }

  private func consumeWhisperSamples(
    _ samples: [Float]
  ) {
    let signalEnergy = AudioProcessor.calculateEnergy(
      of: samples
    )

    stateLock.lock()

    let baseline: Float? = {
      let window = averageEnergyStorage
        .suffix(_relativeEnergyWindow)
      return window.min()
    }()

    let relative = AudioProcessor.calculateRelativeEnergy(
      of: samples,
      relativeTo: baseline
    )

    samplesStorage.append(
      contentsOf: samples
    )
    averageEnergyStorage.append(
      signalEnergy.avg
    )
    relativeEnergyStorage.append(
      relative
    )

    let callback = audioBufferCallback
    stateLock.unlock()

    callback?(samples)
  }

  private func copyPCMBuffer(
    _ buffer: AVAudioPCMBuffer
  ) -> AVAudioPCMBuffer? {
    guard
      buffer.frameLength > 0,
      let copy = AVAudioPCMBuffer(
        pcmFormat: buffer.format,
        frameCapacity: buffer.frameLength
      )
    else {
      return nil
    }

    copy.frameLength = buffer.frameLength

    let sourceBuffers =
      UnsafeMutableAudioBufferListPointer(
        UnsafeMutablePointer(
          mutating: buffer.audioBufferList
        )
      )

    let destinationBuffers =
      UnsafeMutableAudioBufferListPointer(
        copy.mutableAudioBufferList
      )

    guard sourceBuffers.count == destinationBuffers.count else {
      return nil
    }

    for index in 0..<sourceBuffers.count {
      guard
        let sourceData = sourceBuffers[index].mData,
        let destinationData = destinationBuffers[index].mData
      else {
        return nil
      }

      let byteCount = min(
        Int(sourceBuffers[index].mDataByteSize),
        Int(destinationBuffers[index].mDataByteSize)
      )

      memcpy(
        destinationData,
        sourceData,
        byteCount
      )

      destinationBuffers[index].mDataByteSize =
        UInt32(byteCount)
    }

    return copy
  }

  private func openWriterIfNeeded(
    processingFormat: AVAudioFormat
  ) throws {
    guard audioFile == nil else {
      return
    }

    let channelCount = max(
      1,
      Int(processingFormat.channelCount)
    )

    let settings: [String: Any] = [
      AVFormatIDKey:
        Int(kAudioFormatMPEG4AAC),
      AVSampleRateKey:
        processingFormat.sampleRate,
      AVNumberOfChannelsKey:
        channelCount,
      AVEncoderBitRateKey:
        channelCount == 1
          ? 128_000
          : 192_000,
      AVEncoderAudioQualityKey:
        AVAudioQuality.high.rawValue,
    ]

    audioFile = try AVAudioFile(
      forWriting: outputURL,
      settings: settings,
      commonFormat:
        processingFormat.commonFormat,
      interleaved:
        processingFormat.isInterleaved
    )
  }

  private func writeMicrophoneBuffer(
    _ buffer: AVAudioPCMBuffer
  ) {
    guard storedWriterError == nil else {
      return
    }

    do {
      try openWriterIfNeeded(
        processingFormat: buffer.format
      )

      guard let file = audioFile else {
        throw NSError(
          domain: "LiveWhisperSession",
          code: 15,
          userInfo: [
            NSLocalizedDescriptionKey:
              "The Live M4A writer was not created."
          ]
        )
      }

      guard
        file.processingFormat.sampleRate == buffer.format.sampleRate,
        file.processingFormat.channelCount == buffer.format.channelCount,
        file.processingFormat.commonFormat == buffer.format.commonFormat,
        file.processingFormat.isInterleaved == buffer.format.isInterleaved
      else {
        throw NSError(
          domain: "LiveWhisperSession",
          code: 16,
          userInfo: [
            NSLocalizedDescriptionKey:
              "The Live M4A writer format does not match the microphone route."
          ]
        )
      }

      try file.write(
        from: buffer
      )
    } catch {
      storedWriterError =
        error.localizedDescription
    }
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

  private let processor: LiveFileAudioProcessor
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
    processor: LiveFileAudioProcessor,
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

  func stop() async -> LiveWhisperStopSnapshot {
    await transcriber
      .stopStreamTranscription()

    if let task {
      await task.value
    }

    processor.stopRecording()

    return LiveWhisperStopSnapshot(
      audioUri: audioURL.absoluteString,
      durationMillis: processor.durationMillis,
      bytes: processor.bytes,
      writerError: processor.writerError
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
