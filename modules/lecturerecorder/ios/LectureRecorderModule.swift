import ExpoModulesCore
@preconcurrency import AVFoundation

private final class LectureRecorderException: Exception {
  private let recorderReason: String

  init(
    code: String,
    message: String,
    file: String,
    line: UInt,
    function: String
  ) {
    self.recorderReason = message

    super.init(
      name: "LectureRecorderError",
      description: message,
      code: code,
      file: file,
      line: line,
      function: function
    )
  }

  override var reason: String {
    recorderReason
  }
}

public final class LectureRecorderModule: Module {
  private let writerQueue = DispatchQueue(
    label: "com.norsktrainer.lecture-recorder.writer",
    qos: .userInitiated
  )

  private let mergeQueue = DispatchQueue(
    label: "com.norsktrainer.lecture-recorder.merge",
    qos: .userInitiated
  )

  private let stateLock = NSLock()
  private let tapCallbackGroup = DispatchGroup()

  // Finalize the first durable checkpoint quickly so an early force-quit
  // does not discard the whole recording. Later checkpoints stay longer
  // to limit AAC segment boundaries during long lectures.
  private let firstSegmentDurationSeconds = 5.0
  private let segmentDurationSeconds = 30.0

  private var audioEngine: AVAudioEngine?
  private var inputTapInstalled = false

  // Writer-queue-owned state.
  private var currentSegmentFile: AVAudioFile?
  private var currentPartURL: URL?
  private var nextSegmentIndex = 1
  private var currentSegmentDurationSeconds = 0.0

  // Main-thread lifecycle state.
  private var currentDestinationURL: URL?
  private var currentSegmentsDirectoryURL: URL?
  private var pendingStopPromise: Promise?
  private var isStopping = false
  private var isPausedForInterruption = false
  private var resumeToken: UUID?
  private var interruptionObserver: NSObjectProtocol?
  private var routeChangeObserver: NSObjectProtocol?
  private var mediaServicesResetObserver: NSObjectProtocol?
  private var lifecycleRestartPending = false

  // Lock-protected live metrics/state snapshots.
  private var capturedDurationSeconds = 0.0
  private var latestLevelDb = -160.0
  private var latestPeakDb = -160.0
  private var finalizedBytes = 0
  private var finalizedSegmentCount = 0
  private var currentPartURLSnapshot: URL?
  private var writerFailureMessage: String?
  private var acceptingBuffers = false
  private var hasSuccessfulWrite = false

  // MARK: - Durable recording manifest

  private struct RecordingManifestSegment: Codable {
    let index: Int
    let file: String
    let durationMillis: Int
    let bytes: Int
    let status: String
  }

  private struct RecordingManifestAssembly: Codable {
    var state: String
    var generation: Int
    var output: String?
  }

  private struct RecordingManifest: Codable {
    var version: Int
    var recordingId: String
    var createdAt: String
    var updatedAt: String
    var state: String
    var segments: [RecordingManifestSegment]
    var committedDurationMillis: Int
    var activeSegmentIndex: Int
    var assembly: RecordingManifestAssembly
  }

