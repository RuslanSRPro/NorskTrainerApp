import ExpoModulesCore
@preconcurrency import AVFoundation
import UIKit
import Foundation

// Response ownership is independent from real queue/file ownership.
private final class LectureRecorderReply<Value>: @unchecked Sendable {
  private let lock = NSLock()
  private var handler: ((Result<Value, Error>) -> Void)?
  private var deadline: DispatchWorkItem?
  init(_ handler: @escaping (Result<Value, Error>) -> Void) { self.handler = handler }
  var isPending: Bool { lock.lock(); defer { lock.unlock() }; return handler != nil }
  @discardableResult func finish(_ result: Result<Value, Error>) -> Bool {
    lock.lock()
    guard let callback = handler else { lock.unlock(); return false }
    handler = nil; let timer = deadline; deadline = nil
    lock.unlock()
    timer?.cancel(); callback(result) // No callback or filesystem work under the gate lock.
    return true
  }
  func arm(after seconds: Double, error: Error, timedOut: @escaping () -> Void) {
    let timer = DispatchWorkItem { [weak self] in
      if self?.finish(.failure(error)) == true { timedOut() }
    }
    lock.lock()
    guard handler != nil else { lock.unlock(); return }
    deadline = timer; lock.unlock()
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + seconds, execute: timer)
  }
}

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

// One terminal result for the whole assembly, including fallback. The deadline
// does not depend on AVAssetExportSession calling its completion handler.
private final class LectureAssemblyOperation: @unchecked Sendable {
  private let lock = NSLock()
  private var completed = false
  private var publicationClaimed = false
  private var exporter: AVAssetExportSession?
  private var deadlineWork: DispatchWorkItem?
  private var completion: ((Result<[String: Any], Error>) -> Void)?

  init(completion: @escaping (Result<[String: Any], Error>) -> Void) {
    self.completion = completion
  }

  var isActive: Bool {
    lock.lock()
    defer { lock.unlock() }
    return !completed
  }

  func armDeadline(after seconds: TimeInterval, onTimeout: @escaping () -> Void) {
    let work = DispatchWorkItem { [weak self] in
      guard self?.isActive == true else { return }
      onTimeout()
    }
    lock.lock()
    if completed {
      lock.unlock()
      return
    }
    deadlineWork = work
    lock.unlock()
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + seconds, execute: work)
  }

  func attach(_ exporter: AVAssetExportSession) -> Bool {
    lock.lock()
    guard !completed else {
      lock.unlock()
      exporter.cancelExport()
      return false
    }
    self.exporter = exporter
    lock.unlock()
    return true
  }

  @discardableResult
  func finish(_ result: Result<[String: Any], Error>, cancelExport: Bool = false) -> Bool {
    lock.lock()
    guard !completed else { lock.unlock(); return false }
    completed = true
    let handler = completion
    completion = nil
    let activeExporter = exporter
    exporter = nil
    deadlineWork?.cancel()
    deadlineWork = nil
    lock.unlock()
    // A cancellation callback may run immediately; ownership is already closed.
    handler?(result)
    if cancelExport, let activeExporter {
      DispatchQueue.global(qos: .utility).async { activeExporter.cancelExport() }
    }
    return true
  }

  // Admission and all filesystem work happen after releasing this lock.
  // Timeout may win while publication is blocked; the file lease then remains
  // held until the publisher finishes its transaction/rollback.
  func claimPublication() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard !completed && !publicationClaimed else { return false }
    publicationClaimed = true
    return true
  }

}

// A timed-out passthrough attempt and its late callback must not both start
// fallback. The operation above remains shared by both attempts.
private final class LectureAssemblyAttempt: @unchecked Sendable {
  private let lock = NSLock()
  private var claimed = false
  func claim() -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard !claimed else { return false }
    claimed = true
    return true
  }
}

// One admission domain owns each destination, from Start preflight through
// Stop, or from archive admission through publication cleanup. No stateLock is
// acquired here. Lease tokens prevent a late release from removing a new owner.
private final class LectureFileAdmission: @unchecked Sendable {
  enum Kind: Equatable, Sendable { case recording, archive }
  struct Lease: Equatable, Sendable {
    let key: String
    let token: UUID
    let kind: Kind
  }
  private struct Entry {
    let lease: Lease
    var publicationHolds = 0
    var finishing = false
  }
  private let lock = NSLock()
  private var entries: [String: Entry] = [:]
  private var recordingToken: UUID?

  func claimRecording(_ key: String) -> Lease? { claim(key, kind: .recording) }
  func claimArchive(_ key: String) -> Lease? { claim(key, kind: .archive) }

  private func claim(_ key: String, kind: Kind) -> Lease? {
    lock.lock()
    defer { lock.unlock() }
    guard entries[key] == nil, kind != .recording || recordingToken == nil else { return nil }
    let lease = Lease(key: key, token: UUID(), kind: kind)
    entries[key] = Entry(lease: lease)
    if kind == .recording { recordingToken = lease.token }
    return lease
  }

  // The terminal result can be delivered while I/O is still settling. Admission
  // stays busy until every publication hold has returned, including rollback.
  func finish(_ lease: Lease) {
    lock.lock()
    defer { lock.unlock() }
    guard var entry = entries[lease.key], entry.lease == lease else { return }
    entry.finishing = true
    if entry.publicationHolds == 0 {
      entries.removeValue(forKey: lease.key)
      if recordingToken == lease.token { recordingToken = nil }
    } else { entries[lease.key] = entry }
  }

  func retainPublication(_ lease: Lease) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard var entry = entries[lease.key], entry.lease == lease,
      lease.kind == .archive, !entry.finishing else { return false }
    entry.publicationHolds += 1
    entries[lease.key] = entry
    return true
  }

  func releasePublication(_ lease: Lease) {
    lock.lock()
    defer { lock.unlock() }
    guard var entry = entries[lease.key], entry.lease == lease,
      entry.publicationHolds > 0 else { return }
    entry.publicationHolds -= 1
    if entry.finishing && entry.publicationHolds == 0 {
      entries.removeValue(forKey: lease.key)
    } else { entries[lease.key] = entry }
  }
}

// The I/O adapter lets the standalone tests pause an actual transaction without
// replacing the admission or completion implementation used by the recorder.
private enum LectureFilePublication {
  struct IO {
    let exists: (URL) -> Bool
    let move: (URL, URL) throws -> Void
    let remove: (URL) throws -> Void
    let size: (URL) -> Int
    static var system: IO {
      let fm = FileManager.default
      return IO(
        exists: { fm.fileExists(atPath: $0.path) },
        move: { try fm.moveItem(at: $0, to: $1) },
        remove: { try fm.removeItem(at: $0) },
        size: { url in
          let attributes = try? fm.attributesOfItem(atPath: url.path)
          return (attributes?[.size] as? NSNumber)?.intValue ?? 0
        }
      )
    }
  }

  static func publish(
    temporaryURL: URL, destinationURL: URL, validation: [String: Any],
    operation: LectureAssemblyOperation, admission: LectureFileAdmission,
    lease: LectureFileAdmission.Lease, io: IO = .system
  ) throws -> Bool {
    guard operation.claimPublication() else { return false }
    guard admission.retainPublication(lease) else {
      throw failure("ERR_ASSEMBLY_LEASE", "The archive request no longer owns this recording.")
    }
    defer { admission.releasePublication(lease) }
    let rollbackURL = destinationURL.deletingLastPathComponent()
      .appendingPathComponent("audio-rollback-\(UUID().uuidString).m4a")
    var movedOriginal = false
    var movedCandidate = false
    func requireActive() throws {
      guard operation.isActive else {
        throw failure("ERR_ASSEMBLY_CANCELLED", "Assembly timed out during publication. Source segments were preserved.")
      }
    }
    do {
      try requireActive()
      if io.exists(destinationURL) {
        try io.move(destinationURL, rollbackURL)
        movedOriginal = true
      }
      try requireActive()
      try io.move(temporaryURL, destinationURL)
      movedCandidate = true
      try requireActive()
      let bytes = io.size(destinationURL)
      guard bytes > 0, bytes == (validation["bytes"] as? Int ?? 0) else {
        throw failure("ERR_INVALID_FINAL_M4A", "The validated M4A payload changed during publication.")
      }
      var result = validation
      result["uri"] = destinationURL.absoluteString
      result["bytes"] = bytes
      // Claim terminal success before discarding rollback data. Timeout may
      // already have completed the request; in that case restore the old file.
      guard operation.finish(.success(result)) else {
        throw failure("ERR_ASSEMBLY_CANCELLED", "Assembly timed out before publication completed.")
      }
      if movedOriginal { try? io.remove(rollbackURL) }
      return true
    } catch {
      if movedCandidate { try? io.remove(destinationURL) }
      if movedOriginal { try? io.move(rollbackURL, destinationURL) }
      // If rollback itself failed its unique file remains discoverable by recovery.
      throw error
    }
  }

  private static func failure(_ code: String, _ message: String) -> NSError {
    NSError(domain: "LectureRecorder", code: 1,
      userInfo: ["recorderCode": code, NSLocalizedDescriptionKey: message])
  }
}

private struct LectureArchiveRequest {
  let lease: LectureFileAdmission.Lease
  let finish: ([String: Any]) -> Void
}

// Reservations include the item currently executing, not just waiting items.
// Never reset on route/session changes: old queued copies still consume memory.
private final class LecturePCMQueueBudget: @unchecked Sendable {
  private let lock = NSLock()
  private let limit: Double
  private var seconds = 0.0
  init(seconds: Double) { limit = seconds }
  func reserve(_ duration: Double) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard duration.isFinite, duration > 0, seconds + duration <= limit + 0.000001 else { return false }
    seconds += duration
    return true
  }
  func release(_ duration: Double) {
    lock.lock()
    seconds = max(0, seconds - duration)
    lock.unlock()
  }
}

public final class LectureRecorderModule: Module {
  private let writerPCMBudget = LecturePCMQueueBudget(seconds: 4)
  private let livePCMBudget = LecturePCMQueueBudget(seconds: 2)
  private var livePCMFailureGeneration: UInt64?
  private var writerBackpressure = false
  private let writerQueue = DispatchQueue(
    label: "com.norsktrainer.lecture-recorder.writer",
    qos: .userInitiated
  )
  private var stopBackgroundTask: UIBackgroundTaskIdentifier = .invalid

  private let mergeQueue = DispatchQueue(
    label: "com.norsktrainer.lecture-recorder.merge",
    qos: .userInitiated
  )

