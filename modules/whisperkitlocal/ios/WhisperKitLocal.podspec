require File.join(
  File.dirname(`node --print "require.resolve('react-native/package.json')"`),
  "scripts/react_native_pods"
)

Pod::Spec.new do |s|
  s.name           = 'WhisperKitLocal'
  s.version        = '1.0.0'
  s.summary        = 'Local WhisperKit bridge for NorskTrainerApp'
  s.description    = 'Expo native module that performs on-device Whisper transcription on iOS.'
  s.author         = 'NorskTrainerApp'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'MIT' }

  # Argmax OSS / WhisperKit 1.1 requires iOS 16+
  s.platforms      = { :ios => '16.4' }

  # Local Expo module
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'

  # React Native 0.75+ SPM bridge.
  # We link only the WhisperKit product, not TTSKit/SpeakerKit.
  spm_dependency(
    s,
    url: 'https://github.com/argmaxinc/argmax-oss-swift.git',
    requirement: {
      kind: 'upToNextMajorVersion',
      minimumVersion: '1.1.0'
    },
    products: ['WhisperKit']
  )
end