  public func definition() -> ModuleDefinition {
    Name("LectureRecorder")

    Events(
      "onRecorderReady",
      "onRecorderStopped",
      "onRecorderError"
    )

    AsyncFunction("start") { (destinationUri: String) -> [String: Any] in
      if self.pendingStopPromise != nil || self.isStopping {
        throw self.makeException(
          code: "ERR_STOP_PENDING",
          message: "The previous lecture recording is still finishing."
        )
      }

      if self.currentDestinationURL != nil {
        throw self.makeException(
          code: "ERR_ALREADY_RECORDING",
          message: "A lecture recording is already in progress."
        )
      }

      guard
        let destinationURL = URL(string: destinationUri),
        destinationURL.isFileURL
      else {
        throw self.makeException(
          code: "ERR_INVALID_DESTINATION",
          message: "The recording destination is not a valid local file URL."
        )
      }

      let parentURL = destinationURL.deletingLastPathComponent()
      try FileManager.default.createDirectory(
        at: parentURL,
        withIntermediateDirectories: true
      )

      let segmentsDirectoryURL =
        self.segmentsDirectoryURL(
          for: destinationURL
        )

      let manifestURL =
        self.recordingManifestURL(
          for: destinationURL
        )

      let destinationExists =
        FileManager.default.fileExists(
          atPath: destinationURL.path
        )

      let segmentsDirectoryExists =
        FileManager.default.fileExists(
          atPath: segmentsDirectoryURL.path
        )

      let manifestExists =
        FileManager.default.fileExists(
          atPath: manifestURL.path
        )

      guard
        !destinationExists,
        !segmentsDirectoryExists,
        !manifestExists
      else {
        throw self.makeException(
          code: "ERR_DESTINATION_EXISTS",
          message: "The lecture recording destination already contains durable recording data. Start refused to overwrite it."
        )
      }

      try FileManager.default.createDirectory(
        at: segmentsDirectoryURL,
        withIntermediateDirectories: true
      )

      try self.createInitialRecordingManifest(
        for: destinationURL
      )

      self.currentDestinationURL = destinationURL
      self.currentSegmentsDirectoryURL = segmentsDirectoryURL
      self.isStopping = false
      self.isPausedForInterruption = false
      self.resumeToken = nil

      self.resetLiveState()
      self.resetWriterState()

      do {
        try self.configureAudioSessionForRecording()
        try self.startCaptureEngine()

        // Register lifecycle observers only after the initial audio
        // session configuration and engine start have succeeded.
        //
        // configureAudioSessionForRecording() can itself cause iOS to
        // publish route-change notifications. Observing those during
        // initial Start can make the recorder restart itself before the
        // first durable microphone write has been confirmed.
        self.ensureAudioLifecycleObservers()
      } catch {
        self.stopCaptureEngine()
        self.deactivateAudioSession()
        self.abortWriterAndDeletePartial()
        self.removeDirectoryIfPresent(segmentsDirectoryURL)
        self.currentDestinationURL = nil
        self.currentSegmentsDirectoryURL = nil
        self.resetLiveState()

        throw self.makeException(
          code: "ERR_START_RECORDING",
          message: "Could not start the native lecture recorder: \(error.localizedDescription)"
        )
      }

      // Engine start alone is not proof that microphone data can be
      // persisted. onRecorderReady is emitted only after the first
      // AVAudioFile.write(from:) succeeds.
      return self.makeStatusResult(
        ok: true
      )
    }
    .runOnQueue(.main)

    AsyncFunction("stop") { (promise: Promise) in
      guard self.currentDestinationURL != nil else {
        promise.reject(
          self.makeException(
            code: "ERR_NO_RECORDING",
            message: "There is no active lecture recording to stop."
          )
        )
        return
      }

      guard self.pendingStopPromise == nil else {
        promise.reject(
          self.makeException(
            code: "ERR_STOP_PENDING",
            message: "The lecture recording is already stopping."
          )
        )
        return
      }

      self.pendingStopPromise = promise
      self.isStopping = true
      self.resumeToken = nil

      self.stopAcceptingNewBuffers()
      self.stopCaptureEngine()
      self.tapCallbackGroup.wait()
      self.deactivateAudioSession()

      self.writerQueue.async { [weak self] in
        guard let self else { return }

        self.finalizeCurrentSegmentOnWriterQueue()

        // Retry any checkpoint that was kept as .part.m4a because its
        // first immediate validation happened before the container became
        // readable. This is also used by next-launch force-quit recovery.
        if let segmentsDirectoryURL = self.currentSegmentsDirectoryURL {
          self.promoteRecoverablePartialSegments(
            in: segmentsDirectoryURL
          )

          // Every finalized checkpoint is committed durably at the
          // moment it becomes recoverable. Ordinary Stop therefore does
          // not rescan or revalidate the complete recording here.
        }

        let segmentURLs =
          self.completedSegmentURLs(
            in: self.currentSegmentsDirectoryURL
          )

        let unresolvedPartialURLs =
          self.unresolvedPartialSegmentURLs(
            in: self.currentSegmentsDirectoryURL
          )

        DispatchQueue.main.async {
          self.finishStopBySaving(
            segmentURLs: segmentURLs,
            unresolvedPartialURLs: unresolvedPartialURLs
          )
        }
      }
    }
    .runOnQueue(.main)

    AsyncFunction("cancel") { () -> [String: Any] in
      guard self.pendingStopPromise == nil else {
        throw self.makeException(
          code: "ERR_STOP_PENDING",
          message: "Cannot cancel while the lecture recording is already finishing."
        )
      }

      let destinationURL = self.currentDestinationURL
      let segmentsDirectoryURL = self.currentSegmentsDirectoryURL

      self.resumeToken = nil
      self.isStopping = true
      self.isPausedForInterruption = false

      self.stopAcceptingNewBuffers()
      self.stopCaptureEngine()
      self.tapCallbackGroup.wait()
      self.deactivateAudioSession()
      self.abortWriterAndDeletePartial()

      if let destinationURL {
        self.removeFileIfPresent(destinationURL)
      }

      if let segmentsDirectoryURL {
        self.removeDirectoryIfPresent(segmentsDirectoryURL)
      }

      self.currentDestinationURL = nil
      self.currentSegmentsDirectoryURL = nil
      self.isStopping = false
      self.resetLiveState()
      self.resetWriterState()

      return [
        "ok": true
      ]
    }
    .runOnQueue(.main)

    Function("getStatus") { () -> [String: Any] in
      self.makeStatusResult(
        ok: true
      )
    }

    AsyncFunction("getAudioInfo") { (uri: String) -> [String: Any] in
      guard
        let url = URL(string: uri),
        url.isFileURL
      else {
        throw self.makeException(
          code: "ERR_INVALID_AUDIO_URI",
          message: "The selected audio file is not a valid local file URL."
        )
      }

      guard FileManager.default.fileExists(atPath: url.path) else {
        throw self.makeException(
          code: "ERR_AUDIO_MISSING",
          message: "The selected audio file does not exist."
        )
      }

      let player = try AVAudioPlayer(contentsOf: url)
      let durationMillis = Int(
        (player.duration * 1000.0).rounded()
      )

      return [
        "ok": true,
        "durationMillis": durationMillis,
        "uri": url.absoluteString,
        "bytes": self.fileSize(url)
      ]
    }
    .runOnQueue(.main)

    AsyncFunction("validateRecording") { (uri: String) -> [String: Any] in
      guard
        let url = URL(string: uri),
        url.isFileURL
      else {
        return self.makeValidationResult(
          valid: false,
          playable: false,
          durationMillis: 0,
          uri: uri,
          bytes: 0,
          code: "ERR_INVALID_AUDIO_URI",
          message: "The recording path is not a valid local file URL."
        )
      }

      return self.validateAudioFile(
        url
      )
    }
    .runOnQueue(.main)

    AsyncFunction("recoverRecording") { (destinationUri: String, promise: Promise) in
      guard
        let destinationURL = URL(string: destinationUri),
        destinationURL.isFileURL
      else {
        promise.resolve(
          self.makeValidationResult(
            valid: false,
            playable: false,
            durationMillis: 0,
            uri: destinationUri,
            bytes: 0,
            code: "ERR_INVALID_AUDIO_URI",
            message: "The recovery destination is not a valid local file URL."
          )
        )
        return
      }

      let existingValidation =
        self.validateAudioFile(
          destinationURL
        )

      let segmentsDirectoryURL =
        self.segmentsDirectoryURL(
          for: destinationURL
        )

      let hasSegmentsDirectory =
        FileManager.default.fileExists(
          atPath: segmentsDirectoryURL.path
        )

      if
        (existingValidation["valid"] as? Bool) == true,
        (existingValidation["playable"] as? Bool) == true,
        !hasSegmentsDirectory
      {
        promise.resolve(existingValidation)
        return
      }

      self.writerQueue.async { [weak self] in
        guard let self else { return }

        self.promoteRecoverablePartialSegments(
          in: segmentsDirectoryURL,
          destinationURL: destinationURL
        )

        let unresolvedPartialURLs =
          self.unresolvedPartialSegmentURLs(
            in: segmentsDirectoryURL
          )

        guard unresolvedPartialURLs.isEmpty else {
          let unresolvedNames =
            unresolvedPartialURLs
              .map {
                $0.lastPathComponent
              }
              .joined(
                separator: ", "
              )

          let manifest =
            self.loadRecordingManifest(
              for: destinationURL
            )

          let committedDurationMillis =
            manifest?
              .committedDurationMillis ??
            0

          let committedBytes =
            manifest?
              .segments
              .reduce(
                0
              ) {
                $0 + $1.bytes
              } ??
            0

          let result =
            self.makeValidationResult(
              valid: false,
              playable: false,
              durationMillis: committedDurationMillis,
              uri: destinationURL.absoluteString,
              bytes: committedBytes,
              code: "ERR_UNRESOLVED_PARTIAL_SEGMENT",
              message: "Recovery preserved an unresolved lecture audio tail instead of assembling an incomplete recording: \(unresolvedNames)"
            )

          DispatchQueue.main.async {
            promise.resolve(result)
          }

          return
        }

        let reconciledManifest: RecordingManifest

        do {
          reconciledManifest =
            try self.reconcileRecordingManifestDurably(
              for: destinationURL
            )
        } catch {
          let manifest =
            self.loadRecordingManifest(
              for: destinationURL
            )

          let committedDurationMillis =
            manifest?
              .committedDurationMillis ??
            0

          let committedBytes =
            manifest?
              .segments
              .reduce(
                0
              ) {
                $0 + $1.bytes
              } ??
            0

          let result =
            self.makeValidationResult(
              valid: false,
              playable: false,
              durationMillis: committedDurationMillis,
              uri: destinationURL.absoluteString,
              bytes: committedBytes,
              code: "ERR_RECOVERY_RECONCILIATION",
              message: error.localizedDescription
            )

          DispatchQueue.main.async {
            promise.resolve(result)
          }

          return
        }

        let segmentURLs =
          reconciledManifest
            .segments
            .map {
              segmentsDirectoryURL
                .appendingPathComponent(
                  $0.file
                )
            }

        guard !segmentURLs.isEmpty else {
          let fallback =
            FileManager.default.fileExists(
              atPath: destinationURL.path
            )
              ? self.validateAudioFile(
                  destinationURL
                )
              : self.makeValidationResult(
                  valid: false,
                  playable: false,
                  durationMillis: 0,
                  uri: destinationURL.absoluteString,
                  bytes: 0,
                  code: "ERR_NO_RECOVERABLE_SEGMENTS",
                  message: "No finalized lecture segments were available for recovery."
                )

          DispatchQueue.main.async {
            promise.resolve(fallback)
          }
          return
        }

        do {
          try self.updateRecordingManifestDurably(
            for: destinationURL
          ) {
            $0.state = "saved"
            $0.assembly.state = "assembling"
            $0.assembly.generation += 1
          }
        } catch {
          let committedBytes =
            reconciledManifest
              .segments
              .reduce(
                0
              ) {
                $0 + $1.bytes
              }

          let result =
            self.makeValidationResult(
              valid: false,
              playable: false,
              durationMillis:
                reconciledManifest
                  .committedDurationMillis,
              uri: destinationURL.absoluteString,
              bytes: committedBytes,
              code: "ERR_RECOVERY_MANIFEST_TRANSITION",
              message: error.localizedDescription
            )

          DispatchQueue.main.async {
            promise.resolve(result)
          }

          return
        }

        self.mergeSegments(
          segmentURLs,
          to: destinationURL,
          protectExistingRecording: true
        ) { result in
          DispatchQueue.main.async {
            switch result {
            case .success(let validation):
              do {
                try self.updateRecordingManifestDurably(
                  for: destinationURL
                ) {
                  $0.state = "ready"
                  $0.assembly.state = "ready"
                  $0.assembly.output = destinationURL.lastPathComponent
                }
              } catch {
                let committedBytes =
                  reconciledManifest
                    .segments
                    .reduce(
                      0
                    ) {
                      $0 + $1.bytes
                    }

                promise.resolve(
                  self.makeValidationResult(
                    valid: false,
                    playable: false,
                    durationMillis:
                      reconciledManifest
                        .committedDurationMillis,
                    uri: destinationURL.absoluteString,
                    bytes: committedBytes,
                    code: "ERR_RECOVERY_READY_MANIFEST",
                    message: "The recovered audio file was assembled, but its ready state could not be committed durably: \(error.localizedDescription)"
                  )
                )

                return
              }

              // Recovery must never consume its source checkpoints.
              // A recovered audio.m4a is derived from the durable segments.
              promise.resolve(validation)

            case .failure(let error):
              do {
                try self.updateRecordingManifestDurably(
                  for: destinationURL
                ) {
                  $0.state = "saved"
                  $0.assembly.state = "assembly_failed"
                }
              } catch let manifestError {
                let committedBytes =
                  reconciledManifest
                    .segments
                    .reduce(
                      0
                    ) {
                      $0 + $1.bytes
                    }

                promise.resolve(
                  self.makeValidationResult(
                    valid: false,
                    playable: false,
                    durationMillis:
                      reconciledManifest
                        .committedDurationMillis,
                    uri: destinationURL.absoluteString,
                    bytes: committedBytes,
                    code: "ERR_RECOVERY_FAILURE_MANIFEST",
                    message: "Lecture assembly failed and the failure state could not be committed durably. Assembly error: \(error.localizedDescription). Manifest error: \(manifestError.localizedDescription)"
                  )
                )

                return
              }

              let manifest =
                self.loadRecordingManifest(
                  for: destinationURL
                )

              let committedDurationMillis =
                manifest?
                  .committedDurationMillis ??
                reconciledManifest
                  .committedDurationMillis

              let committedBytes =
                manifest?
                  .segments
                  .reduce(
                    0
                  ) {
                    $0 + $1.bytes
                  } ??
                reconciledManifest
                  .segments
                  .reduce(
                    0
                  ) {
                    $0 + $1.bytes
                  }

              promise.resolve(
                self.makeValidationResult(
                  valid: false,
                  playable: false,
                  durationMillis: committedDurationMillis,
                  uri: destinationURL.absoluteString,
                  bytes: committedBytes,
                  code: "ERR_RECOVERY_MERGE",
                  message: error.localizedDescription
                )
              )
            }
          }
        }
      }
    }
    .runOnQueue(.main)
  }

  deinit {
    if let interruptionObserver {
      NotificationCenter.default.removeObserver(interruptionObserver)
    }
    if let routeChangeObserver {
      NotificationCenter.default.removeObserver(routeChangeObserver)
    }
    if let mediaServicesResetObserver {
      NotificationCenter.default.removeObserver(mediaServicesResetObserver)
    }
  }

  // MARK: - Audio session / lifecycle

  private func ensureAudioLifecycleObservers() {
    let center = NotificationCenter.default
    let session = AVAudioSession.sharedInstance()

    if interruptionObserver == nil {
      interruptionObserver =
        center.addObserver(
          forName: AVAudioSession.interruptionNotification,
          object: session,
          queue: .main
        ) { [weak self] notification in
          self?.handleAudioSessionInterruption(notification)
        }
    }

    if routeChangeObserver == nil {
      routeChangeObserver =
        center.addObserver(
          forName: AVAudioSession.routeChangeNotification,
          object: session,
          queue: .main
        ) { [weak self] _ in
          self?.restartCaptureAfterLifecycleChange(reason: "route change")
        }
    }

    if mediaServicesResetObserver == nil {
      mediaServicesResetObserver =
        center.addObserver(
          forName: AVAudioSession.mediaServicesWereResetNotification,
          object: session,
          queue: .main
        ) { [weak self] _ in
          self?.restartCaptureAfterLifecycleChange(reason: "media services reset")
        }
    }
  }

  private func restartCaptureAfterLifecycleChange(
    reason: String
  ) {
    guard
      currentDestinationURL != nil,
      !isStopping,
      !isPausedForInterruption,
      !lifecycleRestartPending
    else {
      return
    }

    lifecycleRestartPending = true
    stopAcceptingNewBuffers()
    stopCaptureEngine()
    tapCallbackGroup.wait()

    writerQueue.async { [weak self] in
      guard let self else { return }
      self.finalizeCurrentSegmentOnWriterQueue()

      DispatchQueue.main.async {
        guard
          self.currentDestinationURL != nil,
          !self.isStopping,
          !self.isPausedForInterruption
        else {
          self.lifecycleRestartPending = false
          return
        }

        do {
          try self.configureAudioSessionForRecording()
          try self.startCaptureEngine()
          self.lifecycleRestartPending = false
        } catch {
          self.lifecycleRestartPending = false
          let snapshot = self.statusSnapshot()
          self.emitRecorderError(
            code: "ERR_AUDIO_LIFECYCLE_RESTART",
            message: "The recorder could not resume after \(reason): \(error.localizedDescription)",
            url: self.currentDestinationURL,
            bytes: snapshot.bytes,
            durationMillis: snapshot.durationMillis
          )
        }
      }
    }
  }

