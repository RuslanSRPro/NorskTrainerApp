import ExpoModulesCore
@preconcurrency import AVFoundation

private final class LectureRecorderDelegate: NSObject, AVAudioRecorderDelegate {
  weak var owner: LectureRecorderModule?

  init(owner: LectureRecorderModule) {
    self.owner = owner
    super.init()
  }

  func audioRecorderDidFinishRecording(
    _ recorder: AVAudioRecorder,
    successfully flag: Bool
  ) {
    owner?.handleRecorderDidFinish(
      recorder,
      successfully: flag
    )
  }

  func audioRecorderEncodeErrorDidOccur(
    _ recorder: AVAudioRecorder,
    error: Error?
  ) {
    owner?.handleRecorderEncodeError(
      recorder,
      error: error
    )
  }
}

public final class LectureRecorderModule: Module {
  private var audioRecorder: AVAudioRecorder?
  private var currentURL: URL?

  private var pendingStopPromise: Promise?
  private var pendingDurationMillis = 0
  private var isCancelling = false

  private lazy var recorderDelegate =
    LectureRecorderDelegate(owner: self)

  public func definition() -> ModuleDefinition {
    Name("LectureRecorder")

    AsyncFunction("start") { (destinationUri: String) -> [String: Any] in
      if self.pendingStopPromise != nil {
        throw self.makeException(
          code: "ERR_STOP_PENDING",
          message: "The previous lecture recording is still finishing."
        )
      }

      if self.audioRecorder?.isRecording == true {
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

      if FileManager.default.fileExists(atPath: destinationURL.path) {
        try FileManager.default.removeItem(at: destinationURL)
      }

      let session = AVAudioSession.sharedInstance()

      do {
        try session.setCategory(
          .playAndRecord,
          mode: .default,
          options: [
            .defaultToSpeaker,
            .allowBluetoothHFP
          ]
        )

        try session.setActive(true)
      } catch {
        self.removeFileIfPresent(destinationURL)

        throw self.makeException(
          code: "ERR_AUDIO_SESSION",
          message: "Could not activate the iOS recording audio session: \(error.localizedDescription)"
        )
      }

      let settings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 44_100.0,
        AVNumberOfChannelsKey: 1,
        AVEncoderBitRateKey: 128_000,
        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
      ]

      do {
        let recorder = try AVAudioRecorder(
          url: destinationURL,
          settings: settings
        )

        recorder.delegate = self.recorderDelegate
        recorder.isMeteringEnabled = true

        guard recorder.prepareToRecord() else {
          recorder.delegate = nil
          self.removeFileIfPresent(destinationURL)
          self.deactivateAudioSession()

          throw self.makeException(
            code: "ERR_PREPARE_RECORDING",
            message: "AVAudioRecorder could not prepare the lecture recording."
          )
        }

        guard recorder.record() else {
          recorder.delegate = nil
          recorder.stop()
          self.removeFileIfPresent(destinationURL)
          self.deactivateAudioSession()

          throw self.makeException(
            code: "ERR_START_RECORDING",
            message: "AVAudioRecorder could not start the lecture recording."
          )
        }

        self.audioRecorder = recorder
        self.currentURL = destinationURL
        self.pendingDurationMillis = 0
        self.isCancelling = false

        recorder.updateMeters()

        return [
          "ok": true,
          "isRecording": true,
          "durationMillis": 0,
          "uri": destinationURL.absoluteString,
          "bytes": self.fileSize(destinationURL),
          "levelDb": Double(
            recorder.averagePower(
              forChannel: 0
            )
          ),
          "peakDb": Double(
            recorder.peakPower(
              forChannel: 0
            )
          )
        ]
      } catch let exception as Exception {
        throw exception
      } catch {
        self.removeFileIfPresent(destinationURL)
        self.deactivateAudioSession()

        throw self.makeException(
          code: "ERR_CREATE_RECORDER",
          message: "Could not create the lecture recorder: \(error.localizedDescription)"
        )
      }
    }
    .runOnQueue(.main)

    AsyncFunction("stop") { (promise: Promise) in
      guard let recorder = self.audioRecorder else {
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

      self.pendingDurationMillis = Int(
        (recorder.currentTime * 1000.0).rounded()
      )

      self.pendingStopPromise = promise
      self.isCancelling = false

      // Resolve/reject only from AVAudioRecorderDelegate.
      recorder.stop()
    }
    .runOnQueue(.main)

    AsyncFunction("cancel") { () -> [String: Any] in
      guard self.pendingStopPromise == nil else {
        throw self.makeException(
          code: "ERR_STOP_PENDING",
          message: "Cannot cancel while the lecture recording is already finishing."
        )
      }

      self.isCancelling = true

      let url = self.currentURL ?? self.audioRecorder?.url

      if let recorder = self.audioRecorder {
        // No finish callback is needed for cancellation.
        recorder.delegate = nil
        recorder.stop()
      }

      self.cleanupRecorder()

      if let url {
        self.removeFileIfPresent(url)
      }

      self.isCancelling = false

      return [
        "ok": true
      ]
    }
    .runOnQueue(.main)

    Function("getStatus") { () -> [String: Any] in
      guard let recorder = self.audioRecorder else {
        return [
          "isRecording": false,
          "durationMillis": 0,
          "uri": NSNull(),
          "bytes": 0,
          "levelDb": -160.0,
          "peakDb": -160.0
        ]
      }

      let url = recorder.url

      /*
       * Refresh metering immediately before reading
       * average/peak power. AVAudioRecorder reports
       * dBFS from roughly -160 (silence) to 0 (full scale).
       */
      recorder.updateMeters()

      let levelDb =
        Double(
          recorder.averagePower(
            forChannel: 0
          )
        )

      let peakDb =
        Double(
          recorder.peakPower(
            forChannel: 0
          )
        )

      return [
        "isRecording": recorder.isRecording,
        "durationMillis": Int(
          (recorder.currentTime * 1000.0).rounded()
        ),
        "uri": url.absoluteString,
        "bytes": self.fileSize(url),
        "levelDb": levelDb,
        "peakDb": peakDb
      ]
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
  }

  // MARK: - Delegate handlers

  fileprivate func handleRecorderDidFinish(
    _ recorder: AVAudioRecorder,
    successfully flag: Bool
  ) {
    let promise = pendingStopPromise
    pendingStopPromise = nil

    let url = recorder.url
    pendingDurationMillis = 0

    if isCancelling {
      isCancelling = false
      cleanupRecorder()
      return
    }

    guard flag else {
      removeFileIfPresent(url)
      cleanupRecorder()

      promise?.reject(
        makeException(
          code: "ERR_RECORDING_FINISH",
          message: "iOS could not finish the lecture recording successfully."
        )
      )
      return
    }

    let bytes = fileSize(url)

    guard bytes >= 4096 else {
      removeFileIfPresent(url)
      cleanupRecorder()

      promise?.reject(
        makeException(
          code: "ERR_EMPTY_RECORDING",
          message: "The finished lecture recording is empty or incomplete (\(bytes) bytes)."
        )
      )
      return
    }

    let actualDurationMillis: Int

    do {
      let player = try AVAudioPlayer(contentsOf: url)
      actualDurationMillis = Int(
        (player.duration * 1000.0).rounded()
      )
    } catch {
      removeFileIfPresent(url)
      cleanupRecorder()

      promise?.reject(
        makeException(
          code: "ERR_INVALID_RECORDING",
          message: "The finished M4A could not be opened: \(error.localizedDescription)"
        )
      )
      return
    }

    guard actualDurationMillis >= 500 else {
      removeFileIfPresent(url)
      cleanupRecorder()

      promise?.reject(
        makeException(
          code: "ERR_ZERO_DURATION",
          message: "The finished M4A has no usable media duration (\(actualDurationMillis) ms)."
        )
      )
      return
    }

    cleanupRecorder()

    promise?.resolve([
      "ok": true,
      "isRecording": false,
      "durationMillis": actualDurationMillis,
      "uri": url.absoluteString,
      "bytes": bytes
    ])
  }

  fileprivate func handleRecorderEncodeError(
    _ recorder: AVAudioRecorder,
    error: Error?
  ) {
    let promise = pendingStopPromise
    pendingStopPromise = nil
    pendingDurationMillis = 0

    let url = recorder.url

    removeFileIfPresent(url)
    cleanupRecorder()

    promise?.reject(
      makeException(
        code: "ERR_AUDIO_ENCODING",
        message: error?.localizedDescription ?? "Audio encoding failed."
      )
    )
  }

  // MARK: - Cleanup / validation helpers

  private func cleanupRecorder() {
    if let recorder = audioRecorder {
      recorder.delegate = nil
    }

    audioRecorder = nil
    currentURL = nil
    pendingDurationMillis = 0

    deactivateAudioSession()
  }

  private func deactivateAudioSession() {
    try? AVAudioSession
      .sharedInstance()
      .setActive(
        false,
        options: .notifyOthersOnDeactivation
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
      try? FileManager.default.removeItem(at: url)
    }
  }

  private func makeException(
    code: String,
    message: String
  ) -> Exception {
    Exception(
      name: "LectureRecorderError",
      description: message,
      code: code
    )
  }
}
