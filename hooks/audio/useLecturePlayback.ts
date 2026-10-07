import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';

import {
  Directory,
  File,
  Paths,
} from 'expo-file-system';

import LectureRecorder, {
  type LectureSegmentPlaybackStatus,
} from '@/modules/lecturerecorder';

import type {
  LectureItem,
} from '@/features/audio/lectureTypes';

import {
  getAudioUiText,
} from '@/features/audio/audioUiText';

import {
  useSettingsStore,
} from '@/store/settingsStore';


const devConsole = {
  error: (...args: unknown[]) => {
    if (__DEV__) {
      console.error(...args);
    }
  },
};


type UseLecturePlaybackOptions = {
  isPlaybackBlocked: () => boolean;
};


export function useLecturePlayback({
  isPlaybackBlocked,
}: UseLecturePlaybackOptions) {

  const { app_language } =
    useSettingsStore();

  const audioUi =
    getAudioUiText(
      app_language
    );

  const player =
    useAudioPlayer(
      null,
      {
        updateInterval: 250,
        keepAudioSessionActive: true,
      }
    );

  const filePlayerStatus =
    useAudioPlayerStatus(
      player
    );


  const [
    playingLectureId,
    setPlayingLectureId,
  ] =
    useState<string | null>(null);

  const [
    loadingLectureId,
    setLoadingLectureId,
  ] =
    useState<string | null>(null);

  const [
    playbackError,
    setPlaybackError,
  ] =
    useState<string | null>(null);


  const [
    segmentPlayerStatus,
    setSegmentPlayerStatus,
  ] =
    useState<LectureSegmentPlaybackStatus>({
      isLoaded: false,
      playing: false,
      currentTime: 0,
      duration: 0,
      lectureUri: null,
    });

  const segmentPlaybackActiveRef =
    useRef(false);

  const playerStatus =
    segmentPlaybackActiveRef.current
      ? segmentPlayerStatus
      : filePlayerStatus;


  const pendingPlaybackIdRef =
    useRef<string | null>(null);

  const pendingPlaybackUriRef =
    useRef<string | null>(null);

  const playbackSeekBarWidthRef =
    useRef(0);

  const pendingPlaybackSeekRef =
    useRef<{
      lectureId: string;
      seconds: number;
      autoplay: boolean;
    } | null>(
      null
    );

  const playbackRetryTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const playbackFailTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  /*
   * iOS can receive several seek requests almost at once
   * (progress bar, +/-15 sec, transcript timestamps).
   * Keep only the newest queued request and never overlap
   * native seekTo() calls for the same player instance.
   */
  const seekInFlightRef =
    useRef(false);

  const queuedSeekRef =
    useRef<{
      seconds: number;
      autoplay: boolean;
      generation: number;
    } | null>(null);

  const playbackGenerationRef =
    useRef(0);


  const getDerivedAudioUri =
    (
      lectureId: string
    ) =>
      new File(
        new Directory(
          Paths.document,
          'lectures',
          lectureId
        ),
        'audio.m4a'
      ).uri;


  const refreshSegmentPlaybackStatus =
    () => {

      if (
        !segmentPlaybackActiveRef.current
      ) {
        return;
      }

      try {
        setSegmentPlayerStatus(
          LectureRecorder
            .getSegmentPlaybackStatus()
        );
      } catch (error) {
        devConsole.error(
          'Segment playback status error:',
          error
        );
      }
    };


  const clearPlaybackLoadTimers =
    () => {

      if (
        playbackRetryTimerRef.current
      ) {
        clearTimeout(
          playbackRetryTimerRef.current
        );
        playbackRetryTimerRef.current =
          null;
      }

      if (
        playbackFailTimerRef.current
      ) {
        clearTimeout(
          playbackFailTimerRef.current
        );
        playbackFailTimerRef.current =
          null;
      }
    };


  const invalidateSeekQueue =
    () => {
      playbackGenerationRef.current +=
        1;

      queuedSeekRef.current =
        null;
    };


  const clearPendingPlayback =
    () => {
      pendingPlaybackIdRef.current =
        null;

      pendingPlaybackUriRef.current =
        null;

      pendingPlaybackSeekRef.current =
        null;
    };


  const clampSeekSeconds =
    (
      seconds: number,
      duration: number
    ) => {

      const maxSeconds =
        duration > 0.05
          ? duration - 0.05
          : Math.max(0, duration);

      return Math.min(
        maxSeconds,
        Math.max(
          0,
          seconds
        )
      );
    };


  const flushSeekQueue =
    async () => {

      if (seekInFlightRef.current) {
        return;
      }

      seekInFlightRef.current =
        true;

      try {

        while (
          queuedSeekRef.current
        ) {

          const request =
            queuedSeekRef.current;

          queuedSeekRef.current =
            null;

          if (
            request.generation !==
              playbackGenerationRef.current
          ) {
            continue;
          }

          if (
            !playerStatus.isLoaded ||
            playerStatus.duration <= 0
          ) {
            continue;
          }

          const target =
            clampSeekSeconds(
              request.seconds,
              playerStatus.duration
            );

          await player.seekTo(
            target
          );

          if (
            request.autoplay &&
            request.generation ===
              playbackGenerationRef.current
          ) {
            player.play();
          }
        }

      } catch (error) {

        devConsole.error(
          'Serialized playback seek error:',
          error
        );

        setPlaybackError(
          error instanceof Error
            ? error.message
            : audioUi.seekFailed
        );

      } finally {

        seekInFlightRef.current =
          false;

        if (queuedSeekRef.current) {
          void flushSeekQueue();
        }
      }
    };


  const queueSeek =
    (
      seconds: number,
      autoplay = false
    ) => {

      if (
        !playerStatus.isLoaded ||
        playerStatus.duration <= 0
      ) {
        return;
      }

      queuedSeekRef.current = {
        seconds:
          clampSeekSeconds(
            seconds,
            playerStatus.duration
          ),
        autoplay,
        generation:
          playbackGenerationRef.current,
      };

      void flushSeekQueue();
    };


  useEffect(() => {

    const pendingId =
      pendingPlaybackIdRef.current;

    if (
      !pendingId ||
      playingLectureId !==
        pendingId
    ) {
      return;
    }

    /*
     * In expo-audio, replace() is synchronous but
     * loading the new source is not. AudioStatus.duration
     * is documented as 0 until iOS has determined it.
     *
     * Therefore we wait for a real loaded duration
     * instead of guessing with an 80 ms timer.
     */
    if (
      !playerStatus.isLoaded ||
      playerStatus.duration <= 0
    ) {
      return;
    }


    clearPlaybackLoadTimers();

    pendingPlaybackIdRef.current =
      null;

    pendingPlaybackUriRef.current =
      null;

    setLoadingLectureId(
      null
    );


    try {

      const pendingSeek =
        pendingPlaybackSeekRef.current;

      if (
        pendingSeek &&
        pendingSeek.lectureId ===
          pendingId
      ) {

        pendingPlaybackSeekRef.current =
          null;

        queueSeek(
          pendingSeek.seconds,
          pendingSeek.autoplay
        );

        return;
      }


      player.play();

    } catch (error) {

      devConsole.error(
        'Playback start after load error:',
        error
      );

      setPlaybackError(
        audioUi.playbackStartFailed
      );
    }

  }, [
    playerStatus.isLoaded,
    playerStatus.duration,
    playingLectureId,
  ]);


  useEffect(() => {

    if (
      !segmentPlaybackActiveRef.current
    ) {
      return;
    }

    const timer =
      setInterval(
        refreshSegmentPlaybackStatus,
        250
      );

    return () => {
      clearInterval(timer);
    };

  }, [
    segmentPlayerStatus.lectureUri,
  ]);


  useEffect(() => {

    return () => {
      clearPlaybackLoadTimers();

      if (
        segmentPlaybackActiveRef.current
      ) {
        void LectureRecorder
          .stopSegmentPlayback()
          .catch(() => {});
      }
    };

  }, []);


  const beginRecordingTransition =
    () => {

      clearPlaybackLoadTimers();

      invalidateSeekQueue();
      clearPendingPlayback();

      if (
        segmentPlaybackActiveRef.current
      ) {
        segmentPlaybackActiveRef.current =
          false;

        void LectureRecorder
          .stopSegmentPlayback()
          .catch(() => {});
      } else if (
        filePlayerStatus.playing
      ) {
        player.pause();
      }
    };


  const finishRecordingTransition =
    () => {

      setPlayingLectureId(
        null
      );

      setLoadingLectureId(
        null
      );

      setPlaybackError(
        null
      );
    };


  const pauseForRetranscription =
    () => {

      clearPlaybackLoadTimers();

      invalidateSeekQueue();
      clearPendingPlayback();

      setLoadingLectureId(
        null
      );

      if (
        segmentPlaybackActiveRef.current
      ) {
        segmentPlaybackActiveRef.current =
          false;

        void LectureRecorder
          .stopSegmentPlayback()
          .catch(() => {});
      } else if (
        filePlayerStatus.playing
      ) {
        player.pause();
      }
    };


  const pauseIfLecturePlaying =
    (
      lectureId: string
    ) => {

      if (
        playingLectureId ===
          lectureId
      ) {

        invalidateSeekQueue();

        if (
          segmentPlaybackActiveRef.current
        ) {
          segmentPlaybackActiveRef.current =
            false;

          void LectureRecorder
            .stopSegmentPlayback()
            .catch(() => {});
        } else {
          player.pause();
        }

        setPlayingLectureId(
          null
        );
      }
    };


  const handlePlayLecture =
    async (
      lecture: LectureItem
    ) => {

      if (
        lecture.recordingState ===
          'interrupted'
      ) {
        Alert.alert(
          audioUi.recordingInterruptedTitle,
          audioUi.recordingInterruptedCannotPlay
        );
        return;
      }

      if (
        isPlaybackBlocked()
      ) {
        return;
      }

      try {

        setPlaybackError(
          null
        );


        let finalAudioUsable = false;

        if (lecture.audioUri.length > 0) {
          const validation =
            await LectureRecorder.validateRecording(
              lecture.audioUri
            );

          finalAudioUsable =
            validation.valid &&
            validation.playable &&
            validation.bytes >= 4096 &&
            validation.durationMillis >= 500;
        }

        if (
          !finalAudioUsable &&
          lecture.recordingState ===
            'saved'
        ) {

          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: false,
            allowsBackgroundRecording: false,
            shouldPlayInBackground: false,
            interruptionMode: 'doNotMix',
          });

          if (
            segmentPlaybackActiveRef.current &&
            playingLectureId ===
              lecture.id
          ) {

            const current =
              LectureRecorder
                .getSegmentPlaybackStatus();

            if (current.playing) {
              const paused =
                await LectureRecorder
                  .pauseSegmentPlayback();

              setSegmentPlayerStatus(
                paused
              );
            } else {

              if (
                current.duration > 0 &&
                current.currentTime >=
                  current.duration - 0.15
              ) {
                await LectureRecorder
                  .seekSegmentPlayback(
                    0
                  );
              }

              const playing =
                await LectureRecorder
                  .playSegmentPlayback();

              setSegmentPlayerStatus(
                playing
              );
            }

            return;
          }

          clearPlaybackLoadTimers();
          invalidateSeekQueue();
          player.pause();

          setLoadingLectureId(
            lecture.id
          );

          const prepared =
            await LectureRecorder
              .prepareSegmentPlayback(
                getDerivedAudioUri(
                  lecture.id
                )
              );

          segmentPlaybackActiveRef.current =
            true;

          setSegmentPlayerStatus(
            prepared
          );

          setPlayingLectureId(
            lecture.id
          );

          setLoadingLectureId(
            null
          );

          const pendingSeek =
            pendingPlaybackSeekRef.current;

          if (
            pendingSeek &&
            pendingSeek.lectureId ===
              lecture.id
          ) {
            pendingPlaybackSeekRef.current =
              null;

            await LectureRecorder
              .seekSegmentPlayback(
                pendingSeek.seconds
              );

            if (
              pendingSeek.autoplay
            ) {
              const playing =
                await LectureRecorder
                  .playSegmentPlayback();

              setSegmentPlayerStatus(
                playing
              );
            } else {
              refreshSegmentPlaybackStatus();
            }

            return;
          }

          const playing =
            await LectureRecorder
              .playSegmentPlayback();

          setSegmentPlayerStatus(
            playing
          );

          return;
        }


        if (!finalAudioUsable) {
          Alert.alert(
            audioUi.playbackErrorTitle,
            audioUi.playbackFileMissing
          );
          return;
        }


        if (
          segmentPlaybackActiveRef.current
        ) {
          segmentPlaybackActiveRef.current =
            false;

          await LectureRecorder
            .stopSegmentPlayback();
        }


        const audioFile =
          new File(
            lecture.audioUri
          );


        if (!audioFile.exists) {

          Alert.alert(
            audioUi.playbackErrorTitle,
            audioUi.playbackFileMissing
          );

          return;
        }


        const audioBytes =
          audioFile.size ??
          0;

        if (
          audioBytes < 4096
        ) {

          Alert.alert(
            audioUi.playbackErrorTitle,
            `${audioUi.playbackFileIncomplete} (${audioBytes} bytes).`
          );

          return;
        }


        const isCurrentLecture =
          playingLectureId ===
            lecture.id;

        const isCurrentLoaded =
          isCurrentLecture &&
          playerStatus.isLoaded &&
          playerStatus.duration >
            0;


        /*
         * For a NEW source, show Loading immediately.
         * setAudioModeAsync may take noticeable time on iOS,
         * and previously the first tap looked ignored while
         * this await was running.
         */
        if (
          !isCurrentLoaded
        ) {
          setLoadingLectureId(
            lecture.id
          );
        }


        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          allowsBackgroundRecording: false,
          shouldPlayInBackground: false,
          interruptionMode: 'doNotMix',
        });


        if (
          playingLectureId ===
            lecture.id &&
          playerStatus.playing
        ) {

          player.pause();
          return;
        }


        if (
          playingLectureId ===
            lecture.id &&
          playerStatus.isLoaded &&
          playerStatus.duration > 0
        ) {

          if (
            playerStatus.currentTime >=
              playerStatus.duration - 0.15
          ) {

            queueSeek(
              0,
              true
            );

            return;
          }

          player.play();
          return;
        }


        /*
         * New source:
         * never call play() after an arbitrary 80 ms.
         * Wait for AudioStatus to report a real duration.
         */

        clearPlaybackLoadTimers();

        invalidateSeekQueue();
        player.pause();

        pendingPlaybackIdRef.current =
          lecture.id;

        pendingPlaybackUriRef.current =
          lecture.audioUri;

        setPlayingLectureId(
          lecture.id
        );


        player.replace({
          uri:
            lecture.audioUri,
        });


        /*
         * The previous implementation often worked
         * on the second manual tap. Reproduce that
         * safely as one automatic reload if iOS has
         * not resolved duration after 1.2 seconds.
         */
        playbackRetryTimerRef.current =
          setTimeout(
            () => {

              if (
                pendingPlaybackIdRef.current ===
                  lecture.id &&
                pendingPlaybackUriRef.current ===
                  lecture.audioUri
              ) {

                try {

                  player.pause();

                  player.replace({
                    uri:
                      lecture.audioUri,
                  });

                } catch (error) {

                  devConsole.error(
                    'Automatic playback reload error:',
                    error
                  );
                }
              }

            },
            1200
          );


        playbackFailTimerRef.current =
          setTimeout(
            () => {

              if (
                pendingPlaybackIdRef.current ===
                  lecture.id
              ) {

                pendingPlaybackIdRef.current =
                  null;

                pendingPlaybackUriRef.current =
                  null;

                setLoadingLectureId(
                  null
                );

                const kb =
                  Math.round(
                    audioBytes /
                    1024
                  );

                setPlaybackError(
                  `${audioUi.playbackDurationUnknown} (${kb} KB).`
                );
              }

            },
            6000
          );

      } catch (error) {

        devConsole.error(
          'Could not play lecture:',
          error
        );

        clearPlaybackLoadTimers();

        pendingPlaybackIdRef.current =
          null;

        pendingPlaybackUriRef.current =
          null;

        setLoadingLectureId(
          null
        );

        setPlaybackError(
          error instanceof Error
            ? error.message
            : audioUi.playbackLoadFailed
        );
      }
    };


  const handleSeekLectureTo =
    async (
      lecture: LectureItem,
      seconds: number,
      autoplay = true
    ) => {

      if (
        lecture.recordingState ===
          'interrupted'
      ) {
        return;
      }

      if (
        isPlaybackBlocked()
      ) {
        return;
      }

      const safeSeconds =
        Math.max(
          0,
          seconds
        );


      try {

        if (
          playingLectureId ===
            lecture.id &&
          segmentPlaybackActiveRef.current &&
          segmentPlayerStatus.isLoaded &&
          segmentPlayerStatus.duration >
            0
        ) {

          const seeked =
            await LectureRecorder
              .seekSegmentPlayback(
                safeSeconds
              );

          setSegmentPlayerStatus(
            seeked
          );

          if (autoplay) {
            const playing =
              await LectureRecorder
                .playSegmentPlayback();

            setSegmentPlayerStatus(
              playing
            );
          }

          return;
        }

        if (
          playingLectureId ===
            lecture.id &&
          filePlayerStatus.isLoaded &&
          filePlayerStatus.duration >
            0
        ) {

          queueSeek(
            safeSeconds,
            autoplay
          );

          return;
        }


        pendingPlaybackSeekRef.current = {
          lectureId:
            lecture.id,
          seconds:
            safeSeconds,
          autoplay,
        };


        await handlePlayLecture(
          lecture
        );

      } catch (error) {

        devConsole.error(
          'Could not seek lecture to timestamp:',
          error
        );

        setPlaybackError(
          error instanceof Error
            ? error.message
            : audioUi.seekFailed
        );
      }
    };


  const handleSeekRelative =
    async (
      deltaSeconds: number
    ) => {

      if (
        isPlaybackBlocked()
      ) {
        return;
      }

      try {

        if (
          segmentPlaybackActiveRef.current
        ) {
          if (
            !segmentPlayerStatus.isLoaded ||
            segmentPlayerStatus.duration <= 0
          ) {
            return;
          }

          const seeked =
            await LectureRecorder
              .seekSegmentPlayback(
                Math.min(
                  segmentPlayerStatus.duration,
                  Math.max(
                    0,
                    segmentPlayerStatus.currentTime +
                      deltaSeconds
                  )
                )
              );

          setSegmentPlayerStatus(
            seeked
          );

          return;
        }

        if (
          !filePlayerStatus.isLoaded ||
          filePlayerStatus.duration <= 0
        ) {
          return;
        }

        const nextTime =
          Math.min(
            playerStatus.duration,
            Math.max(
              0,
              playerStatus.currentTime +
                deltaSeconds
            )
          );

        queueSeek(
          nextTime,
          false
        );

      } catch (error) {

        devConsole.error(
          'Playback seek error:',
          error
        );
      }
    };


  const handleSeekFraction =
    async (
      fraction: number
    ) => {

      if (
        isPlaybackBlocked()
      ) {
        return;
      }

      try {

        if (
          segmentPlaybackActiveRef.current
        ) {
          if (
            !segmentPlayerStatus.isLoaded ||
            segmentPlayerStatus.duration <= 0
          ) {
            return;
          }

          const safeFraction =
            Math.min(
              1,
              Math.max(
                0,
                fraction
              )
            );

          const seeked =
            await LectureRecorder
              .seekSegmentPlayback(
                segmentPlayerStatus.duration *
                  safeFraction
              );

          setSegmentPlayerStatus(
            seeked
          );

          return;
        }

        if (
          !filePlayerStatus.isLoaded ||
          filePlayerStatus.duration <= 0
        ) {
          return;
        }

        const safeFraction =
          Math.min(
            1,
            Math.max(
              0,
              fraction
            )
          );

        queueSeek(
          playerStatus.duration *
            safeFraction,
          false
        );

      } catch (error) {

        devConsole.error(
          'Playback seek error:',
          error
        );
      }
    };


  return {
    playerStatus,
    playingLectureId,
    loadingLectureId,
    playbackError,
    playbackSeekBarWidthRef,
    beginRecordingTransition,
    finishRecordingTransition,
    pauseForRetranscription,
    pauseIfLecturePlaying,
    handlePlayLecture,
    handleSeekLectureTo,
    handleSeekRelative,
    handleSeekFraction,
  };
}