  private func handleAudioSessionInterruption(
    _ notification: Notification
  ) {
    guard currentDestinationURL != nil else {
      return
    }

    guard
      let rawType =
        notification.userInfo?[AVAudioSessionInterruptionTypeKey]
          as? UInt,
      let type =
        AVAudioSession.InterruptionType(
          rawValue: rawType
        )
    else {
      return
    }

    switch type {
    case .began:
      handleInterruptionBegan()

    case .ended:
      handleInterruptionEnded()

    @unknown default:
      break
    }
  }

  private func handleInterruptionBegan() {
    guard
      currentDestinationURL != nil,
      !isStopping,
      !isPausedForInterruption
    else {
      return
    }

    isPausedForInterruption = true
    resumeToken = nil

    stopAcceptingNewBuffers()
    stopCaptureEngine()
    tapCallbackGroup.wait()

    // Drain already-captured buffers, then close the current
    // compressed segment cleanly. The accepted-call interval
    // itself produces no buffers and therefore adds no duration.
    writerQueue.async { [weak self] in
      self?.finalizeCurrentSegmentOnWriterQueue()
    }
  }

  private func handleInterruptionEnded() {
    guard
      currentDestinationURL != nil,
      !isStopping,
      isPausedForInterruption
    else {
      return
    }

    let token = UUID()
    resumeToken = token

    // Wait until the interruption-began writer flush has completed.
    writerQueue.async { [weak self] in
      DispatchQueue.main.async {
        self?.attemptAutomaticResume(
          token: token,
          attempt: 1
        )
      }
    }
  }

  private func attemptAutomaticResume(
    token: UUID,
    attempt: Int
  ) {
    guard
      resumeToken == token,
      currentDestinationURL != nil,
      !isStopping,
      isPausedForInterruption
    else {
      return
    }

    do {
      try configureAudioSessionForRecording()
      try startCaptureEngine()

      isPausedForInterruption = false
      resumeToken = nil

    } catch {
      if attempt < 3 {
        let delay =
          attempt == 1
            ? 0.5
            : 1.0

        DispatchQueue.main.asyncAfter(
          deadline: .now() + delay
        ) { [weak self] in
          self?.attemptAutomaticResume(
            token: token,
            attempt: attempt + 1
          )
        }
        return
      }

      resumeToken = nil

      emitRecorderError(
        code: "ERR_RESUME_AFTER_INTERRUPTION",
        message: "The lecture could not resume automatically after the phone/audio interruption: \(error.localizedDescription)",
        url: currentDestinationURL,
        bytes: statusSnapshot().bytes,
        durationMillis: statusSnapshot().durationMillis
      )
    }
  }

  private func configureAudioSessionForRecording() throws {
    let session = AVAudioSession.sharedInstance()

    try session.setCategory(
      .playAndRecord,
      mode: .default,
      options: [
        .defaultToSpeaker,
        .allowBluetoothHFP
      ]
    )

    // These are preferences. iOS may choose a different hardware
    // format depending on the active microphone / Bluetooth route.
    try? session.setPreferredSampleRate(
      44_100.0
    )

    try? session.setPreferredInputNumberOfChannels(
      1
    )

    // With incoming-call banner style, this asks iOS not to stop
    // recording merely because the call banner appeared. If the
    // user accepts the call, an interruption still begins.
    try? session.setPrefersNoInterruptionsFromSystemAlerts(
      true
    )

    try session.setActive(true)
  }

  private func deactivateAudioSession() {
    try? AVAudioSession
      .sharedInstance()
      .setActive(
        false,
        options: .notifyOthersOnDeactivation
      )
  }

  // MARK: - AVAudioEngine capture

  private func startCaptureEngine() throws {
    guard currentSegmentsDirectoryURL != nil else {
      throw makeNSError(
        code: "ERR_SEGMENT_DIRECTORY",
        message: "The lecture segment directory is unavailable."
      )
    }

    let engine = AVAudioEngine()
    let inputNode = engine.inputNode

    // Use the input node's actual OUTPUT processing format. This is the
    // format Apple exposes for microphone taps and it is route-aware
    // (built-in mic, Bluetooth HFP, etc.). Using inputFormat(forBus:) and
    // constructing a second format can leave AVAudioEngine with an
    // incompatible graph and fail start() with an AVFAudio '!dat' error.
    let recordingFormat =
      inputNode.outputFormat(
        forBus: 0
      )

    guard
      recordingFormat.sampleRate > 0,
      recordingFormat.channelCount > 0
    else {
      throw makeNSError(
        code: "ERR_INPUT_FORMAT",
        message: "The microphone has no usable output processing format."
      )
    }

    // Do not pre-open the compressed M4A writer before the engine is
    // running. The first real microphone buffer carries the authoritative
    // route format and writeBufferOnWriterQueue() opens the segment from
    // that buffer. This avoids creating an AAC writer from a stale route
    // format while iOS is still settling the audio session.
    inputNode.installTap(
      onBus: 0,
      bufferSize: 2048,
      format: recordingFormat
    ) { [weak self] buffer, _ in
      guard let self else { return }

      self.tapCallbackGroup.enter()
      defer {
        self.tapCallbackGroup.leave()
      }

      guard self.isAcceptingNewBuffers() else {
        return
      }

      self.updateLiveMetrics(
        from: buffer
      )

      guard
        let copiedBuffer =
          self.copyPCMBuffer(
            buffer
          )
      else {
        self.reportWriterFailure(
          "Could not copy a microphone buffer."
        )
        return
      }

      self.writerQueue.async { [weak self] in
        self?.writeBufferOnWriterQueue(
          copiedBuffer
        )
      }
    }

    inputTapInstalled = true
    startAcceptingNewBuffers()

    engine.prepare()

    do {
      try engine.start()
    } catch {
      stopAcceptingNewBuffers()

      inputNode.removeTap(
        onBus: 0
      )
      inputTapInstalled = false

      tapCallbackGroup.wait()

      writerQueue.sync {
        self.abortCurrentPartialOnWriterQueue()
      }

      let nsError = error as NSError
      throw makeNSError(
        code: "ERR_ENGINE_START",
        message:
          "AVAudioEngine could not start. " +
          "format=\(recordingFormat.sampleRate)Hz/\(recordingFormat.channelCount)ch, " +
          "underlying=\(nsError.domain) \(nsError.code): \(nsError.localizedDescription)"
      )
    }

    audioEngine = engine
  }

  private func stopCaptureEngine() {
    guard let engine = audioEngine else {
      return
    }

    if inputTapInstalled {
      engine.inputNode.removeTap(
        onBus: 0
      )
      inputTapInstalled = false
    }

    engine.stop()
    audioEngine = nil
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

    /*
     * Copy the raw AudioBufferList instead of assuming Float32,
     * deinterleaved microphone buffers. The actual AVAudioEngine input
     * format is route-dependent and can be Int16 / interleaved on some
     * iPhone audio routes. The previous Float32-only copy path rejected
     * the very first buffer, which stopped the writer before a checkpoint
     * existed and left the UI timer at 0.
     */
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

    guard
      sourceBuffers.count ==
        destinationBuffers.count
    else {
      return nil
    }

    for index in 0..<sourceBuffers.count {
      guard
        let sourceData =
          sourceBuffers[index].mData,
        let destinationData =
          destinationBuffers[index].mData
      else {
        return nil
      }

      let sourceByteCount =
        Int(
          sourceBuffers[index]
            .mDataByteSize
        )

      let destinationCapacity =
        Int(
          destinationBuffers[index]
            .mDataByteSize
        )

      guard
        sourceByteCount > 0,
        sourceByteCount <=
          destinationCapacity
      else {
        return nil
      }

      memcpy(
        destinationData,
        sourceData,
        sourceByteCount
      )

      destinationBuffers[index]
        .mDataByteSize =
          UInt32(
            sourceByteCount
          )
    }

    return copy
  }

  private func updateLiveMetrics(
    from buffer: AVAudioPCMBuffer
  ) {
    guard
      buffer.frameLength > 0,
      buffer.format.sampleRate > 0,
      buffer.format.channelCount > 0
    else {
      return
    }

    let frameCount = Int(
      buffer.frameLength
    )

    let channelCount = Int(
      buffer.format.channelCount
    )

    /*
     * Duration is authoritative even when the current hardware route
     * doesn't expose Float32 channel data. Never make the recording timer
     * depend on one PCM sample representation.
     */
    let durationDelta =
      Double(buffer.frameLength) /
      buffer.format.sampleRate

    var sumSquares = 0.0
    var peak = 0.0
    var measuredSampleCount = 0

    switch buffer.format.commonFormat {
    case .pcmFormatFloat32:
      if let channels =
          buffer.floatChannelData {
        let stride =
          max(
            1,
            buffer.stride
          )

        for channel in 0..<channelCount {
          let samples =
            channels[channel]

          for frame in 0..<frameCount {
            let value =
              Double(
                samples[
                  frame * stride
                ]
              )

            let magnitude =
              abs(value)

            sumSquares +=
              value * value

            peak = max(
              peak,
              magnitude
            )

            measuredSampleCount += 1
          }
        }
      }

    case .pcmFormatInt16:
      if let channels =
          buffer.int16ChannelData {
        let stride =
          max(
            1,
            buffer.stride
          )

        for channel in 0..<channelCount {
          let samples =
            channels[channel]

          for frame in 0..<frameCount {
            let value =
              Double(
                samples[
                  frame * stride
                ]
              ) /
              32_768.0

            let magnitude =
              abs(value)

            sumSquares +=
              value * value

            peak = max(
              peak,
              magnitude
            )

            measuredSampleCount += 1
          }
        }
      }

    case .pcmFormatInt32:
      if let channels =
          buffer.int32ChannelData {
        let stride =
          max(
            1,
            buffer.stride
          )

        for channel in 0..<channelCount {
          let samples =
            channels[channel]

          for frame in 0..<frameCount {
            let value =
              Double(
                samples[
                  frame * stride
                ]
              ) /
              2_147_483_648.0

            let magnitude =
              abs(value)

            sumSquares +=
              value * value

            peak = max(
              peak,
              magnitude
            )

            measuredSampleCount += 1
          }
        }
      }

    default:
      break
    }

    withStateLock {
      capturedDurationSeconds +=
        durationDelta

      guard
        measuredSampleCount > 0
      else {
        return
      }

      let rms =
        sqrt(
          sumSquares /
          Double(
            measuredSampleCount
          )
        )

      let levelDb =
        20.0 * log10(
          max(
            rms,
            0.00000001
          )
        )

      let peakDb =
        20.0 * log10(
          max(
            peak,
            0.00000001
          )
        )

      latestLevelDb = max(
        -160.0,
        min(
          0.0,
          levelDb
        )
      )

      latestPeakDb = max(
        -160.0,
        min(
          0.0,
          peakDb
        )
      )
    }
  }