  // Recovery owns only durable files from inactive/previous sessions.
  // Keeping it off writerQueue prevents background recovery from delaying Start.
  private let recoveryQueue = DispatchQueue(
    label: "com.norsktrainer.lecture-recorder.recovery",
    qos: .utility
  )

  private let timingQueue = DispatchQueue(
    label: "com.norsktrainer.audio-timing",
    qos: .utility
  )

  // Live transcription is a read-only PCM consumer of the durable recorder.
  // The recorder remains the sole owner of AVAudioSession/AVAudioEngine.
  private let livePCMQueue = DispatchQueue(
    label: "com.norsktrainer.lecture-recorder.live-pcm",
    qos: .userInitiated
  )

  private let fileAdmission = LectureFileAdmission()
  // Main-thread lifecycle ownership; admission's own lock protects the path.
  private var recordingFileLease: LectureFileAdmission.Lease?

  private let stateLock = NSLock()
  private let tapCallbackGroup = DispatchGroup()

  // Finalize the first durable checkpoint quickly so an early force-quit
  // does not discard the whole recording. Later checkpoints stay longer
  // to limit AAC segment boundaries during long lectures.
  private let firstSegmentDurationSeconds = 5.0
  private let segmentDurationSeconds = 30.0

  private var audioEngine: AVAudioEngine? {
    didSet { withStateLock { statusEngineSnapshot = audioEngine } }
  }
  private var inputTapInstalled = false

  // Writer-queue-owned state.
  private var currentSegmentFile: AVAudioFile?
  private var currentPartURL: URL?
  private var nextSegmentIndex = 1
  private var currentSegmentDurationSeconds = 0.0

  // Main-thread lifecycle state.
  private var currentDestinationURL: URL? {
    didSet { withStateLock { statusHasDestination = currentDestinationURL != nil } }
  }
  private var currentSegmentsDirectoryURL: URL?
  private let stopResponseLock = NSLock()
  private var stopResponseSettled = false // Response gate; native ownership is separate.
  private var stopRequestToken = UUID()
  private var interruptionCleanupPending = false
  private var interruptionResumeRequested = false
  private var pendingStartReply: LectureRecorderReply<[String: Any]>? {
    didSet { withStateLock { statusPendingStart = pendingStartReply } }
  }
  private var pendingStartURL: URL?
  // Process-lifetime cancellation tombstones: a reordered Start cannot activate a cancelled URI.
  private var cancelledStartURIs = Set<String>()
  private var pendingStartLease: LectureFileAdmission.Lease?
  private let startResponseDeadlineSeconds = 8.0
  private let cancelResponseDeadlineSeconds = 10.0
  private let startupDrainDeadlineSeconds = 5.0
  private var cleanupTicket: UUID?
  private var cleanupCompletions: [() -> Void] = []
  // State-lock-protected URI for targeted cancellation and pending-start diagnostics.
  private var ownerDestinationSnapshot: String?
  private var pendingStopPromise: Promise?
  private var isStopping = false {
    didSet { withStateLock { statusStopping = isStopping } }
  }
  private var isPausedForInterruption = false {
    didSet { withStateLock { statusPaused = isPausedForInterruption } }
  }
  private var resumeToken: UUID?
  private var interruptionObserver: NSObjectProtocol?
  private var routeChangeObserver: NSObjectProtocol?
  private var mediaServicesResetObserver: NSObjectProtocol?
  private var lifecycleRestartPending = false
  private var activeInputSampleRate = 0.0
  private var activeInputChannelCount: AVAudioChannelCount = 0

  // Status readers never synchronously dispatch to main or race main-owned lifecycle pointers.
  private weak var statusEngineSnapshot: AVAudioEngine?
  private weak var statusPendingStart: LectureRecorderReply<[String: Any]>?
  private var statusHasDestination = false
  private var statusStopping = false
  private var statusPaused = false

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
  private var captureGeneration: UInt64 = 0
  // Lock-protected recording identity, separate from per-engine capture generations.
  private var recordingSessionID: UUID?
  private var firstBufferRecoveryAttempted = false
  private var firstBufferCaptureGeneration: UInt64 = 0
  private var timingFirstBufferLogged = false
  private var timingFirstDurableWriteLogged = false
  // Accessed only on writerQueue; telemetry for its first buffer per session.
  private var timingFirstWriterAttemptLogged = false