  // MARK: - Segment writer

  private func openNextSegmentOnWriterQueue(
    processingFormat: AVAudioFormat
  ) throws {
    guard let directoryURL = currentSegmentsDirectoryURL else {
      throw makeNSError(
        code: "ERR_SEGMENT_DIRECTORY",
        message: "The lecture segment directory is unavailable."
      )
    }

    try FileManager.default.createDirectory(
      at: directoryURL,
      withIntermediateDirectories: true
    )

    let partURL =
      directoryURL.appendingPathComponent(
        String(
          format: "segment-%06d.part.m4a",
          nextSegmentIndex
        )
      )

    nextSegmentIndex += 1

    removeFileIfPresent(
      partURL
    )

    let channelCount = max(
      1,
      Int(processingFormat.channelCount)
    )

    // Do not force a fixed AAC bit rate here. The active iOS input route can
    // legitimately run at 8/16/24/44.1/48 kHz (for example Bluetooth HFP),
    // and a hard-coded 128/192 kbps request can be rejected by the active
    // codec as kAudioCodecUnsupportedFormatError ('!dat'). Let Core Audio
    // choose a supported bit rate for the actual route while keeping high
    // encoder quality.
    let settings: [String: Any] = [
      AVFormatIDKey:
        Int(kAudioFormatMPEG4AAC),
      AVSampleRateKey:
        processingFormat.sampleRate,
      AVNumberOfChannelsKey:
        channelCount,
      AVEncoderAudioQualityKey:
        AVAudioQuality.high.rawValue
    ]

    /*
     * AVAudioFile.write(from:) requires the incoming buffer format to
     * match the file's processing format. Preserve the actual microphone
     * buffer's PCM representation instead of forcing Float32/deinterleaved.
     * AVAudioFile still encodes AAC on disk from the settings above.
     */
    guard
      processingFormat.commonFormat !=
        .otherFormat
    else {
      throw makeNSError(
        code: "ERR_UNSUPPORTED_PCM_FORMAT",
        message:
          "The microphone produced an unsupported PCM format."
      )
    }

    let file = try AVAudioFile(
      forWriting: partURL,
      settings: settings,
      commonFormat:
        processingFormat.commonFormat,
      interleaved:
        processingFormat.isInterleaved
    )

    guard
      file.processingFormat.sampleRate ==
        processingFormat.sampleRate,
      file.processingFormat.channelCount ==
        processingFormat.channelCount,
      file.processingFormat.commonFormat ==
        processingFormat.commonFormat,
      file.processingFormat.isInterleaved ==
        processingFormat.isInterleaved
    else {
      throw makeNSError(
        code: "ERR_WRITER_FORMAT_MISMATCH",
        message:
          "The M4A writer processing format does not match the microphone buffer format."
      )
    }

    currentSegmentFile = file
    currentPartURL = partURL
    currentSegmentDurationSeconds = 0

    withStateLock {
      currentPartURLSnapshot = partURL
    }
  }

  private func writeBufferOnWriterQueue(
    _ buffer: AVAudioPCMBuffer
  ) {
    guard writerFailureMessage == nil else {
      return
    }

    do {
      if currentSegmentFile == nil {
        try openNextSegmentOnWriterQueue(
          processingFormat: buffer.format
        )
      }

      /*
       * Keep the AVAudioFile strong reference inside a helper call only.
       * On iOS < 18 AVAudioFile has no public close(), so finalization relies
       * on releasing the last strong reference. Previously `let file = ...`
       * stayed alive for the whole writeBufferOnWriterQueue() scope, which
       * meant the periodic checkpoint was validated while the M4A was still
       * open. The checkpoint could then be rejected/deleted and force-quit
       * recovery had nothing durable to rebuild.
       */
      try writeToCurrentSegmentOnWriterQueue(
        buffer
      )

      markSuccessfulWriteAndEmitReadyIfNeeded()

      currentSegmentDurationSeconds +=
        Double(buffer.frameLength) /
        buffer.format.sampleRate

      let targetDuration =
        nextSegmentIndex == 2
          ? firstSegmentDurationSeconds
          : segmentDurationSeconds

      if currentSegmentDurationSeconds >= targetDuration {
        finalizeCurrentSegmentOnWriterQueue()

        if isAcceptingNewBuffers() {
          try openNextSegmentOnWriterQueue(
            processingFormat: buffer.format
          )
        }
      }

    } catch {
      reportWriterFailure(
        error.localizedDescription
      )
    }
  }

  private func writeToCurrentSegmentOnWriterQueue(
    _ buffer: AVAudioPCMBuffer
  ) throws {
    guard let file = currentSegmentFile else {
      throw makeNSError(
        code: "ERR_SEGMENT_WRITER",
        message: "The lecture segment writer is unavailable."
      )
    }

    try file.write(
      from: buffer
    )
  }