  // Segment-backed playback is a read-only fallback for a durably saved
  // lecture whose derived audio.m4a is not ready yet. It never exports,
  // rewrites, or deletes committed recording checkpoints.
  private var segmentPlaybackPlayer: AVPlayer?
  private var segmentPlaybackItem: AVPlayerItem?
  private var segmentPlaybackLectureUri: String?

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
      "onRecorderError",
      "onRecorderCheckpoint"
    )

    AsyncFunction("recordTimingEvent") {
      (event: String, timingLogUri: String, details: String?) in
      self.appendTimingEvent(
        event,
        timingLogUri: timingLogUri,
        details: details
      )
      return ["ok": true]
    }

    AsyncFunction("start") { (destinationUri: String) async throws -> [String: Any] in
      try await self.startRecorderRequest(destinationUri)
    }

    AsyncFunction("stop") { (promise: Promise) in
      guard let destinationURL = self.currentDestinationURL else {
        promise.reject(
          self.makeException(
            code: "ERR_NO_RECORDING",
            message: "There is no active lecture recording to stop."
          )
        )
        return
      }

      guard !self.isStopping, self.pendingStartReply == nil, self.pendingStopPromise == nil else {
        promise.reject(
          self.makeException(
            code: "ERR_STOP_PENDING",
            message: "The lecture recording is already stopping."
          )
        )
        return
      }

      self.pendingStopPromise = promise
      let stopToken = self.beginStopResponse()
      DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 20) { [weak self] in
        guard let self else { return }
        self.completeStopResponse(token: stopToken) {
          promise.reject(self.makeException(code: "ERR_STOP_DEADLINE",
            message: "Saving is still finishing. Audio checkpoints are preserved; native cleanup retains ownership until it really completes."))
        }
      }
      self.isStopping = true
      self.appendTimingEvent("STOP_BEGIN", destinationURL: destinationURL)
      self.resumeToken = nil
      self.beginStopBackgroundTask()

      self.stopAcceptingNewBuffers()
      self.stopCaptureEngine()
      self.deactivateAudioSession()

      /*
       * Never block Expo's main queue waiting for an AVAudioEngine tap.
       * The utility queue has a bounded deadline for the JS Stop promise.
       * A timeout does NOT unlock Start: native draining and cleanup still
       * complete before isStopping is released.
       */
      DispatchQueue.global(qos: .utility).async { [weak self] in
        guard let self else { return }

        self.appendTimingEvent("STOP_DRAIN_BEGIN", destinationURL: destinationURL)
        let drained =
          self.tapCallbackGroup.wait(
            timeout: .now() + 5.0
          ) == .success
        self.appendTimingEvent(
          drained ? "STOP_DRAIN_END" : "STOP_DRAIN_TIMEOUT",
          destinationURL: destinationURL
        )

        if !drained {
          DispatchQueue.main.async {
            guard self.pendingStopPromise != nil else {
              return
            }

            self.pendingStopPromise = nil
            let snapshot = self.statusSnapshot()

            self.completeStopResponse(token: stopToken) { promise.reject(
              self.makeException(
                code: "ERR_STOP_DRAIN_TIMEOUT",
                message:
                  "The recorder could not finish draining microphone callbacks within 5 seconds. " +
                  "Committed audio checkpoints were preserved for recovery."
              )
            ) }

            self.emitRecorderError(
              code: "ERR_STOP_DRAIN_TIMEOUT",
              message:
                "The recorder timed out while draining microphone callbacks. " +
                "Committed audio checkpoints were preserved.",
              url: destinationURL,
              bytes: snapshot.bytes,
              durationMillis: snapshot.durationMillis
            )
          }

          // The callback group exceeded its bounded Stop deadline. Invalidate
          // this capture generation so any callback that returns late cannot
          // enqueue audio into this or a future recording session. We can now
          // finish recovery cleanup without an unbounded second wait().
          self.invalidateCaptureGeneration()

          self.writerQueue.async { [weak self] in
            guard let self else { return }

            self.finalizeCurrentSegmentOnWriterQueue()

            if let segmentsDirectoryURL =
              self.currentSegmentsDirectoryURL
            {
              self.promoteRecoverablePartialSegments(
                in: segmentsDirectoryURL,
                reportFailureToActiveWriter: false
              )
            }

            DispatchQueue.main.async {
              self.cleanupAfterFailedStopPreservingSegments()
            }
          }
          return
        }

        self.appendTimingEvent("STOP_WRITER_FINALIZE_QUEUED", destinationURL: destinationURL)
        self.writerQueue.async { [weak self] in
          guard let self else { return }

          self.appendTimingEvent("STOP_WRITER_FINALIZE_BEGIN", destinationURL: destinationURL)
          self.finalizeCurrentSegmentOnWriterQueue()
          self.appendTimingEvent("STOP_WRITER_FINALIZE_END", destinationURL: destinationURL)

        // Retry any checkpoint that was kept as .part.m4a because its
        // first immediate validation happened before the container became
        // readable. This is also used by next-launch force-quit recovery.
        if let segmentsDirectoryURL = self.currentSegmentsDirectoryURL {
          self.promoteRecoverablePartialSegments(
            in: segmentsDirectoryURL,
            reportFailureToActiveWriter: false
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
          guard self.pendingStopPromise != nil else {
            return
          }

          self.finishStopBySaving(
            destinationURL: destinationURL,
            promise: promise,
            stopToken: stopToken,
            segmentURLs: segmentURLs,
            unresolvedPartialURLs: unresolvedPartialURLs
          )
        }
      }
      }
    }.runOnQueue(.main)

    AsyncFunction("cancel") { () async throws -> [String: Any] in
      let target = self.withStateLock { self.ownerDestinationSnapshot }
      return try await self.cancelRecorderRequest(target)
    }

    AsyncFunction("cancelForUri") { (destinationUri: String) async throws -> [String: Any] in
      return try await self.cancelRecorderRequest(destinationUri)
    }

    Function("writeTextSnapshot") { (uri: String, text: String) throws -> Bool in
      guard let url = URL(string: uri), url.isFileURL else {
        throw self.makeException(code: "ERR_SNAPSHOT_URI", message: "Invalid snapshot file URI.")
      }
      try Data(text.utf8).write(to: url, options: .atomic)
      return true
    }

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

    AsyncFunction("prepareSegmentPlayback") { (destinationUri: String) throws -> [String: Any] in
      guard
        let destinationURL = URL(string: destinationUri),
        destinationURL.isFileURL
      else {
        throw self.makeException(
          code: "ERR_INVALID_AUDIO_URI",
          message: "The segment playback destination is not a valid local file URL."
        )
      }

      let manifest =
        self.loadRecordingManifest(
          for: destinationURL
        )

      guard
        let manifest,
        !manifest.segments.isEmpty
      else {
        throw self.makeException(
          code: "ERR_NO_PLAYBACK_SEGMENTS",
          message: "No durable lecture segments are available for playback."
        )
      }

      let segmentsDirectoryURL =
        self.segmentsDirectoryURL(
          for: destinationURL
        )

      let composition =
        AVMutableComposition()

      guard
        let compositionTrack =
          composition.addMutableTrack(
            withMediaType: .audio,
            preferredTrackID: kCMPersistentTrackID_Invalid
          )
      else {
        throw self.makeException(
          code: "ERR_PLAYBACK_COMPOSITION",
          message: "Could not create the lecture playback composition."
        )
      }

      var cursor = CMTime.zero
      var insertedCount = 0

      for segment in manifest.segments {
        guard segment.status == "committed" else {
          throw self.makeException(
            code: "ERR_PLAYBACK_SEGMENT_STATE",
            message: "A lecture playback checkpoint is not durably committed."
          )
        }

        let segmentURL =
          segmentsDirectoryURL
            .appendingPathComponent(
              segment.file
            )

        guard
          FileManager.default.fileExists(
            atPath: segmentURL.path
          )
        else {
          throw self.makeException(
            code: "ERR_PLAYBACK_SEGMENT_MISSING",
            message: "A durable lecture playback checkpoint is missing."
          )
        }

        let asset =
          AVURLAsset(
            url: segmentURL
          )

        guard
          let sourceTrack =
            asset.tracks(
              withMediaType: .audio
            ).first
        else {
          throw self.makeException(
            code: "ERR_PLAYBACK_SEGMENT_TRACK",
            message: "A durable lecture checkpoint has no readable audio track."
          )
        }

        let duration =
          asset.duration

        guard
          duration.isNumeric,
          CMTimeCompare(
            duration,
            .zero
          ) > 0
        else {
          throw self.makeException(
            code: "ERR_PLAYBACK_SEGMENT_DURATION",
            message: "A durable lecture checkpoint has an invalid duration."
          )
        }

        do {
          try compositionTrack.insertTimeRange(
            CMTimeRange(
              start: .zero,
              duration: duration
            ),
            of: sourceTrack,
            at: cursor
          )
        } catch {
          throw self.makeException(
            code: "ERR_PLAYBACK_SEGMENT_INSERT",
            message: "Could not add a durable lecture checkpoint to playback: \(error.localizedDescription)"
          )
        }

        cursor =
          CMTimeAdd(
            cursor,
            duration
          )

        insertedCount += 1
      }

      guard insertedCount > 0 else {
        throw self.makeException(
          code: "ERR_NO_PLAYBACK_SEGMENTS",
          message: "No durable lecture segments are available for playback."
        )
      }

      self.segmentPlaybackPlayer?.pause()

      let item =
        AVPlayerItem(
          asset: composition
        )

      let player =
        AVPlayer(
          playerItem: item
        )

      self.segmentPlaybackItem = item
      self.segmentPlaybackPlayer = player
      self.segmentPlaybackLectureUri = destinationURL.absoluteString

      return self.segmentPlaybackStatusDictionary()
    }

    AsyncFunction("playSegmentPlayback") { () -> [String: Any] in
      self.segmentPlaybackPlayer?.play()
      return self.segmentPlaybackStatusDictionary()
    }

    AsyncFunction("pauseSegmentPlayback") { () -> [String: Any] in
      self.segmentPlaybackPlayer?.pause()
      return self.segmentPlaybackStatusDictionary()
    }

    AsyncFunction("seekSegmentPlayback") { (seconds: Double, promise: Promise) in
      guard
        let player = self.segmentPlaybackPlayer
      else {
        promise.resolve(
          self.segmentPlaybackStatusDictionary()
        )
        return
      }

      let durationSeconds =
        player.currentItem?
          .duration
          .seconds ?? 0

      let upperBound =
        durationSeconds.isFinite &&
        durationSeconds > 0
          ? max(
              0,
              durationSeconds - 0.05
            )
          : max(
              0,
              seconds
            )

      let safeSeconds =
        min(
          upperBound,
          max(
            0,
            seconds
          )
        )

      player.seek(
        to: CMTime(
          seconds: safeSeconds,
          preferredTimescale: 600
        ),
        toleranceBefore: .zero,
        toleranceAfter: .zero
      ) { [weak self] _ in
        DispatchQueue.main.async {
          promise.resolve(
            self?.segmentPlaybackStatusDictionary() ??
            [
              "isLoaded": false,
              "playing": false,
              "currentTime": 0.0,
              "duration": 0.0,
              "lectureUri": NSNull()
            ]
          )
        }
      }
    }

    AsyncFunction("stopSegmentPlayback") { () -> [String: Any] in
      self.segmentPlaybackPlayer?.pause()
      self.segmentPlaybackPlayer = nil
      self.segmentPlaybackItem = nil
      self.segmentPlaybackLectureUri = nil
      return self.segmentPlaybackStatusDictionary()
    }

    Function("getSegmentPlaybackStatus") {
      self.segmentPlaybackStatusDictionary()
    }

    AsyncFunction("assembleRecording") { (destinationUri: String, promise: Promise) in
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
            message: "The assembly destination is not a valid local file URL."
          )
        )
        return
      }

      guard let request = self.beginArchiveRequest(for: destinationURL, promise: promise) else {
        return
      }

      self.recoveryQueue.async { [weak self] in
        guard let self else { return }

        guard
          let manifest = self.loadRecordingManifest(
            for: destinationURL
          )
        else {
          let result = self.makeValidationResult(
            valid: false,
            playable: false,
            durationMillis: 0,
            uri: destinationURL.absoluteString,
            bytes: 0,
            code: "ERR_ASSEMBLY_MANIFEST_MISSING",
            message: "The saved lecture has no readable durable recording manifest."
          )

          DispatchQueue.main.async {
            request.finish(result)
          }
          return
        }

        let existingValidation =
          self.validateAudioFile(
            destinationURL
          )

        if
          manifest.assembly.state == "ready",
          (try? self.verifyRecordingManifestInventoryForStop(
            segmentURLs: self.completedSegmentURLs(in: self.segmentsDirectoryURL(for: destinationURL)),
            destinationURL: destinationURL)) != nil,
          self.unresolvedPartialSegmentURLs(in: self.segmentsDirectoryURL(for: destinationURL)).isEmpty,
          manifest.assembly.output == destinationURL.lastPathComponent,
          (existingValidation["valid"] as? Bool) == true,
          (existingValidation["playable"] as? Bool) == true
        {
          DispatchQueue.main.async {
            request.finish(existingValidation)
          }
          return
        }

        self.assembleRecordingFromManifest(
          manifest,
          destinationURL: destinationURL,
          archiveLease: request.lease
        ) { result in
          DispatchQueue.main.async {
            request.finish(result)
          }
        }
      }
    }

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

      guard let request = self.beginArchiveRequest(for: destinationURL, promise: promise) else {
        return
      }

      self.recoveryQueue.async { [weak self] in
        guard let self else { return }
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
          request.finish(existingValidation)
          return
        }

        self.appendTimingEvent("RECOVERY_QUEUED", destinationURL: destinationURL)
        self.appendTimingEvent("RECOVERY_BEGIN", destinationURL: destinationURL)

        self.promoteRecoverablePartialSegments(
          in: segmentsDirectoryURL,
          destinationURL: destinationURL,
          reportFailureToActiveWriter: false
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
            request.finish(result)
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
            request.finish(result)
          }

          return
        }

        self.appendTimingEvent(
          "RECOVERY_RECONCILED",
          destinationURL: destinationURL,
          details: "segments=\(reconciledManifest.segments.count);durationMillis=\(reconciledManifest.committedDurationMillis)"
        )
        self.assembleRecordingFromManifest(
          reconciledManifest,
          destinationURL: destinationURL,
          archiveLease: request.lease
        ) { result in
          self.appendTimingEvent("RECOVERY_END", destinationURL: destinationURL)
          var recovered = result
          // Reconciliation independently verified the complete durable inventory.
          // A derived exporter failure must not block segment transcription.
          recovered["durableSegmentsVerified"] = true
          DispatchQueue.main.async {
            request.finish(recovered)
          }
        }
      }
    }
  }

  private func beginArchiveRequest(
    for destinationURL: URL,
    promise: Promise
  ) -> LectureArchiveRequest? {
    guard let lease = fileAdmission.claimArchive(destinationURL.standardizedFileURL.path) else {
      promise.resolve(makeValidationResult(
        valid: false, playable: false, durationMillis: 0,
        uri: destinationURL.absoluteString, bytes: 0,
        code: "ERR_AUDIO_OPERATION_BUSY",
        message: "This lecture is recording, stopping, or finishing audio preparation. Its files were preserved."
      ))
      return nil
    }
    return LectureArchiveRequest(lease: lease, finish: { result in
      DispatchQueue.main.async {
        // A timed-out publication may still hold this lease for rollback. Its
        // terminal Promise completes now; a concurrent retry remains busy.
        self.fileAdmission.finish(lease)
        promise.resolve(result)
      }
    })
  }

  private func assembleRecordingFromManifest(
    _ manifest: RecordingManifest,
    destinationURL: URL,
    archiveLease: LectureFileAdmission.Lease,
    completion: @escaping ([String: Any]) -> Void
  ) {
    let committedBytes =
      manifest.segments.reduce(0) {
        $0 + $1.bytes
      }

    guard !manifest.segments.isEmpty else {
      completion(
        makeValidationResult(
          valid: false,
          playable: false,
          durationMillis: manifest.committedDurationMillis,
          uri: destinationURL.absoluteString,
          bytes: committedBytes,
          code: "ERR_NO_ASSEMBLY_SEGMENTS",
          message: "No committed lecture segments were available for assembly."
        )
      )
      return
    }

    guard
      manifest.segments.allSatisfy({
        $0.status == "committed"
      })
    else {
      completion(
        makeValidationResult(
          valid: false,
          playable: false,
          durationMillis: manifest.committedDurationMillis,
          uri: destinationURL.absoluteString,
          bytes: committedBytes,
          code: "ERR_ASSEMBLY_SEGMENT_STATE",
          message: "Lecture assembly requires every manifest segment to be durably committed. Source segments were preserved."
        )
      )
      return
    }

    let segmentsDirectoryURL =
      self.segmentsDirectoryURL(
        for: destinationURL
      )

    let segmentURLs =
      manifest.segments.map {
        segmentsDirectoryURL
          .appendingPathComponent(
            $0.file
          )
      }

    do {
      let actualSegments = self.completedSegmentURLs(in: segmentsDirectoryURL)
      _ = try self.verifyRecordingManifestInventoryForStop(
        segmentURLs: actualSegments, destinationURL: destinationURL)
      guard self.unresolvedPartialSegmentURLs(in: segmentsDirectoryURL).isEmpty else {
        throw self.makeNSError(code: "ERR_ASSEMBLY_PARTIAL_INVENTORY",
          message: "Unresolved audio tail exists. Recover it before assembly; source audio is preserved.")
      }
      try self.updateRecordingManifestDurably(
        for: destinationURL
      ) {
        $0.state = "saved"
        $0.assembly.state = "assembling"
        $0.assembly.generation += 1
      }
    } catch {
      completion(
        self.makeValidationResult(
          valid: false,
          playable: false,
          durationMillis: manifest.committedDurationMillis,
          uri: destinationURL.absoluteString,
          bytes: committedBytes,
          code: "ERR_ASSEMBLY_MANIFEST_TRANSITION",
          message: error.localizedDescription
        )
      )
      return
    }

    self.appendTimingEvent(
      "ASSEMBLY_STARTED",
      destinationURL: destinationURL,
      details: "segments=\(segmentURLs.count)"
    )

    self.mergeSegments(
      segmentURLs,
      to: destinationURL,
      protectExistingRecording: true,
      archiveLease: archiveLease
    ) { result in
      self.recoveryQueue.async {
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
            completion(
              self.makeValidationResult(
                valid: false,
                playable: false,
                durationMillis: manifest.committedDurationMillis,
                uri: destinationURL.absoluteString,
                bytes: committedBytes,
                code: "ERR_ASSEMBLY_READY_MANIFEST",
                message: "The audio file was assembled, but its ready state could not be committed durably: \(error.localizedDescription)"
              )
            )
            return
          }

          completion(validation)

        case .failure(let error):
          do {
            try self.updateRecordingManifestDurably(
              for: destinationURL
            ) {
              $0.state = "saved"
              $0.assembly.state = "assembly_failed"
            }
          } catch let manifestError {
            completion(
              self.makeValidationResult(
                valid: false,
                playable: false,
                durationMillis: manifest.committedDurationMillis,
                uri: destinationURL.absoluteString,
                bytes: committedBytes,
                code: "ERR_ASSEMBLY_FAILURE_MANIFEST",
                message: "Lecture assembly failed and the failure state could not be committed durably. Assembly error: \(error.localizedDescription). Manifest error: \(manifestError.localizedDescription)"
              )
            )
            return
          }

          let latestManifest =
            self.loadRecordingManifest(
              for: destinationURL
            )

          let latestDurationMillis =
            latestManifest?.committedDurationMillis ??
            manifest.committedDurationMillis

          let latestBytes =
            latestManifest?.segments.reduce(0) {
              $0 + $1.bytes
            } ?? committedBytes

          completion(
            self.makeValidationResult(
              valid: false,
              playable: false,
              durationMillis: latestDurationMillis,
              uri: destinationURL.absoluteString,
              bytes: latestBytes,
                code: (error as NSError).userInfo["recorderCode"] as? String ?? "ERR_ASSEMBLY_MERGE",
              message: error.localizedDescription
            )
          )
        }
        }
    }
  }

  private func segmentPlaybackStatusDictionary() -> [String: Any] {
    guard
      let player = segmentPlaybackPlayer,
      let item = player.currentItem
    else {
      return [
        "isLoaded": false,
        "playing": false,
        "currentTime": 0.0,
        "duration": 0.0,
        "lectureUri": NSNull()
      ]
    }

    let rawCurrentTime =
      player.currentTime().seconds

    let rawDuration =
      item.duration.seconds

    let currentTime =
      rawCurrentTime.isFinite
        ? max(
            0,
            rawCurrentTime
          )
        : 0

    let duration =
      rawDuration.isFinite
        ? max(
            0,
            rawDuration
          )
        : 0

    return [
      "isLoaded":
        item.status == .readyToPlay &&
        duration > 0,
      "playing":
        player.rate > 0,
      "currentTime":
        currentTime,
      "duration":
        duration,
      "lectureUri":
        (segmentPlaybackLectureUri as Any?) ??
        NSNull()
    ]
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
        ) { [weak self] notification in
          self?.handleAudioSessionRouteChange(notification)
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

  private func handleAudioSessionRouteChange(
    _ notification: Notification
  ) {
    guard
      currentDestinationURL != nil,
      !isStopping,
      !isPausedForInterruption
    else {
      return
    }

    let rawReason =
      notification.userInfo?[AVAudioSessionRouteChangeReasonKey]
        as? UInt

    let reason =
      rawReason.flatMap {
        AVAudioSession.RouteChangeReason(rawValue: $0)
      }

    /*
     * AVAudioSession can emit route notifications while our own category
     * and activation changes are settling. Do not tear down a healthy
     * engine merely because a notification arrived. Restart only when the
     * running engine is gone or the microphone processing format actually
     * changed.
     */
    if
      let engine = audioEngine,
      engine.isRunning
    {
      let format =
        engine.inputNode.outputFormat(
          forBus: 0
        )

      let sameFormat =
        abs(
          format.sampleRate -
            activeInputSampleRate
        ) < 1.0 &&
        format.channelCount ==
          activeInputChannelCount

      if sameFormat {
        return
      }
    }

    let reasonDescription =
      reason.map {
        String(describing: $0)
      } ?? "unknown"

    restartCaptureAfterLifecycleChange(
      reason:
        "route change (\(reasonDescription))"
    )
  }

  private func restartCaptureAfterLifecycleChange(
    reason: String
  ) {
    guard
      currentDestinationURL != nil,
      !isStopping,
      !isPausedForInterruption,
      !lifecycleRestartPending,
      let sessionID = currentRecordingSession()
    else {
      return
    }

    lifecycleRestartPending = true
    stopAcceptingNewBuffers()
    stopCaptureEngine()

    DispatchQueue.global(qos: .utility).async { [weak self] in
      guard let self else { return }
      let drained = self.tapCallbackGroup.wait(timeout: .now() + 5.0) == .success

      DispatchQueue.main.async { [weak self] in
        guard let self else { return }
        guard self.isCurrentRecordingSession(sessionID) else { return }
        if !drained { self.invalidateCaptureGeneration() }

        self.writerQueue.async { [weak self] in
          guard let self, self.isCurrentRecordingSession(sessionID) else { return }
          self.finalizeCurrentSegmentOnWriterQueue()

          DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard self.isCurrentRecordingSession(sessionID) else { return }
            if !drained {
              // A timed-out tap may still be executing. Never attach a new
              // capture engine to this session after an incomplete drain.
              let snapshot = self.statusSnapshot()
              let destinationURL = self.currentDestinationURL
              self.emitRecorderError(
                code: "ERR_AUDIO_LIFECYCLE_DRAIN_TIMEOUT",
                message: "Microphone callbacks did not drain after \(reason). Committed checkpoints were preserved for recovery.",
                url: destinationURL,
                bytes: snapshot.bytes,
                durationMillis: snapshot.durationMillis
              )
              self.cleanupAfterFailedStopPreservingSegments()
              return
            }
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
              let snapshot = self.statusSnapshot()
              let destinationURL = self.currentDestinationURL

              self.emitRecorderError(
                code: "ERR_AUDIO_LIFECYCLE_RESTART",
                message: "The recorder could not resume after \(reason): \(error.localizedDescription)",
                url: destinationURL,
                bytes: snapshot.bytes,
                durationMillis: snapshot.durationMillis
              )

              // The writer queue has already finalized the current segment.
              // Release native ownership without deleting recoverable audio.
              self.cleanupAfterFailedStopPreservingSegments()
            }
          }
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
      !isPausedForInterruption,
      let sessionID = currentRecordingSession()
    else {
      return
    }

    isPausedForInterruption = true
    interruptionCleanupPending = true
    interruptionResumeRequested = false
    resumeToken = nil
    stopAcceptingNewBuffers()
    stopCaptureEngine()

    DispatchQueue.global(qos: .utility).async { [weak self] in
      guard let self else { return }
      let drained = self.tapCallbackGroup.wait(timeout: .now() + 5.0) == .success

      DispatchQueue.main.async { [weak self] in
        guard let self, self.isCurrentRecordingSession(sessionID) else { return }
        if !drained { self.invalidateCaptureGeneration() }

        self.writerQueue.async { [weak self] in
          guard let self, self.isCurrentRecordingSession(sessionID) else { return }
          self.finalizeCurrentSegmentOnWriterQueue()
          DispatchQueue.main.async {
            guard self.isCurrentRecordingSession(sessionID) else { return }
            self.interruptionCleanupPending = false
            if self.interruptionResumeRequested {
              self.interruptionResumeRequested = false
              self.handleInterruptionEnded()
            }
          }
        }
      }
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

    if interruptionCleanupPending {
      interruptionResumeRequested = true
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
      !interruptionCleanupPending,
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

    let captureGeneration = nextCaptureGeneration()
    let captureSourceURI = currentDestinationURL?.absoluteString

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

      guard
        self.isAcceptingNewBuffers(),
        self.isCurrentCaptureGeneration(captureGeneration)
      else {
        return
      }

      let shouldLogFirstBuffer = self.withStateLock { () -> Bool in
        self.firstBufferCaptureGeneration = captureGeneration
        if self.timingFirstBufferLogged {
          return false
        }
        self.timingFirstBufferLogged = true
        return true
      }

      if shouldLogFirstBuffer {
        self.appendTimingEvent(
          "FIRST_BUFFER",
          destinationURL: self.currentDestinationURL
        )
      }

      let duration = Double(buffer.frameLength) / buffer.format.sampleRate
      guard self.writerPCMBudget.reserve(duration) else {
        self.withStateLock { if self.writerFailureMessage == nil { self.writerBackpressure = true } }
        self.stopAcceptingNewBuffers()
        self.reportWriterFailure("The audio writer exceeded its 4-second queue budget. Capture stopped visibly; accepted buffers and checkpoints are preserved.")
        return
      }
      self.updateLiveMetrics(from: buffer)
      let captureStart = self.withStateLock { max(0, self.capturedDurationSeconds - duration) }

      guard
        let copiedBuffer =
          self.copyPCMBuffer(
            buffer
          )
      else {
        self.writerPCMBudget.release(duration)
        self.reportWriterFailure(
          "Could not copy a microphone buffer."
        )
        return
      }

      if shouldLogFirstBuffer {
        self.appendTimingEvent("WRITER_FIRST_BUFFER_ENQUEUED", destinationURL: self.currentDestinationURL)
      }
      self.writerQueue.async { [self] in
        defer { self.writerPCMBudget.release(duration) }
        guard
          self.isCurrentCaptureGeneration(captureGeneration)
        else {
          return
        }

        self.writeBufferOnWriterQueue(
          copiedBuffer
        )
      }

      // Fan out a separate immutable copy off the realtime tap callback.
      // Whisper may be cold/loading/slow; none of that is allowed to block
      // durable segment writes or own a second microphone engine.
      let deliverLive = self.withStateLock { self.livePCMFailureGeneration != captureGeneration }
      if deliverLive {
        if self.livePCMBudget.reserve(duration) {
          if let liveBuffer = self.copyPCMBuffer(buffer) {
            self.livePCMQueue.async { [self] in
              defer { self.livePCMBudget.release(duration) }
              guard self.isCurrentCaptureGeneration(captureGeneration) else { return }
              NotificationCenter.default.post(name: Notification.Name("NorskTrainer.LectureRecorder.PCMBuffer"),
                object: liveBuffer, userInfo: ["sourceURI": captureSourceURI ?? "", "captureStartSeconds": captureStart])
            }
          } else {
            self.livePCMBudget.release(duration)
            self.reportLivePCMGap(generation: captureGeneration, sourceURI: captureSourceURI)
          }
        } else { self.reportLivePCMGap(generation: captureGeneration, sourceURI: captureSourceURI) }
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

      // engine.start() failed, so do not synchronously wait on the main
      // queue for tap callbacks or writer cleanup. Invalidate this capture
      // generation; any late callback will be discarded by both guards.
      invalidateCaptureGeneration()

      writerQueue.async { [weak self] in
        self?.finalizeCurrentSegmentOnWriterQueue()
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
    activeInputSampleRate = recordingFormat.sampleRate
    activeInputChannelCount = recordingFormat.channelCount
    // Check this specific engine generation, not only the recording-wide
    // FIRST_BUFFER timing flag. Never retry more than once per session.
    if let sessionID = currentRecordingSession() {
      DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
        guard let self else { return }
        guard self.isCurrentRecordingSession(sessionID) else { return }
        guard self.isCurrentCaptureGeneration(captureGeneration) else { return }
        guard self.currentDestinationURL != nil else { return }
        guard !self.isStopping, !self.isPausedForInterruption else { return }

        let state = self.withStateLock {
          (
            firstBufferGeneration: self.firstBufferCaptureGeneration,
            accepting: self.acceptingBuffers,
            writerFailure: self.writerFailureMessage != nil,
            recoveryAttempted: self.firstBufferRecoveryAttempted
          )
        }

        guard state.firstBufferGeneration != captureGeneration else {
          return
        }

        let engineRunning = self.audioEngine?.isRunning == true
        let details =
          "engineRunning=\(engineRunning), " +
          "acceptingBuffers=\(state.accepting), " +
          "writerFailure=\(state.writerFailure), " +
          "captureGeneration=\(captureGeneration)"

        self.appendTimingEvent(
          "FIRST_BUFFER_TIMEOUT_3S",
          destinationURL: self.currentDestinationURL,
          details: details
        )

        guard !state.recoveryAttempted else {
          self.appendTimingEvent(
            "FIRST_BUFFER_RECOVERY_EXHAUSTED",
            destinationURL: self.currentDestinationURL
          )
          return
        }

        guard !self.lifecycleRestartPending, !state.writerFailure else {
          return
        }

        let shouldRecover = self.withStateLock { () -> Bool in
          guard !self.firstBufferRecoveryAttempted else { return false }
          self.firstBufferRecoveryAttempted = true
          return true
        }

        guard shouldRecover else { return }

        self.appendTimingEvent(
          "FIRST_BUFFER_RECOVERY_BEGIN",
          destinationURL: self.currentDestinationURL
        )

        self.restartCaptureAfterLifecycleChange(
          reason: "first microphone buffer timeout"
        )
      }
    }
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
    let traceFirstWriterAttempt = !timingFirstWriterAttemptLogged
    if traceFirstWriterAttempt {
      timingFirstWriterAttemptLogged = true
      appendTimingEvent("WRITER_FIRST_BUFFER_ENTER", destinationURL: currentDestinationURL)
    }
    guard withStateLock({ writerFailureMessage == nil || writerBackpressure }) else {
      return
    }

    do {
      if currentSegmentFile == nil {
        if traceFirstWriterAttempt {
          appendTimingEvent("WRITER_FILE_OPEN_BEGIN", destinationURL: currentDestinationURL)
        }
        try openNextSegmentOnWriterQueue(
          processingFormat: buffer.format
        )
        if traceFirstWriterAttempt {
          appendTimingEvent("WRITER_FILE_OPEN_END", destinationURL: currentDestinationURL)
        }
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
      if traceFirstWriterAttempt {
        appendTimingEvent("WRITER_FILE_WRITE_BEGIN", destinationURL: currentDestinationURL)
      }
      try writeToCurrentSegmentOnWriterQueue(
        buffer
      )
      if traceFirstWriterAttempt {
        appendTimingEvent("WRITER_FILE_WRITE_END", destinationURL: currentDestinationURL)
      }

      let shouldLogFirstWrite = withStateLock { () -> Bool in
        if timingFirstDurableWriteLogged {
          return false
        }
        timingFirstDurableWriteLogged = true
        return true
      }

      if shouldLogFirstWrite {
        appendTimingEvent(
          "FIRST_DURABLE_WRITE",
          destinationURL: currentDestinationURL
        )
      }

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
      withStateLock { writerBackpressure = false }
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

    // Capture writer-owned facts before releasing the AVAudioFile.  Periodic
    // checkpoint rotation must never run AVAudioPlayer/retry/sleep on the
    // critical writer queue: that can stall microphone buffers and can turn a
    // transient container-readability delay into a fatal segment-sequence gap.
    let measuredDurationSeconds = currentSegmentDurationSeconds
    let measuredDurationMillis = max(
      0,
      Int((measuredDurationSeconds * 1000.0).rounded())
    )

    currentSegmentFile = nil
    currentPartURL = nil
    currentSegmentDurationSeconds = 0

    withStateLock {
      currentPartURLSnapshot = nil
    }

    // A positive sub-500ms tail still contains real audio. Segment validation
    // accepts it; the final assembled lecture retains its normal 500ms minimum.
    let bytes = fileSize(partURL)
    guard measuredDurationMillis > 0 else {
      appendTimingEvent("SEGMENT_ZERO_DURATION_PRESERVED", destinationURL: currentDestinationURL)
      return // Keep the raw .part for explicit recovery; never silently delete it.
    }

    guard bytes > 0 else {
      appendTimingEvent(
        "SEGMENT_REJECTED",
        destinationURL: currentDestinationURL,
        details: "durationMillis=\(measuredDurationMillis);bytes=\(bytes)"
      )
      removeFileIfPresent(partURL)
      nextSegmentIndex = max(1, nextSegmentIndex - 1)
      return
    }

    let finalURL = finalizedSegmentURL(forPartURL: partURL)

    do {
      guard !FileManager.default.fileExists(atPath: finalURL.path) else {
        throw makeNSError(
          code: "ERR_SEGMENT_DESTINATION_EXISTS",
          message: "A finalized lecture checkpoint already exists for segment \(finalURL.lastPathComponent). Existing durable audio was preserved."
        )
      }

      try FileManager.default.moveItem(at: partURL, to: finalURL)

      let finalizedFileBytes = fileSize(finalURL)
      guard finalizedFileBytes > 0 else {
        throw makeNSError(
          code: "ERR_SEGMENT_BYTES",
          message: "A finalized lecture checkpoint has no readable payload."
        )
      }

      withStateLock {
        finalizedBytes += finalizedFileBytes
        finalizedSegmentCount += 1
      }

      let lightweightValidation: [String: Any] = [
        "valid": true,
        "playable": true,
        "durationMillis": measuredDurationMillis,
        "uri": finalURL.absoluteString,
        "bytes": finalizedFileBytes,
        "code": NSNull(),
        "message": NSNull()
      ]

      if let destinationURL = currentDestinationURL {
        do {
          try commitSegmentToRecordingManifestDurably(
            segmentURL: finalURL,
            validation: lightweightValidation,
            destinationURL: destinationURL
          )
          appendTimingEvent(
            "SEGMENT_COMMITTED",
            destinationURL: destinationURL,
            details: "file=\(finalURL.lastPathComponent);durationMillis=\(measuredDurationMillis);bytes=\(finalizedFileBytes)"
          )

          let checkpointIndex = segmentIndex(from: finalURL) ?? 0
          DispatchQueue.main.async { [weak self] in
            self?.sendEvent(
              "onRecorderCheckpoint",
              [
                "index": checkpointIndex,
                "durationMillis": measuredDurationMillis,
                "bytes": finalizedFileBytes,
                "uri": finalURL.absoluteString
              ]
            )
          }
        } catch {
          // The finalized M4A is the durable source of truth.  Manifest
          // bookkeeping is reconciled from finalized checkpoints on Stop and
          // recovery, so a manifest write/sequence problem must not kill the
          // ongoing microphone capture.
          appendTimingEvent(
            "SEGMENT_MANIFEST_DEFERRED",
            destinationURL: destinationURL,
            details: "file=\(finalURL.lastPathComponent);error=\(error.localizedDescription)"
          )
        }
      }

    } catch {
      // Finalized/partial source audio is preserved.  Do not stop the capture
      // engine for a checkpoint-finalization bookkeeping failure.
      appendTimingEvent(
        "SEGMENT_FINALIZE_DEFERRED",
        destinationURL: currentDestinationURL,
        details: error.localizedDescription
      )
    }
  }

  private func resetWriterStateOnWriterQueue() {
    currentSegmentFile = nil
    currentPartURL = nil
    nextSegmentIndex = 1
    currentSegmentDurationSeconds = 0
    timingFirstWriterAttemptLogged = false
  }

  private func reportLivePCMGap(generation: UInt64, sourceURI: String?) {
    let first = withStateLock { () -> Bool in
      guard captureGeneration == generation, livePCMFailureGeneration != generation else { return false }
      livePCMFailureGeneration = generation
      return true
    }
    guard first else { return }
    // Delivery must not wait behind the stalled PCM consumer or block the tap.
    DispatchQueue.global(qos: .utility).async {
      NotificationCenter.default.post(name: Notification.Name("NorskTrainer.LectureRecorder.PCMGap"),
        object: nil, userInfo: ["sourceURI": sourceURI ?? ""])
    }
  }

  private func reportWriterFailure(
    _ message: String
  ) {
    // Capture the recording that owns this failure before dispatching work.
    // An old writer callback must never stop a newly started session.
    var shouldReport = false
    var failureSessionID: UUID?

    withStateLock {
      if writerFailureMessage == nil, let sessionID = recordingSessionID {
        writerFailureMessage = message
        failureSessionID = sessionID
        shouldReport = true
      }
    }

    guard shouldReport, let sessionID = failureSessionID else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      guard let self, self.isCurrentRecordingSession(sessionID) else { return }

      self.stopAcceptingNewBuffers()
      self.stopCaptureEngine()
      self.deactivateAudioSession()
      self.isPausedForInterruption = true

      DispatchQueue.global(qos: .utility).async { [weak self] in
        guard let self else { return }

        let drained =
          self.tapCallbackGroup.wait(
            timeout: .now() + 5.0
          ) == .success

        // Keep session validation and generation invalidation on main.
        DispatchQueue.main.async { [weak self] in
          guard let self, self.isCurrentRecordingSession(sessionID) else { return }
          if !drained { self.invalidateCaptureGeneration() }

          self.writerQueue.async { [weak self] in
            guard let self, self.isCurrentRecordingSession(sessionID) else { return }
            self.finalizeCurrentSegmentOnWriterQueue()

            DispatchQueue.main.async { [weak self] in
              guard let self, self.isCurrentRecordingSession(sessionID) else { return }
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
        }
      }
    }
  }

  // MARK: - Stop / merge / recovery

  // Public async functions never synchronously wait for the serial writer.
  private func startRecorderRequest(_ uri: String) async throws -> [String: Any] {
    guard let destination = URL(string: uri), destination.isFileURL else {
      throw makeException(code: "ERR_INVALID_DESTINATION", message: "Invalid local recording destination.")
    }
    return try await withCheckedThrowingContinuation { continuation in
      let reply = LectureRecorderReply<[String: Any]> { continuation.resume(with: $0) }
      reply.arm(after: self.startResponseDeadlineSeconds, error: self.makeException(code: "ERR_START_DEADLINE",
        message: "Recorder preparation exceeded 8 seconds. Start was cancelled; previous native work retains ownership until it really finishes.")) {
        self.appendTimingEvent("START_DEADLINE", destinationURL: destination)
      }
      DispatchQueue.main.async {
        guard reply.isPending else { return } // A request delayed before main admission cannot start late.
        guard !self.cancelledStartURIs.contains(destination.absoluteString) else {
          reply.finish(.failure(self.makeException(code: "ERR_START_CANCELLED", message: "This Start was cancelled before native admission."))); return
        }
        guard self.pendingStartReply == nil, self.currentDestinationURL == nil,
              !self.isStopping, self.pendingStopPromise == nil else {
          reply.finish(.failure(self.makeException(code: "ERR_RECORDER_BUSY",
            message: "The previous recorder operation is still preparing or cleaning up. Source audio was preserved; retry after it completes.")))
          return
        }
        guard let lease = self.fileAdmission.claimRecording(destination.standardizedFileURL.path) else {
          reply.finish(.failure(self.makeException(code: "ERR_AUDIO_OPERATION_BUSY", message: "This destination is already owned by recording or recovery.")))
          return
        }
        self.pendingStartReply = reply
        self.pendingStartURL = destination
        self.pendingStartLease = lease
        self.withStateLock { self.ownerDestinationSnapshot = destination.absoluteString }
        self.appendTimingEvent("NATIVE_START_ENTERED", destinationURL: destination)
        self.appendTimingEvent("WRITER_RESET_QUEUED", destinationURL: destination)
        self.writerQueue.async {
          guard reply.isPending else {
            DispatchQueue.main.async { self.releasePreparedStart(reply) }
            return
          }
          self.appendTimingEvent("WRITER_RESET_BEGIN", destinationURL: destination)
          self.resetWriterStateOnWriterQueue()
          self.appendTimingEvent("WRITER_RESET_END", destinationURL: destination)
          guard reply.isPending else {
            DispatchQueue.main.async { self.releasePreparedStart(reply) }
            return
          }
          do {
            let folder = self.segmentsDirectoryURL(for: destination)
            let manifest = self.recordingManifestURL(for: destination)
            guard !FileManager.default.fileExists(atPath: destination.path),
                  !FileManager.default.fileExists(atPath: folder.path),
                  !FileManager.default.fileExists(atPath: manifest.path) else {
              throw self.makeException(code: "ERR_DESTINATION_EXISTS", message: "Start refused to overwrite existing durable recording data.")
            }
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            guard reply.isPending else {
              DispatchQueue.main.async { self.releasePreparedStart(reply) }; return
            }
            self.appendTimingEvent("MANIFEST_CREATE_BEGIN", destinationURL: destination)
            try self.createInitialRecordingManifest(for: destination)
            self.appendTimingEvent("MANIFEST_CREATE_END", destinationURL: destination)
            DispatchQueue.main.async {
              guard self.pendingStartReply === reply, reply.isPending else {
                self.releasePreparedStart(reply); return
              }
              self.currentDestinationURL = destination
              self.currentSegmentsDirectoryURL = folder
              self.recordingFileLease = lease
              self.pendingStartLease = nil
              self.beginRecordingSession()
              self.isStopping = false; self.isPausedForInterruption = false
              self.resumeToken = nil; self.lifecycleRestartPending = false
              self.resetLiveState()
              do {
                guard reply.isPending else { throw CancellationError() }
                self.appendTimingEvent("SESSION_CONFIG_BEGIN", destinationURL: destination)
                try self.configureAudioSessionForRecording()
                self.appendTimingEvent("SESSION_CONFIG_END", destinationURL: destination)
                guard reply.isPending else { throw CancellationError() }
                self.appendTimingEvent("ENGINE_START_BEGIN", destinationURL: destination)
                try self.startCaptureEngine()
                guard reply.isPending else { throw CancellationError() }
                self.appendTimingEvent("ENGINE_STARTED", destinationURL: destination)
                self.ensureAudioLifecycleObservers()
                // finish() is the linearization point: a deadline may win even after the last check.
                if reply.finish(.success(self.makeStatusResult(ok: true))) {
                  self.pendingStartReply = nil; self.pendingStartURL = nil
                } else { self.cleanupFailedStart(reply) }
              } catch {
                reply.finish(.failure(self.makeException(code: "ERR_START_RECORDING",
                  message: "Native recorder startup failed: \(error.localizedDescription). Cleanup preserves source audio.")))
                self.cleanupFailedStart(reply)
              }
            }
          } catch {
            reply.finish(.failure(error))
            DispatchQueue.main.async { self.releasePreparedStart(reply) }
          }
        }
      }
    }
  }

  // Called on main only after preparation really exited writerQueue. No active engine owns this lease.
  private func releasePreparedStart(_ reply: LectureRecorderReply<[String: Any]>) {
    guard pendingStartReply === reply, currentDestinationURL == nil else { return }
    if let lease = pendingStartLease { fileAdmission.finish(lease) }
    pendingStartLease = nil; pendingStartReply = nil; pendingStartURL = nil
    withStateLock { ownerDestinationSnapshot = nil }
  }

  private func cleanupFailedStart(_ reply: LectureRecorderReply<[String: Any]>) {
    guard pendingStartReply === reply, !isStopping else { return }
    isStopping = true; resumeToken = nil
    stopAcceptingNewBuffers(); stopCaptureEngine(); deactivateAudioSession()
    let session = currentRecordingSession()
    DispatchQueue.global(qos: .utility).async {
      let drained = self.tapCallbackGroup.wait(timeout: .now() + self.startupDrainDeadlineSeconds) == .success
      DispatchQueue.main.async {
        guard self.pendingStartReply === reply, self.currentRecordingSession() == session else { return }
        if !drained { self.invalidateCaptureGeneration() }
        self.writerQueue.async {
          self.finalizeCurrentSegmentOnWriterQueue()
          DispatchQueue.main.async { self.cleanupAfterFailedStopPreservingSegments() }
        }
      }
    }
  }

  private func cancelRecorderRequest(_ expectedURI: String?) async throws -> [String: Any] {
    return try await withCheckedThrowingContinuation { continuation in
      let reply = LectureRecorderReply<[String: Any]> { continuation.resume(with: $0) }
      reply.arm(after: self.cancelResponseDeadlineSeconds, error: self.makeException(code: "ERR_CANCEL_DEADLINE",
        message: "Recorder cancellation is still finishing. Audio was preserved; native ownership remains held until cleanup actually completes.")) {
        self.appendTimingEvent("CANCEL_DEADLINE", destinationURL: expectedURI.flatMap { URL(string: $0) })
      }
      DispatchQueue.main.async {
        if let expectedURI { self.cancelledStartURIs.insert(expectedURI) }
        let actual = self.currentDestinationURL?.absoluteString ?? self.pendingStartURL?.absoluteString
        guard let expectedURI, actual == expectedURI else {
          reply.finish(.success(["ok": true, "staleRequestSkipped": true])); return
        }
        if let start = self.pendingStartReply {
          start.finish(.failure(self.makeException(code: "ERR_START_CANCELLED", message: "Recorder Start was cancelled before completion.")))
          if self.currentDestinationURL == nil {
            // Pending writer work owns this reservation until it exits. Never enqueue a second reset.
            reply.finish(.success(["ok": true, "cleanupPending": true])); return
          }
        }
        guard !self.isStopping, self.pendingStopPromise == nil else {
          reply.finish(.failure(self.makeException(code: "ERR_STOP_PENDING", message: "The recorder is already finishing; native ownership remains held."))); return
        }
        self.isStopping = true; self.resumeToken = nil; self.isPausedForInterruption = false
        self.stopAcceptingNewBuffers(); self.stopCaptureEngine(); self.deactivateAudioSession()
        let session = self.currentRecordingSession()
        DispatchQueue.global(qos: .utility).async {
          let drained = self.tapCallbackGroup.wait(timeout: .now() + self.startupDrainDeadlineSeconds) == .success
          DispatchQueue.main.async {
            guard self.currentRecordingSession() == session else {
              reply.finish(.failure(self.makeException(code: "ERR_CANCEL_STALE", message: "Stale cancellation was discarded."))); return
            }
            if !drained { self.invalidateCaptureGeneration() }
            self.writerQueue.async {
              self.finalizeCurrentSegmentOnWriterQueue()
              DispatchQueue.main.async {
                self.cleanupAfterFailedStopPreservingSegments {
                  if drained { reply.finish(.success(["ok": true])) }
                  else { reply.finish(.failure(self.makeException(code: "ERR_CANCEL_DRAIN_TIMEOUT", message: "Microphone callbacks exceeded the drain limit. Native cleanup completed; source audio was preserved."))) }
                }
              }
            }
          }
        }
      }
    }
  }

  private func beginStopResponse() -> UUID {
    stopResponseLock.lock()
    defer { stopResponseLock.unlock() }
    stopRequestToken = UUID()
    stopResponseSettled = false
    return stopRequestToken
  }

  private func completeStopResponse(token: UUID, _ action: () -> Void) {
    stopResponseLock.lock()
    guard stopRequestToken == token, !stopResponseSettled else {
      stopResponseLock.unlock()
      return
    }
    stopResponseSettled = true
    stopResponseLock.unlock()
    action() // No Promise callbacks, file I/O or other locks under this lock.
  }

  private func finishStopBySaving(
    destinationURL: URL,
    promise: Promise,
    stopToken: UUID,
    segmentURLs: [URL],
    unresolvedPartialURLs: [URL]
  ) {
    /*
     * The Stop promise and destination are captured by stop() itself.
     * They therefore cannot disappear while writer-queue finalization is
     * in flight. Every started Stop reaches one explicit resolve/reject
     * path instead of silently returning with a pending JS promise.
     */
    guard !segmentURLs.isEmpty else {
      let writerFailure = statusSnapshot().writerFailureMessage
      pendingStopPromise = nil
      cleanupAfterFailedStopPreservingSegments()
      self.completeStopResponse(token: stopToken) { promise.reject(
        makeException(
          code: "ERR_NO_SEGMENTS",
          message: writerFailure.map {
            "No finalized lecture segments were available to save. Writer error: \($0)"
          } ?? "No finalized lecture segments were available to save."
        )
      ) }
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

      self.completeStopResponse(token: stopToken) { promise.reject(
        makeException(
          code: "ERR_UNRESOLVED_PARTIAL_SEGMENT",
          message: "The finalized lecture checkpoints were preserved, but Stop could not safely commit the current audio tail. Recovery data was preserved: \(unresolvedNames)"
        )
      ) }
      return
    }

    recoveryQueue.async {
      let outcome: Result<[String: Any], Error> = Result {
        // Full validation is deliberately off main and off writerQueue. It also
        // repairs a checkpoint whose manifest update failed during capture.
        _ = try self.reconcileRecordingManifestDurably(for: destinationURL)
        _ = try self.verifyRecordingManifestInventoryForStop(
          segmentURLs: segmentURLs, destinationURL: destinationURL
        )
        try self.updateRecordingManifestDurably(for: destinationURL) {
          $0.state = "saved"
          $0.assembly.state = "not_started"
          $0.assembly.output = nil
        }
        guard let manifest = self.loadRecordingManifest(for: destinationURL),
          manifest.state == "saved", !manifest.segments.isEmpty,
          manifest.committedDurationMillis > 0 else {
          throw self.makeNSError(
            code: "ERR_MANIFEST_SAVE_VERIFY",
            message: "The saved recording state could not be verified. Source checkpoints were preserved."
          )
        }
        self.appendTimingEvent(
          "LAST_SEGMENT_DURABLE", destinationURL: destinationURL,
          details: "segments=\(manifest.segments.count);durationMillis=\(manifest.committedDurationMillis)"
        )
        return [
          "ok": true, "isRecording": false,
          "durationMillis": manifest.committedDurationMillis,
          "uri": destinationURL.absoluteString,
          "bytes": manifest.segments.reduce(0) { $0 + $1.bytes },
          "levelDb": -160.0, "peakDb": -160.0,
          "isPausedForInterruption": false,
          "segmentCount": manifest.segments.count
        ]
      }
      DispatchQueue.main.async {
        guard self.pendingStopPromise != nil else { return }
        self.pendingStopPromise = nil
        switch outcome {
        case .success(let result):
          self.cleanupAfterSuccessfulStop {
            self.sendEvent("onRecorderStopped", result)
            self.completeStopResponse(token: stopToken) { promise.resolve(result) }
          }
        case .failure(let error):
          self.cleanupAfterFailedStopPreservingSegments()
          self.completeStopResponse(token: stopToken) { promise.reject(self.makeException(
            code: "ERR_MANIFEST_SAVE",
            message: "Audio checkpoints were preserved, but Stop could not verify the saved state: \(error.localizedDescription)"
          )) }
        }
      }
    }
  }

  private func mergeSegments(
    _ segmentURLs: [URL],
    to destinationURL: URL,
    protectExistingRecording: Bool = false,
    archiveLease: LectureFileAdmission.Lease,
    completion: @escaping (Result<[String: Any], Error>) -> Void
  ) {
    let operation = LectureAssemblyOperation(completion: completion)
    operation.armDeadline(after: 120.0) {
      if operation.finish(.failure(self.makeNSError(
        code: "ERR_ASSEMBLY_TIMEOUT",
        message: "Audio preparation exceeded its 120-second deadline. All source segments were preserved; preparation can be retried."
      )), cancelExport: true) {
        self.appendTimingEvent("ASSEMBLY_TIMEOUT", destinationURL: destinationURL)
      }
    }
    mergeSegmentsAttempt(segmentURLs, to: destinationURL,
      protectExistingRecording: protectExistingRecording, archiveLease: archiveLease, operation: operation)
  }

  private func mergeSegmentsAttempt(
    _ segmentURLs: [URL],
    to destinationURL: URL,
    protectExistingRecording: Bool = false,
    forceReencode: Bool = false,
    archiveLease: LectureFileAdmission.Lease,
    operation: LectureAssemblyOperation
  ) {
    mergeQueue.async { [self] in
      guard operation.isActive else { return }

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
        var commonAudioSignature: String? = nil
        var canPassthroughWithoutReencode = true

        guard !segmentURLs.isEmpty else {
          throw self.makeNSError(
            code: "ERR_EMPTY_COMPOSITION",
            message: "No lecture segments were supplied for assembly."
          )
        }

        for (offset, url) in segmentURLs.enumerated() {
          guard operation.isActive else { return }
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

          if
            let formatDescription = assetTrack.formatDescriptions.first,
            let audioDescription = formatDescription as? CMAudioFormatDescription,
            let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(audioDescription)?.pointee
          {
            let signature =
              "\(asbd.mFormatID):\(asbd.mSampleRate):\(asbd.mChannelsPerFrame):\(asbd.mFramesPerPacket)"

            if let commonAudioSignature {
              if commonAudioSignature != signature {
                canPassthroughWithoutReencode = false
              }
            } else {
              commonAudioSignature = signature
            }
          } else {
            canPassthroughWithoutReencode = false
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

        /*
         * Normal uninterrupted lectures use identical AAC checkpoint
         * formats. Re-encoding 1-2 hours of already encoded AAC can keep
         * the UI in Preparing audio for an hour, so use passthrough when
         * every committed segment has the same codec/sample-rate/channel
         * signature. If an interruption changed the hardware format, keep
         * the normalized AppleM4A re-encode path for correctness.
         */
        let exportPreset =
          !forceReencode && canPassthroughWithoutReencode
            ? AVAssetExportPresetPassthrough
            : AVAssetExportPresetAppleM4A

        self.appendTimingEvent(
          "ASSEMBLY_EXPORT_BEGIN",
          destinationURL: destinationURL,
          details: "segments=\(segmentURLs.count);preset=\(exportPreset)"
        )

        guard
          let exporter = AVAssetExportSession(
            asset: composition,
            presetName: exportPreset
          )
        else {
          if exportPreset == AVAssetExportPresetPassthrough {
            self.appendTimingEvent("ASSEMBLY_PASSTHROUGH_FALLBACK", destinationURL: destinationURL, details: "reason=session_unavailable")
            self.mergeSegmentsAttempt(segmentURLs, to: destinationURL,
              protectExistingRecording: protectExistingRecording, forceReencode: true, archiveLease: archiveLease, operation: operation)
            return
          }
          throw self.makeNSError(
            code: "ERR_EXPORT_SESSION",
            message: "Could not create an iOS M4A export session."
          )
        }

        guard exporter.supportedFileTypes.contains(.m4a) else {
          if exportPreset == AVAssetExportPresetPassthrough {
            self.appendTimingEvent("ASSEMBLY_PASSTHROUGH_FALLBACK", destinationURL: destinationURL, details: "reason=m4a_unsupported")
            self.mergeSegmentsAttempt(segmentURLs, to: destinationURL,
              protectExistingRecording: protectExistingRecording, forceReencode: true, archiveLease: archiveLease, operation: operation)
            return
          }
          throw self.makeNSError(code: "ERR_EXPORT_FILE_TYPE", message: "This iOS export session cannot produce an M4A file. Source segments were preserved.")
        }
        exporter.outputURL = temporaryURL
        exporter.outputFileType = .m4a
        exporter.shouldOptimizeForNetworkUse = false

        guard operation.attach(exporter) else { return }
        let attempt = LectureAssemblyAttempt()
        exporter.exportAsynchronously {
          guard attempt.claim(), operation.isActive else {
            self.removeFileIfPresent(temporaryURL)
            return
          }
          self.appendTimingEvent(
            "ASSEMBLY_EXPORT_END",
            destinationURL: destinationURL,
            details: "status=\(exporter.status.rawValue)"
          )
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
              self.removeFileIfPresent(temporaryURL)

              if exportPreset == AVAssetExportPresetPassthrough {
                self.appendTimingEvent(
                  "ASSEMBLY_PASSTHROUGH_FALLBACK",
                  destinationURL: destinationURL,
                  details: "reason=invalid_output"
                )
                self.mergeSegmentsAttempt(
                  segmentURLs,
                  to: destinationURL,
                  protectExistingRecording: protectExistingRecording,
                  forceReencode: true,
                  archiveLease: archiveLease, operation: operation
                )
              } else {
                operation.finish(
                  .failure(
                    self.makeNSError(
                      code: "ERR_INVALID_MERGE",
                      message: "The merged temporary M4A is not playable. All source segments were preserved."
                    )
                  )
                )
              }
              return
            }

            guard
              let assembledDurationMillis =
                temporaryValidation["durationMillis"] as? Int
            else {
              self.removeFileIfPresent(
                temporaryURL
              )

              operation.finish(
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
            // AAC priming/container rounding accumulates across many
            // checkpoints.  Use a small bounded proportional tolerance rather
            // than a fixed 1.5 s for recordings that can last several hours.
            // This remains far stricter than accepting a percentage-sized loss.
            let durationToleranceMillis = max(
              2000,
              min(
                10000,
                Int((Double(expectedDurationMillis) * 0.0015).rounded())
              )
            )

            guard
              abs(assembledDurationMillis - expectedDurationMillis)
                <= durationToleranceMillis
            else {
              self.removeFileIfPresent(temporaryURL)

              if exportPreset == AVAssetExportPresetPassthrough {
                self.appendTimingEvent(
                  "ASSEMBLY_PASSTHROUGH_FALLBACK",
                  destinationURL: destinationURL,
                  details: "reason=duration_mismatch;expected=\(expectedDurationMillis);assembled=\(assembledDurationMillis)"
                )
                self.mergeSegmentsAttempt(
                  segmentURLs,
                  to: destinationURL,
                  protectExistingRecording: protectExistingRecording,
                  forceReencode: true,
                  archiveLease: archiveLease, operation: operation
                )
              } else {
                operation.finish(
                  .failure(
                    self.makeNSError(
                      code: "ERR_INCOMPLETE_ASSEMBLY_DURATION",
                      message: "Lecture assembly duration does not cover the committed segments (expected \(expectedDurationMillis) ms, assembled \(assembledDurationMillis) ms). All source segments were preserved."
                    )
                  )
                )
              }
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

              operation.finish(
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
              let published = try LectureFilePublication.publish(
                temporaryURL: temporaryURL, destinationURL: destinationURL,
                validation: temporaryValidation, operation: operation,
                admission: self.fileAdmission, lease: archiveLease
              )
              if published {
                self.appendTimingEvent("M4A_READY", destinationURL: destinationURL,
                  details: "durationMillis=\(temporaryValidation["durationMillis"] ?? 0)")
              } else { self.removeFileIfPresent(temporaryURL) }
            } catch {
              self.removeFileIfPresent(temporaryURL)
              operation.finish(.failure(error))
            }

          case .failed, .cancelled:
            self.removeFileIfPresent(temporaryURL)

            if exportPreset == AVAssetExportPresetPassthrough {
              self.appendTimingEvent(
                "ASSEMBLY_PASSTHROUGH_FALLBACK",
                destinationURL: destinationURL,
                details: "reason=export_failed_or_cancelled"
              )
              self.mergeSegmentsAttempt(
                segmentURLs,
                to: destinationURL,
                protectExistingRecording: protectExistingRecording,
                forceReencode: true,
                archiveLease: archiveLease, operation: operation
              )
            } else {
              operation.finish(
                .failure(
                  exporter.error ??
                  self.makeNSError(
                    code: "ERR_EXPORT_FAILED",
                    message: "iOS could not export the merged lecture M4A."
                  )
                )
              )
            }

          default:
            self.removeFileIfPresent(
              temporaryURL
            )

            operation.finish(
              .failure(
                self.makeNSError(
                  code: "ERR_EXPORT_STATE",
                  message: "The iOS audio exporter finished in an unexpected state."
                )
              )
            )
          }
        }

        // Cover a deadline racing with export startup after attach().
        if !operation.isActive { exporter.cancelExport() }

        // Reserve most of the shared 120-second budget for re-encoding.
        // Fallback begins even if the cancelled passthrough never calls back.
        if exportPreset == AVAssetExportPresetPassthrough {
          DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 20.0) {
            guard operation.isActive, attempt.claim() else { return }
            self.appendTimingEvent("ASSEMBLY_PASSTHROUGH_TIMEOUT", destinationURL: destinationURL)
            self.mergeSegmentsAttempt(segmentURLs, to: destinationURL,
              protectExistingRecording: protectExistingRecording, forceReencode: true, archiveLease: archiveLease, operation: operation)
            exporter.cancelExport()
          }
        }

      } catch {
        operation.finish(
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
    destinationURL explicitDestinationURL: URL? = nil,
    reportFailureToActiveWriter: Bool = true
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
        if reportFailureToActiveWriter {
          reportWriterFailure(
            "Could not durably promote a recoverable lecture checkpoint: \(error.localizedDescription)"
          )
        } else {
          appendTimingEvent(
            "RECOVERY_PROMOTE_FAILED",
            destinationURL: explicitDestinationURL,
            details: "file=\(partURL.lastPathComponent);error=\(error.localizedDescription)"
          )
        }
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
    let lifecycle = withStateLock {
      (engine: statusEngineSnapshot, pending: statusPendingStart, active: statusHasDestination,
       stopping: statusStopping, paused: statusPaused, uri: ownerDestinationSnapshot)
    }
    // SDK property access and the reply gate lock happen outside stateLock.
    let engineRunning = lifecycle.engine?.isRunning == true

    let activelyRecording =
      lifecycle.active &&
      !lifecycle.stopping &&
      !lifecycle.paused &&
      engineRunning &&
      snapshot.writerFailureMessage == nil &&
      snapshot.hasSuccessfulWrite

    return [
      "ok": ok,
      "isRecording": activelyRecording,
      "durationMillis": snapshot.durationMillis,
      "uri":
        (lifecycle.uri as Any?) ?? NSNull(),
      "isStarting": lifecycle.pending != nil,
      "cleanupPending": lifecycle.stopping || (lifecycle.pending != nil && lifecycle.pending?.isPending == false),
      "bytes": snapshot.bytes,
      "levelDb": snapshot.levelDb,
      "peakDb": snapshot.peakDb,
      "isPausedForInterruption":
        lifecycle.paused,
      "engineRunning":
        engineRunning,
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

  private func appendTimingEvent(
    _ event: String,
    destinationURL: URL? = nil,
    timingLogUri: String? = nil,
    details: String? = nil
  ) {
    let explicitURL: URL? = {
      guard
        let timingLogUri,
        let url = URL(string: timingLogUri),
        url.isFileURL
      else {
        return nil
      }
      return url
    }()

    let logURL = explicitURL ?? destinationURL.map {
      $0
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appendingPathComponent("_timing.log")
    }

    guard let logURL else {
      return
    }

    let timestamp = ISO8601DateFormatter().string(from: Date())
    let uptimeMillis = Int(ProcessInfo.processInfo.systemUptime * 1000.0)
    let lectureId = destinationURL?.deletingLastPathComponent().lastPathComponent ?? "-"
    let suffix = details.map { " | \($0)" } ?? ""
    let line = "\(timestamp) | uptimeMs=\(uptimeMillis) | \(event) | lecture=\(lectureId)\(suffix)\n"

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
        // Telemetry must never change recording behavior.
      }
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
      timingFirstBufferLogged = false
      timingFirstDurableWriteLogged = false
    }
  }

  private func beginStopBackgroundTask() {
    guard stopBackgroundTask == .invalid else {
      return
    }

    stopBackgroundTask =
      UIApplication.shared.beginBackgroundTask(
        withName: "NorskTrainerLectureStop"
      ) { [weak self] in
        guard let self else { return }
        DispatchQueue.main.async {
          self.endStopBackgroundTask()
        }
      }
  }

  private func endStopBackgroundTask() {
    guard stopBackgroundTask != .invalid else {
      return
    }

    let task = stopBackgroundTask
    stopBackgroundTask = .invalid
    UIApplication.shared.endBackgroundTask(task)
  }

  private func cleanupAfterSuccessfulStop(_ completion: @escaping () -> Void = {}) {
    finishRecorderCleanup(completion)
  }

  private func cleanupAfterFailedStopPreservingSegments(_ completion: @escaping () -> Void = {}) {
    finishRecorderCleanup(completion)
  }

  // Main-owned lifecycle -> writer-owned reset -> main-owned terminal publication.
  // Neither Start nor recovery can claim the old destination before reset really exits.
  private func finishRecorderCleanup(_ completion: @escaping () -> Void) {
    cleanupCompletions.append(completion)
    if cleanupTicket != nil { return }
    let ticket = UUID(), session = currentRecordingSession()
    cleanupTicket = ticket
    isStopping = true; lifecycleRestartPending = false
    stopAcceptingNewBuffers(); stopCaptureEngine(); deactivateAudioSession()
    writerQueue.async {
      self.resetWriterStateOnWriterQueue()
      DispatchQueue.main.async {
        guard self.cleanupTicket == ticket, self.currentRecordingSession() == session else { return }
        self.endRecordingSession()
        self.endStopBackgroundTask()
        self.currentDestinationURL = nil; self.currentSegmentsDirectoryURL = nil
        self.pendingStartReply = nil; self.pendingStartURL = nil; self.pendingStartLease = nil
        self.withStateLock { self.ownerDestinationSnapshot = nil }
        self.isStopping = false; self.isPausedForInterruption = false; self.resumeToken = nil
        self.resetLiveState()
        self.cleanupTicket = nil
        let callbacks = self.cleanupCompletions; self.cleanupCompletions = []
        callbacks.forEach { $0() }
      }
    }
  }

  private func beginRecordingSession() {
    withStateLock {
      writerBackpressure = false
      recordingSessionID = UUID()
      firstBufferRecoveryAttempted = false
    }
  }

  private func endRecordingSession() {
    withStateLock { recordingSessionID = nil }
    // Never acquire admission's lock while stateLock is held.
    if let lease = recordingFileLease {
      recordingFileLease = nil
      fileAdmission.finish(lease)
    }
  }

  private func currentRecordingSession() -> UUID? {
    withStateLock { recordingSessionID }
  }

  private func isCurrentRecordingSession(_ id: UUID) -> Bool {
    withStateLock { recordingSessionID == id }
  }

  private func nextCaptureGeneration() -> UInt64 {
    withStateLock {
      captureGeneration &+= 1
      return captureGeneration
    }
  }

  private func invalidateCaptureGeneration() {
    withStateLock {
      captureGeneration &+= 1
    }
  }

  private func isCurrentCaptureGeneration(
    _ generation: UInt64
  ) -> Bool {
    withStateLock {
      captureGeneration == generation
    }
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

    let isCheckpoint = url.deletingLastPathComponent().lastPathComponent == ".audio-segments"
    guard bytes >= (isCheckpoint ? 1 : 4096) else {
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

      guard durationMillis >= (isCheckpoint ? 1 : 500) else {
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
        "recorderCode": code,
        NSLocalizedDescriptionKey:
          message
      ]
    )
  }
}