  private func markSuccessfulWriteAndEmitReadyIfNeeded() {
    let shouldEmitReady = withStateLock { () -> Bool in
      if hasSuccessfulWrite {
        return false
      }

      hasSuccessfulWrite = true
      return true
    }

    guard shouldEmitReady else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      guard
        self.currentDestinationURL != nil,
        !self.isStopping,
        self.statusSnapshot().writerFailureMessage == nil
      else {
        return
      }

      self.sendEvent(
        "onRecorderReady",
        self.makeStatusResult(ok: true)
      )
    }
  }

  private func finalizeCurrentSegmentOnWriterQueue() {
    guard let partURL = currentPartURL else {
      currentSegmentFile = nil
      currentSegmentDurationSeconds = 0
      return
    }

    currentSegmentFile = nil
    currentPartURL = nil
    currentSegmentDurationSeconds = 0

    withStateLock {
      currentPartURLSnapshot = nil
    }

    let validation =
      validateAudioFileWithRetry(
        partURL,
        attempts: 8,
        delaySeconds: 0.10
      )

    guard
      (validation["valid"] as? Bool) == true,
      (validation["playable"] as? Bool) == true
    else {
      // Never destroy a checkpoint merely because immediate validation
      // failed. Keep the .part.m4a so Stop/recovery can retry promotion
      // after every AVAudioFile reference has definitely been released.
      return
    }

    let finalURL =
      finalizedSegmentURL(
        forPartURL: partURL
      )

    do {
      guard
        !FileManager.default.fileExists(
          atPath: finalURL.path
        )
      else {
        throw makeNSError(
          code: "ERR_SEGMENT_DESTINATION_EXISTS",
          message: "A finalized lecture checkpoint already exists for segment \(finalURL.lastPathComponent). Existing durable audio was preserved."
        )
      }

      try FileManager.default.moveItem(
        at: partURL,
        to: finalURL
      )

      let bytes = fileSize(
        finalURL
      )

      withStateLock {
        finalizedBytes += bytes
        finalizedSegmentCount += 1
      }

      if let destinationURL = currentDestinationURL {
        try commitSegmentToRecordingManifestDurably(
          segmentURL: finalURL,
          validation: validation,
          destinationURL: destinationURL
        )
      }

    } catch {
      reportWriterFailure(
        "Could not durably finalize a lecture segment: \(error.localizedDescription)"
      )
    }
  }

  private func abortCurrentPartialOnWriterQueue() {
    currentSegmentFile = nil

    if let currentPartURL {
      removeFileIfPresent(
        currentPartURL
      )
    }

    currentPartURL = nil
    currentSegmentDurationSeconds = 0

    withStateLock {
      currentPartURLSnapshot = nil
    }
  }

  private func abortWriterAndDeletePartial() {
    writerQueue.sync {
      self.abortCurrentPartialOnWriterQueue()
    }
  }

  private func resetWriterState() {
    writerQueue.sync {
      self.currentSegmentFile = nil
      self.currentPartURL = nil
      self.nextSegmentIndex = 1
      self.currentSegmentDurationSeconds = 0
    }
  }

  private func reportWriterFailure(
    _ message: String
  ) {
    var shouldReport = false

    withStateLock {
      if writerFailureMessage == nil {
        writerFailureMessage = message
        shouldReport = true
      }
    }

    guard shouldReport else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }

      self.stopAcceptingNewBuffers()
      self.stopCaptureEngine()
      self.tapCallbackGroup.wait()
      self.deactivateAudioSession()
      self.isPausedForInterruption = true

      let snapshot = self.statusSnapshot()

      self.emitRecorderError(
        code: "ERR_SEGMENT_WRITER",
        message: "The lecture segment writer stopped: \(message)",
        url: self.currentDestinationURL,
        bytes: snapshot.bytes,
        durationMillis: snapshot.durationMillis
      )
    }
  }

  // MARK: - Stop / merge / recovery

  private func finishStopBySaving(
    segmentURLs: [URL],
    unresolvedPartialURLs: [URL]
  ) {
    guard
      let destinationURL = currentDestinationURL,
      let promise = pendingStopPromise
    else {
      return
    }

    guard !segmentURLs.isEmpty else {
      let writerFailure = statusSnapshot().writerFailureMessage
      pendingStopPromise = nil
      cleanupAfterFailedStopPreservingSegments()
      promise.reject(
        makeException(
          code: "ERR_NO_SEGMENTS",
          message: writerFailure.map {
            "No finalized lecture segments were available to save. Writer error: \($0)"
          } ?? "No finalized lecture segments were available to save."
        )
      )
      return
    }

    guard unresolvedPartialURLs.isEmpty else {
      let unresolvedNames =
        unresolvedPartialURLs
          .map {
            $0.lastPathComponent
          }
          .joined(
            separator: ", "
          )

      pendingStopPromise = nil
      cleanupAfterFailedStopPreservingSegments()

      promise.reject(
        makeException(
          code: "ERR_UNRESOLVED_PARTIAL_SEGMENT",
          message: "The finalized lecture checkpoints were preserved, but Stop could not safely commit the current audio tail. Recovery data was preserved: \(unresolvedNames)"
        )
      )
      return
    }

    do {
      let verifiedManifest =
        try verifyRecordingManifestInventoryForStop(
          segmentURLs: segmentURLs,
          destinationURL: destinationURL
        )

      guard
        !verifiedManifest.segments.isEmpty,
        verifiedManifest.committedDurationMillis > 0
      else {
        throw makeNSError(
          code: "ERR_MANIFEST_NOT_DURABLE",
          message: "The lecture checkpoints exist, but their durable manifest could not be confirmed."
        )
      }

      try updateRecordingManifestDurably(
        for: destinationURL
      ) {
        $0.state = "saved"
        $0.assembly.state = "not_started"
        $0.assembly.output = nil
      }
    } catch {
      pendingStopPromise = nil
      cleanupAfterFailedStopPreservingSegments()

      promise.reject(
        makeException(
          code: "ERR_MANIFEST_SAVE",
          message: "The lecture checkpoints were preserved, but the recorder could not durably reconcile and mark the recording as saved: \(error.localizedDescription)"
        )
      )
      return
    }

    guard
      let savedManifest =
        loadRecordingManifest(
          for: destinationURL
        ),
      savedManifest.state == "saved",
      !savedManifest.segments.isEmpty,
      savedManifest.committedDurationMillis > 0
    else {
      pendingStopPromise = nil
      cleanupAfterFailedStopPreservingSegments()

      promise.reject(
        makeException(
          code: "ERR_MANIFEST_SAVE_VERIFY",
          message: "The lecture checkpoints were preserved, but the saved recording state could not be verified."
        )
      )
      return
    }

    let bytes =
      savedManifest.segments.reduce(
        0
      ) {
        $0 + $1.bytes
      }
    let result: [String: Any] = [
      "ok": true,
      "isRecording": false,
      "durationMillis": savedManifest.committedDurationMillis,
      "uri": destinationURL.absoluteString,
      "bytes": bytes,
      "levelDb": -160.0,
      "peakDb": -160.0,
      "isPausedForInterruption": false,
      "segmentCount": savedManifest.segments.count
    ]

    pendingStopPromise = nil
    cleanupAfterSuccessfulStop()
    sendEvent("onRecorderStopped", result)
    promise.resolve(result)
  }

  private func finishStopByMerging(
    segmentURLs: [URL]
  ) {
    guard
      let destinationURL = currentDestinationURL,
      let promise = pendingStopPromise
    else {
      return
    }

    guard !segmentURLs.isEmpty else {
      let writerFailure =
        statusSnapshot()
          .writerFailureMessage

      pendingStopPromise = nil
      cleanupAfterFailedStopPreservingSegments()

      let message =
        writerFailure.map {
          "No finalized lecture segments were available to save. Writer error: \($0)"
        } ??
        "No finalized lecture segments were available to save."

      promise.reject(
        makeException(
          code: "ERR_NO_SEGMENTS",
          message: message
        )
      )
      return
    }

    updateRecordingManifest(
      for: destinationURL
    ) {
      $0.assembly.state = "assembling"
      $0.assembly.generation += 1
    }

    mergeSegments(
      segmentURLs,
      to: destinationURL
    ) { [weak self] result in
      DispatchQueue.main.async {
        guard let self else { return }

        let promise = self.pendingStopPromise
        self.pendingStopPromise = nil

        switch result {
        case .success(let validation):
          guard
            (validation["valid"] as? Bool) == true,
            (validation["playable"] as? Bool) == true,
            let durationMillis =
              validation["durationMillis"] as? Int,
            let bytes =
              validation["bytes"] as? Int
          else {
            self.cleanupAfterFailedStopPreservingSegments()

            promise?.reject(
              self.makeException(
                code: "ERR_INVALID_RECORDING",
                message: "The merged lecture recording is not playable."
              )
            )
            return
          }

          let result: [String: Any] = [
            "ok": true,
            "isRecording": false,
            "durationMillis": durationMillis,
            "uri": destinationURL.absoluteString,
            "bytes": bytes,
            "levelDb": -160.0,
            "peakDb": -160.0,
            "isPausedForInterruption": false,
            "segmentCount": segmentURLs.count
          ]

          self.updateRecordingManifest(
            for: destinationURL
          ) {
            $0.state = "ready"
            $0.assembly.state = "ready"
            $0.assembly.output = destinationURL.lastPathComponent
          }

          // Durable-segment invariant:
          // audio.m4a is a derived artifact. Never delete committed
          // checkpoints merely because assembly succeeded. They remain
          // available for validation, recovery and idempotent rebuilds.
          self.cleanupAfterSuccessfulStop()

          self.sendEvent(
            "onRecorderStopped",
            result
          )

          promise?.resolve(
            result
          )

        case .failure(let error):
          self.updateRecordingManifest(
            for: destinationURL
          ) {
            $0.state = "saved"
            $0.assembly.state = "assembly_failed"
          }

          self.cleanupAfterFailedStopPreservingSegments()

          promise?.reject(
            self.makeException(
              code: "ERR_MERGE_RECORDING",
              message: "Could not assemble the lecture recording: \(error.localizedDescription)"
            )
          )
        }
      }
    }
  }

  private func mergeSegments(
    _ segmentURLs: [URL],
    to destinationURL: URL,
    protectExistingRecording: Bool = false,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    mergeQueue.async { [weak self] in
      guard let self else { return }

      do {
        let composition = AVMutableComposition()

        guard
          let compositionTrack =
            composition.addMutableTrack(
              withMediaType: .audio,
              preferredTrackID:
                kCMPersistentTrackID_Invalid
            )
        else {
          throw self.makeNSError(
            code: "ERR_COMPOSITION_TRACK",
            message: "Could not create the lecture audio composition."
          )
        }

        var cursor = CMTime.zero
        var insertedSegments = 0
        var expectedDurationSeconds = 0.0

        guard !segmentURLs.isEmpty else {
          throw self.makeNSError(
            code: "ERR_EMPTY_COMPOSITION",
            message: "No lecture segments were supplied for assembly."
          )
        }

        for (offset, url) in segmentURLs.enumerated() {
          let expectedIndex = offset + 1

          guard
            self.segmentIndex(
              from: url
            ) == expectedIndex
          else {
            throw self.makeNSError(
              code: "ERR_SEGMENT_SEQUENCE",
              message: "Lecture checkpoint sequence is incomplete or out of order at expected segment \(expectedIndex). Assembly was aborted and all source segments were preserved."
            )
          }

          let asset = AVURLAsset(
            url: url
          )

          guard
            let assetTrack =
              asset.tracks(
                withMediaType: .audio
              ).first
          else {
            throw self.makeNSError(
              code: "ERR_SEGMENT_AUDIO_TRACK",
              message: "Lecture segment \(expectedIndex) has no readable audio track. Assembly was aborted and all source segments were preserved."
            )
          }

          let duration = asset.duration

          guard
            duration.isValid,
            duration.seconds.isFinite,
            duration.seconds >= 0.1
          else {
            throw self.makeNSError(
              code: "ERR_SEGMENT_DURATION",
              message: "Lecture segment \(expectedIndex) has an invalid duration. Assembly was aborted and all source segments were preserved."
            )
          }

          try compositionTrack.insertTimeRange(
            CMTimeRange(
              start: .zero,
              duration: duration
            ),
            of: assetTrack,
            at: cursor
          )

          cursor = CMTimeAdd(
            cursor,
            duration
          )

          expectedDurationSeconds += duration.seconds
          insertedSegments += 1
        }

        guard insertedSegments == segmentURLs.count else {
          throw self.makeNSError(
            code: "ERR_INCOMPLETE_ASSEMBLY",
            message: "Lecture assembly coverage was incomplete (expected \(segmentURLs.count), inserted \(insertedSegments)). All source segments were preserved."
          )
        }

        let temporaryURL =
          destinationURL
            .deletingLastPathComponent()
            .appendingPathComponent(
              "audio-merge-\(UUID().uuidString).m4a"
            )

        self.removeFileIfPresent(
          temporaryURL
        )

        // Always re-encode the assembled lecture to one normalized M4A.
        // After an AVAudioSession interruption (for example an accepted
        // phone call), iOS may resume the microphone with a different
        // hardware sample rate / channel configuration. Passthrough can
        // then fail because it tries to preserve the source formats.
        // AppleM4A decodes the segments and encodes one consistent output.
        guard
          let exporter = AVAssetExportSession(
            asset: composition,
            presetName: AVAssetExportPresetAppleM4A
          )
        else {
          throw self.makeNSError(
            code: "ERR_EXPORT_SESSION",
            message: "Could not create an iOS M4A export session."
          )
        }

        exporter.outputURL = temporaryURL
        exporter.outputFileType = .m4a
        exporter.shouldOptimizeForNetworkUse = false

        exporter.exportAsynchronously {
          switch exporter.status {
          case .completed:
            let temporaryValidation =
              self.validateAudioFileWithRetry(
                temporaryURL,
                attempts: 8,
                delaySeconds: 0.10
              )

            guard
              (temporaryValidation["valid"] as? Bool) == true,
              (temporaryValidation["playable"] as? Bool) == true
            else {
              self.removeFileIfPresent(
                temporaryURL
              )

              completion(
                .failure(
                  self.makeNSError(
                    code: "ERR_INVALID_MERGE",
                    message: "The merged temporary M4A is not playable. All source segments were preserved."
                  )
                )
              )
              return
            }

            guard
              let assembledDurationMillis =
                temporaryValidation["durationMillis"] as? Int
            else {
              self.removeFileIfPresent(
                temporaryURL
              )

              completion(
                .failure(
                  self.makeNSError(
                    code: "ERR_MERGE_DURATION_MISSING",
                    message: "The assembled lecture has no measurable duration. All source segments were preserved."
                  )
                )
              )
              return
            }

            let expectedDurationMillis =
              Int((expectedDurationSeconds * 1000.0).rounded())

            // AAC/M4A export can introduce a small encoder-boundary
            // difference, but it must never silently lose meaningful
            // portions of the committed recording.
            let durationToleranceMillis = 1500

            guard
              abs(assembledDurationMillis - expectedDurationMillis)
                <= durationToleranceMillis
            else {
              self.removeFileIfPresent(
                temporaryURL
              )

              completion(
                .failure(
                  self.makeNSError(
                    code: "ERR_INCOMPLETE_ASSEMBLY_DURATION",
                    message: "Lecture assembly duration does not cover the committed segments (expected \(expectedDurationMillis) ms, assembled \(assembledDurationMillis) ms). All source segments were preserved."
                  )
                )
              )
              return
            }

            let existingValidation =
              self.validateAudioFileWithRetry(
                destinationURL,
                attempts: 8,
                delaySeconds: 0.10
              )

            if
              protectExistingRecording,
              (existingValidation["valid"] as? Bool) == true,
              (existingValidation["playable"] as? Bool) == true,
              let existingDurationMillis =
                existingValidation["durationMillis"] as? Int,
              let recoveredDurationMillis =
                temporaryValidation["durationMillis"] as? Int,
              recoveredDurationMillis + 1000 < existingDurationMillis
            {
              self.removeFileIfPresent(
                temporaryURL
              )

              completion(
                .failure(
                  self.makeNSError(
                    code: "ERR_RECOVERY_CANDIDATE_SHORTER",
                    message: "Recovered audio is shorter than the existing playable recording; the existing recording and recovery segments were preserved."
                  )
                )
              )
              return
            }

            do {
              let fileManager = FileManager.default
              let destinationExisted =
                fileManager.fileExists(
                  atPath: destinationURL.path
                )

              let rollbackURL =
                destinationURL
                  .deletingLastPathComponent()
                  .appendingPathComponent(
                    "audio-rollback-\(UUID().uuidString).m4a"
                  )

              if destinationExisted {
                try fileManager.moveItem(
                  at: destinationURL,
                  to: rollbackURL
                )
              }

              do {
                try fileManager.moveItem(
                  at: temporaryURL,
                  to: destinationURL
                )

                let finalValidation =
                  self.validateAudioFileWithRetry(
                    destinationURL,
                    attempts: 8,
                    delaySeconds: 0.10
                  )

                guard
                  (finalValidation["valid"] as? Bool) == true,
                  (finalValidation["playable"] as? Bool) == true
                else {
                  throw self.makeNSError(
                    code: "ERR_INVALID_FINAL_M4A",
                    message: "The final merged M4A is not playable."
                  )
                }

                if destinationExisted {
                  self.removeFileIfPresent(
                    rollbackURL
                  )
                }

                completion(
                  .success(
                    finalValidation
                  )
                )

              } catch {
                self.removeFileIfPresent(
                  destinationURL
                )

                if
                  destinationExisted,
                  fileManager.fileExists(
                    atPath: rollbackURL.path
                  )
                {
                  try? fileManager.moveItem(
                    at: rollbackURL,
                    to: destinationURL
                  )
                }

                throw error
              }

            } catch {
              completion(
                .failure(error)
              )
            }

          case .failed, .cancelled:
            self.removeFileIfPresent(
              temporaryURL
            )

            completion(
              .failure(
                exporter.error ??
                self.makeNSError(
                  code: "ERR_EXPORT_FAILED",
                  message: "iOS could not export the merged lecture M4A."
                )
              )
            )

          default:
            self.removeFileIfPresent(
              temporaryURL
            )

            completion(
              .failure(
                self.makeNSError(
                  code: "ERR_EXPORT_STATE",
                  message: "The iOS audio exporter finished in an unexpected state."
                )
              )
            )
          }
        }

      } catch {
        completion(
          .failure(error)
        )
      }
    }
  }

  private func validateAudioFileWithRetry(
    _ url: URL,
    attempts: Int,
    delaySeconds: TimeInterval
  ) -> [String: Any] {
    let totalAttempts = max(1, attempts)
    var lastValidation = validateAudioFile(url)

    if
      (lastValidation["valid"] as? Bool) == true,
      (lastValidation["playable"] as? Bool) == true
    {
      return lastValidation
    }

    guard totalAttempts > 1 else {
      return lastValidation
    }

    for _ in 1..<totalAttempts {
      if delaySeconds > 0 {
        Thread.sleep(forTimeInterval: delaySeconds)
      }

      lastValidation = validateAudioFile(url)

      if
        (lastValidation["valid"] as? Bool) == true,
        (lastValidation["playable"] as? Bool) == true
      {
        return lastValidation
      }
    }

    return lastValidation
  }

  private func promoteRecoverablePartialSegments(
    in directoryURL: URL,
    destinationURL explicitDestinationURL: URL? = nil
  ) {
    guard
      let entries = try? FileManager.default.contentsOfDirectory(
        at: directoryURL,
        includingPropertiesForKeys: nil,
        options: [.skipsHiddenFiles]
      )
    else {
      return
    }

    let partials = entries
      .filter {
        $0.lastPathComponent.hasSuffix(
          ".part.m4a"
        )
      }
      .sorted {
        $0.lastPathComponent <
          $1.lastPathComponent
      }

    for partURL in partials {
      let validation =
        validateAudioFileWithRetry(
          partURL,
          attempts: 12,
          delaySeconds: 0.15
        )

      guard
        (validation["valid"] as? Bool) == true,
        (validation["playable"] as? Bool) == true
      else {
        continue
      }

      let finalURL =
        finalizedSegmentURL(
          forPartURL: partURL
        )

      do {
        guard
          !FileManager.default.fileExists(
            atPath: finalURL.path
          )
        else {
          throw makeNSError(
            code: "ERR_SEGMENT_DESTINATION_EXISTS",
            message: "A finalized lecture checkpoint already exists for the promoted partial segment."
          )
        }

        try FileManager.default.moveItem(
          at: partURL,
          to: finalURL
        )

        if let destinationURL =
          explicitDestinationURL ??
          currentDestinationURL
        {
          try commitSegmentToRecordingManifestDurably(
            segmentURL: finalURL,
            validation: validation,
            destinationURL: destinationURL
          )
        }
      } catch {
        reportWriterFailure(
          "Could not durably promote a recoverable lecture checkpoint: \(error.localizedDescription)"
        )
      }
    }
  }

  private func unresolvedPartialSegmentURLs(
    in directoryURL: URL?
  ) -> [URL] {
    guard
      let directoryURL,
      let entries = try? FileManager.default.contentsOfDirectory(
        at: directoryURL,
        includingPropertiesForKeys: nil,
        options: [.skipsHiddenFiles]
      )
    else {
      return []
    }

    return entries
      .filter {
        let name = $0.lastPathComponent

        return
          name.hasPrefix("segment-") &&
          name.hasSuffix(".part.m4a")
      }
      .sorted {
        $0.lastPathComponent <
          $1.lastPathComponent
      }
  }

  private func completedSegmentURLs(
    in directoryURL: URL?
  ) -> [URL] {
    guard
      let directoryURL,
      let entries = try? FileManager.default.contentsOfDirectory(
        at: directoryURL,
        includingPropertiesForKeys: nil,
        options: [.skipsHiddenFiles]
      )
    else {
      return []
    }

    return entries
      .filter {
        let name = $0.lastPathComponent

        return
          name.hasPrefix("segment-") &&
          name.hasSuffix(".m4a") &&
          !name.hasSuffix(".part.m4a")
      }
      .sorted {
        $0.lastPathComponent <
          $1.lastPathComponent
      }
  }

  // MARK: - State / result helpers

  private struct StatusSnapshot {
    let durationMillis: Int
    let bytes: Int
    let levelDb: Double
    let peakDb: Double
    let finalizedSegmentCount: Int
    let hasCurrentPart: Bool
    let writerFailureMessage: String?
    let hasSuccessfulWrite: Bool
  }

  private func statusSnapshot() -> StatusSnapshot {
    withStateLock {
      let partBytes =
        currentPartURLSnapshot.map(
          fileSize
        ) ?? 0

      return StatusSnapshot(
        durationMillis:
          Int(
            (
              capturedDurationSeconds *
              1000.0
            ).rounded()
          ),
        bytes:
          finalizedBytes +
          partBytes,
        levelDb:
          latestLevelDb,
        peakDb:
          latestPeakDb,
        finalizedSegmentCount:
          finalizedSegmentCount,
        hasCurrentPart:
          currentPartURLSnapshot != nil,
        writerFailureMessage:
          writerFailureMessage,
        hasSuccessfulWrite:
          hasSuccessfulWrite
      )
    }
  }

  private func makeStatusResult(
    ok: Bool
  ) -> [String: Any] {
    let snapshot = statusSnapshot()

    let activelyRecording =
      currentDestinationURL != nil &&
      !isStopping &&
      !isPausedForInterruption &&
      audioEngine?.isRunning == true &&
      snapshot.writerFailureMessage == nil &&
      snapshot.hasSuccessfulWrite

    return [
      "ok": ok,
      "isRecording": activelyRecording,
      "durationMillis": snapshot.durationMillis,
      "uri":
        currentDestinationURL?.absoluteString ??
        NSNull(),
      "bytes": snapshot.bytes,
      "levelDb": snapshot.levelDb,
      "peakDb": snapshot.peakDb,
      "isPausedForInterruption":
        isPausedForInterruption,
      "engineRunning":
        audioEngine?.isRunning == true,
      "hasSuccessfulWrite":
        snapshot.hasSuccessfulWrite,
      "writerFailureMessage":
        snapshot.writerFailureMessage ??
        NSNull(),
      "hasCurrentPart":
        snapshot.hasCurrentPart,
      "segmentCount":
        snapshot.finalizedSegmentCount +
        (snapshot.hasCurrentPart ? 1 : 0)
    ]
  }

  private func startAcceptingNewBuffers() {
    withStateLock {
      acceptingBuffers = true
    }
  }

  private func stopAcceptingNewBuffers() {
    withStateLock {
      acceptingBuffers = false
    }
  }

  private func isAcceptingNewBuffers() -> Bool {
    withStateLock {
      acceptingBuffers &&
      writerFailureMessage == nil
    }
  }

  private func resetLiveState() {
    withStateLock {
      capturedDurationSeconds = 0
      latestLevelDb = -160
      latestPeakDb = -160
      finalizedBytes = 0
      finalizedSegmentCount = 0
      currentPartURLSnapshot = nil
      writerFailureMessage = nil
      acceptingBuffers = false
      hasSuccessfulWrite = false
    }
  }

  private func cleanupAfterSuccessfulStop() {
    stopAcceptingNewBuffers()
    stopCaptureEngine()
    deactivateAudioSession()

    currentDestinationURL = nil
    currentSegmentsDirectoryURL = nil
    isStopping = false
    isPausedForInterruption = false
    resumeToken = nil

    resetLiveState()
    resetWriterState()
  }

  private func cleanupAfterFailedStopPreservingSegments() {
    stopAcceptingNewBuffers()
    stopCaptureEngine()
    deactivateAudioSession()

    // Clear runtime ownership so JS can recover on the next launch,
    // but intentionally keep the finalized segment directory on disk.
    currentDestinationURL = nil
    currentSegmentsDirectoryURL = nil
    isStopping = false
    isPausedForInterruption = false
    resumeToken = nil

    resetLiveState()
    resetWriterState()
  }

  @discardableResult
  private func withStateLock<T>(
    _ body: () -> T
  ) -> T {
    stateLock.lock()
    defer {
      stateLock.unlock()
    }
    return body()
  }

  // MARK: - Recording manifest helpers

  private func recordingManifestURL(
    for destinationURL: URL
  ) -> URL {
    destinationURL
      .deletingLastPathComponent()
      .appendingPathComponent(
        "recording-manifest.json"
      )
  }

  private func isoTimestamp() -> String {
    ISO8601DateFormatter()
      .string(
        from: Date()
      )
  }

  private func createInitialRecordingManifest(
    for destinationURL: URL
  ) throws {
    let now = isoTimestamp()

    let manifest = RecordingManifest(
      version: 1,
      recordingId:
        destinationURL
          .deletingLastPathComponent()
          .lastPathComponent,
      createdAt: now,
      updatedAt: now,
      state: "recording",
      segments: [],
      committedDurationMillis: 0,
      activeSegmentIndex: 1,
      assembly: RecordingManifestAssembly(
        state: "not_started",
        generation: 0,
        output: nil
      )
    )

    try writeRecordingManifest(
      manifest,
      for: destinationURL
    )
  }

  private func loadRecordingManifest(
    for destinationURL: URL
  ) -> RecordingManifest? {
    let url =
      recordingManifestURL(
        for: destinationURL
      )

    guard
      let data = try? Data(
        contentsOf: url
      )
    else {
      return nil
    }

    return try? JSONDecoder()
      .decode(
        RecordingManifest.self,
        from: data
      )
  }

  private func writeRecordingManifest(
    _ manifest: RecordingManifest,
    for destinationURL: URL
  ) throws {
    var manifest = manifest
    manifest.updatedAt = isoTimestamp()

    let url =
      recordingManifestURL(
        for: destinationURL
      )

    let data =
      try JSONEncoder()
        .encode(
          manifest
        )

    // Data.write(.atomic) writes through a temporary file and replaces
    // the destination as one filesystem operation. A crash therefore
    // leaves either the previous complete manifest or the new one.
    try data.write(
      to: url,
      options: [.atomic]
    )
  }

  private func updateRecordingManifestDurably(
    for destinationURL: URL,
    mutate: (inout RecordingManifest) -> Void
  ) throws {
    guard
      var manifest =
        loadRecordingManifest(
          for: destinationURL
        )
    else {
      throw makeNSError(
        code: "ERR_MANIFEST_LOAD",
        message: "The recording manifest could not be loaded for a durable state transition."
      )
    }

    mutate(
      &manifest
    )

    try writeRecordingManifest(
      manifest,
      for: destinationURL
    )

    // Do not acknowledge a durable transition merely because Data.write
    // returned. Read the manifest back and require it to remain decodable.
    guard
      loadRecordingManifest(
        for: destinationURL
      ) != nil
    else {
      throw makeNSError(
        code: "ERR_MANIFEST_VERIFY",
        message: "The recording manifest could not be verified after its durable update."
      )
    }
  }

  private func updateRecordingManifest(
    for destinationURL: URL,
    mutate: (inout RecordingManifest) -> Void
  ) {
    guard
      var manifest =
        loadRecordingManifest(
          for: destinationURL
        )
    else {
      return
    }

    mutate(
      &manifest
    )

    do {
      try writeRecordingManifest(
        manifest,
        for: destinationURL
      )
    } catch {
      // The committed segment files remain the recovery authority when
      // a manifest write itself is interrupted. Reconciliation repairs
      // the inventory on Stop or next-launch recovery.
    }
  }

  private func segmentIndex(
    from url: URL
  ) -> Int? {
    let name =
      url.lastPathComponent

    guard
      name.hasPrefix("segment-"),
      name.hasSuffix(".m4a"),
      !name.hasSuffix(".part.m4a")
    else {
      return nil
    }

    let raw =
      name
        .replacingOccurrences(
          of: "segment-",
          with: ""
        )
        .replacingOccurrences(
          of: ".m4a",
          with: ""
        )

    return Int(raw)
  }

  private func commitSegmentToRecordingManifestDurably(
    segmentURL: URL,
    validation: [String: Any],
    destinationURL: URL
  ) throws {
    guard
      let index =
        segmentIndex(
          from: segmentURL
        ),
      let durationMillis =
        validation["durationMillis"] as? Int,
      durationMillis > 0
    else {
      throw makeNSError(
        code: "ERR_SEGMENT_MANIFEST_INPUT",
        message: "A finalized lecture checkpoint could not be represented in the durable manifest."
      )
    }

    let bytes =
      fileSize(
        segmentURL
      )

    guard bytes > 0 else {
      throw makeNSError(
        code: "ERR_SEGMENT_BYTES",
        message: "A finalized lecture checkpoint has no readable payload."
      )
    }

    guard
      var manifest =
        loadRecordingManifest(
          for: destinationURL
        )
    else {
      throw makeNSError(
        code: "ERR_MANIFEST_LOAD",
        message: "The recording manifest could not be loaded while committing a lecture checkpoint."
      )
    }

    if let existing =
      manifest.segments.first(
        where: {
          $0.index == index
        }
      )
    {
      guard
        existing.file == segmentURL.lastPathComponent,
        existing.durationMillis == durationMillis,
        existing.bytes == bytes,
        existing.status == "committed"
      else {
        throw makeNSError(
          code: "ERR_SEGMENT_MANIFEST_CONFLICT",
          message: "The durable manifest already contains conflicting data for lecture checkpoint \(index)."
        )
      }

      return
    }

    let expectedIndex =
      (manifest.segments.last?.index ?? 0) + 1

    guard index == expectedIndex else {
      throw makeNSError(
        code: "ERR_SEGMENT_SEQUENCE",
        message: "Lecture checkpoint \(index) cannot be committed because checkpoint \(expectedIndex) was expected."
      )
    }

    let committed =
      RecordingManifestSegment(
        index: index,
        file: segmentURL.lastPathComponent,
        durationMillis: durationMillis,
        bytes: bytes,
        status: "committed"
      )

    manifest.segments.append(
      committed
    )

    manifest.committedDurationMillis +=
      durationMillis

    manifest.activeSegmentIndex =
      index + 1

    try writeRecordingManifest(
      manifest,
      for: destinationURL
    )

    guard
      let verified =
        loadRecordingManifest(
          for: destinationURL
        ),
      verified.segments.count ==
        manifest.segments.count,
      verified.committedDurationMillis ==
        manifest.committedDurationMillis,
      verified.activeSegmentIndex ==
        manifest.activeSegmentIndex,
      let verifiedSegment =
        verified.segments.last,
      verifiedSegment.index ==
        committed.index,
      verifiedSegment.file ==
        committed.file,
      verifiedSegment.durationMillis ==
        committed.durationMillis,
      verifiedSegment.bytes ==
        committed.bytes,
      verifiedSegment.status ==
        "committed"
    else {
      throw makeNSError(
        code: "ERR_SEGMENT_MANIFEST_VERIFY",
        message: "The finalized lecture checkpoint could not be verified in the durable manifest."
      )
    }
  }

  private func verifyRecordingManifestInventoryForStop(
    segmentURLs: [URL],
    destinationURL: URL
  ) throws -> RecordingManifest {
    guard
      let manifest =
        loadRecordingManifest(
          for: destinationURL
        )
    else {
      throw makeNSError(
        code: "ERR_MANIFEST_LOAD",
        message: "The recording manifest could not be loaded while saving the lecture."
      )
    }

    guard
      !segmentURLs.isEmpty,
      manifest.segments.count ==
        segmentURLs.count
    else {
      throw makeNSError(
        code: "ERR_MANIFEST_INVENTORY",
        message: "The durable manifest does not cover every finalized lecture checkpoint."
      )
    }

    for (offset, url) in
      segmentURLs.enumerated()
    {
      let expectedIndex =
        offset + 1

      guard
        let actualIndex =
          segmentIndex(
            from: url
          ),
        actualIndex ==
          expectedIndex
      else {
        throw makeNSError(
          code: "ERR_SEGMENT_SEQUENCE",
          message: "Finalized lecture checkpoint sequence is incomplete or out of order at expected segment \(expectedIndex)."
        )
      }

      let manifestSegment =
        manifest.segments[offset]

      guard
        manifestSegment.index ==
          expectedIndex,
        manifestSegment.file ==
          url.lastPathComponent,
        manifestSegment.status ==
          "committed",
        manifestSegment.durationMillis >
          0,
        manifestSegment.bytes >
          0
      else {
        throw makeNSError(
          code: "ERR_MANIFEST_INVENTORY",
          message: "The durable manifest does not exactly match finalized lecture checkpoint \(expectedIndex)."
        )
      }
    }

    guard
      manifest.committedDurationMillis >
        0,
      manifest.activeSegmentIndex ==
        manifest.segments.count + 1
    else {
      throw makeNSError(
        code: "ERR_MANIFEST_INVENTORY",
        message: "The durable lecture checkpoint inventory is internally inconsistent."
      )
    }

    return manifest
  }

  private func reconcileRecordingManifestDurably(
    for destinationURL: URL
  ) throws -> RecordingManifest {
    let directoryURL =
      segmentsDirectoryURL(
        for: destinationURL
      )

    let segmentURLs =
      completedSegmentURLs(
        in: directoryURL
      )

    guard !segmentURLs.isEmpty else {
      throw makeNSError(
        code: "ERR_NO_RECOVERABLE_SEGMENTS",
        message: "No finalized lecture checkpoints were available for durable reconciliation."
      )
    }

    var manifest =
      loadRecordingManifest(
        for: destinationURL
      )

    if manifest == nil {
      let now = isoTimestamp()

      manifest = RecordingManifest(
        version: 1,
        recordingId:
          destinationURL
            .deletingLastPathComponent()
            .lastPathComponent,
        createdAt: now,
        updatedAt: now,
        state: "interrupted",
        segments: [],
        committedDurationMillis: 0,
        activeSegmentIndex: 1,
        assembly: RecordingManifestAssembly(
          state: "not_started",
          generation: 0,
          output: nil
        )
      )
    }

    guard var repaired = manifest else {
      throw makeNSError(
        code: "ERR_MANIFEST_RECONCILE",
        message: "The recording manifest could not be reconstructed."
      )
    }

    var rebuiltSegments: [RecordingManifestSegment] = []

    for (offset, url) in segmentURLs.enumerated() {
      let expectedIndex =
        offset + 1

      guard
        let index =
          segmentIndex(
            from: url
          ),
        index == expectedIndex
      else {
        throw makeNSError(
          code: "ERR_SEGMENT_SEQUENCE",
          message: "Durable checkpoint sequence is incomplete or out of order at expected segment \(expectedIndex). Source checkpoints were preserved."
        )
      }

      let validation =
        validateAudioFileWithRetry(
          url,
          attempts: 3,
          delaySeconds: 0.05
        )

      guard
        (validation["valid"] as? Bool) == true,
        (validation["playable"] as? Bool) == true,
        let durationMillis =
          validation["durationMillis"] as? Int,
        durationMillis > 0
      else {
        throw makeNSError(
          code: "ERR_SEGMENT_VALIDATION",
          message: "Durable checkpoint \(expectedIndex) could not be validated. Source checkpoints were preserved."
        )
      }

      let bytes =
        fileSize(
          url
        )

      guard bytes > 0 else {
        throw makeNSError(
          code: "ERR_SEGMENT_BYTES",
          message: "Durable checkpoint \(expectedIndex) has no readable payload. Source checkpoints were preserved."
        )
      }

      rebuiltSegments.append(
        RecordingManifestSegment(
          index: index,
          file: url.lastPathComponent,
          durationMillis: durationMillis,
          bytes: bytes,
          status: "committed"
        )
      )
    }

    repaired.segments =
      rebuiltSegments

    repaired.committedDurationMillis =
      rebuiltSegments.reduce(
        0
      ) {
        $0 + $1.durationMillis
      }

    repaired.activeSegmentIndex =
      rebuiltSegments.count + 1

    try writeRecordingManifest(
      repaired,
      for: destinationURL
    )

    guard
      let verified =
        loadRecordingManifest(
          for: destinationURL
        )
    else {
      throw makeNSError(
        code: "ERR_MANIFEST_VERIFY",
        message: "The reconciled recording manifest could not be read back."
      )
    }

    guard
      verified.segments.count ==
        rebuiltSegments.count,
      verified.committedDurationMillis ==
        repaired.committedDurationMillis,
      verified.activeSegmentIndex ==
        repaired.activeSegmentIndex
    else {
      throw makeNSError(
        code: "ERR_MANIFEST_VERIFY",
        message: "The reconciled recording manifest did not match the validated checkpoint inventory."
      )
    }

    for (offset, segment) in
      verified.segments.enumerated()
    {
      let expected =
        rebuiltSegments[offset]

      guard
        segment.index == expected.index,
        segment.file == expected.file,
        segment.durationMillis ==
          expected.durationMillis,
        segment.bytes == expected.bytes,
        segment.status == "committed"
      else {
        throw makeNSError(
          code: "ERR_MANIFEST_VERIFY",
          message: "The reconciled recording manifest checkpoint inventory failed read-back verification."
        )
      }
    }

    return verified
  }

  private func reconcileRecordingManifest(
    for destinationURL: URL
  ) {
    let directoryURL =
      segmentsDirectoryURL(
        for: destinationURL
      )

    let segmentURLs =
      completedSegmentURLs(
        in: directoryURL
      )

    var manifest =
      loadRecordingManifest(
        for: destinationURL
      )

    if manifest == nil {
      let now = isoTimestamp()

      manifest = RecordingManifest(
        version: 1,
        recordingId:
          destinationURL
            .deletingLastPathComponent()
            .lastPathComponent,
        createdAt: now,
        updatedAt: now,
        state: "interrupted",
        segments: [],
        committedDurationMillis: 0,
        activeSegmentIndex: 1,
        assembly: RecordingManifestAssembly(
          state: "not_started",
          generation: 0,
          output: nil
        )
      )
    }

    guard var repaired = manifest else {
      return
    }

    var rebuiltSegments: [RecordingManifestSegment] = []

    for url in segmentURLs {
      guard
        let index =
          segmentIndex(
            from: url
          )
      else {
        continue
      }

      let validation =
        validateAudioFileWithRetry(
          url,
          attempts: 3,
          delaySeconds: 0.05
        )

      guard
        (validation["valid"] as? Bool) == true,
        (validation["playable"] as? Bool) == true,
        let durationMillis =
          validation["durationMillis"] as? Int,
        durationMillis > 0
      else {
        // Never delete or hide an unexpected checkpoint. It remains on
        // disk for diagnostics and future recovery attempts.
        continue
      }

      rebuiltSegments.append(
        RecordingManifestSegment(
          index: index,
          file: url.lastPathComponent,
          durationMillis: durationMillis,
          bytes: fileSize(url),
          status: "committed"
        )
      )
    }

    rebuiltSegments.sort {
      $0.index < $1.index
    }

    repaired.segments =
      rebuiltSegments

    repaired.committedDurationMillis =
      rebuiltSegments.reduce(
        0
      ) {
        $0 + $1.durationMillis
      }

    repaired.activeSegmentIndex =
      (rebuiltSegments.last?.index ?? 0) + 1

    do {
      try writeRecordingManifest(
        repaired,
        for: destinationURL
      )
    } catch {
      // Source segments are intentionally preserved even if reconciliation
      // cannot persist the repaired manifest.
    }
  }

  // MARK: - File / validation helpers

  private func segmentsDirectoryURL(
    for destinationURL: URL
  ) -> URL {
    destinationURL
      .deletingLastPathComponent()
      .appendingPathComponent(
        ".audio-segments",
        isDirectory: true
      )
  }

  private func finalizedSegmentURL(
    forPartURL partURL: URL
  ) -> URL {
    let name =
      partURL.lastPathComponent
        .replacingOccurrences(
          of: ".part.m4a",
          with: ".m4a"
        )

    return partURL
      .deletingLastPathComponent()
      .appendingPathComponent(
        name
      )
  }

  private func fileSize(_ url: URL) -> Int {
    guard
      let attributes = try? FileManager.default.attributesOfItem(
        atPath: url.path
      ),
      let size = attributes[.size] as? NSNumber
    else {
      return 0
    }

    return size.intValue
  }

  private func removeFileIfPresent(_ url: URL) {
    if FileManager.default.fileExists(atPath: url.path) {
      try? FileManager.default.removeItem(
        at: url
      )
    }
  }

  private func removeDirectoryIfPresent(_ url: URL) {
    if FileManager.default.fileExists(atPath: url.path) {
      try? FileManager.default.removeItem(
        at: url
      )
    }
  }

  private func validateAudioFile(
    _ url: URL
  ) -> [String: Any] {
    guard FileManager.default.fileExists(atPath: url.path) else {
      return makeValidationResult(
        valid: false,
        playable: false,
        durationMillis: 0,
        uri: url.absoluteString,
        bytes: 0,
        code: "ERR_AUDIO_MISSING",
        message: "The recording file does not exist."
      )
    }

    let bytes = fileSize(url)

    guard bytes >= 4096 else {
      return makeValidationResult(
        valid: false,
        playable: false,
        durationMillis: 0,
        uri: url.absoluteString,
        bytes: bytes,
        code: "ERR_EMPTY_RECORDING",
        message: "The recording file is empty or incomplete."
      )
    }

    do {
      let player = try AVAudioPlayer(
        contentsOf: url
      )

      let durationMillis = Int(
        (
          player.duration *
          1000.0
        ).rounded()
      )

      guard durationMillis >= 500 else {
        return makeValidationResult(
          valid: false,
          playable: false,
          durationMillis: durationMillis,
          uri: url.absoluteString,
          bytes: bytes,
          code: "ERR_ZERO_DURATION",
          message: "The recording has no usable media duration."
        )
      }

      return makeValidationResult(
        valid: true,
        playable: true,
        durationMillis: durationMillis,
        uri: url.absoluteString,
        bytes: bytes,
        code: nil,
        message: nil
      )

    } catch {
      return makeValidationResult(
        valid: false,
        playable: false,
        durationMillis: 0,
        uri: url.absoluteString,
        bytes: bytes,
        code: "ERR_INVALID_RECORDING",
        message: "The M4A could not be opened: \(error.localizedDescription)"
      )
    }
  }

  private func makeValidationResult(
    valid: Bool,
    playable: Bool,
    durationMillis: Int,
    uri: String,
    bytes: Int,
    code: String?,
    message: String?
  ) -> [String: Any] {
    [
      "valid": valid,
      "playable": playable,
      "durationMillis": durationMillis,
      "uri": uri,
      "bytes": bytes,
      "code": code ?? NSNull(),
      "message": message ?? NSNull()
    ]
  }

  private func emitRecorderError(
    code: String,
    message: String,
    url: URL?,
    bytes: Int,
    durationMillis: Int
  ) {
    sendEvent(
      "onRecorderError",
      [
        "code": code,
        "message": message,
        "uri":
          url?.absoluteString ??
          NSNull(),
        "bytes": bytes,
        "durationMillis":
          durationMillis
      ]
    )
  }

  private func makeException(
    code: String,
    message: String,
    file: String = #fileID,
    line: UInt = #line,
    function: String = #function
  ) -> Exception {
    LectureRecorderException(
      code: code,
      message: message,
      file: file,
      line: line,
      function: function
    )
  }

  private func makeNSError(
    code: String,
    message: String
  ) -> NSError {
    NSError(
      domain: "LectureRecorder",
      code: abs(code.hashValue),
      userInfo: [
        NSLocalizedDescriptionKey:
          message
      ]
    )
  }
}
