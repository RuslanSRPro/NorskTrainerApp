require File.join(
  File.dirname(`node --print "require.resolve('react-native/package.json')"`),
  "scripts/react_native_pods"
)

Pod::Spec.new do |s|
  s.name           = 'LectureRecorder'
  s.version        = '1.0.0'
  s.summary        = 'Reliable native lecture audio recorder for NorskTrainerApp'
  s.description    = 'Expo native module that records long-form AAC/M4A audio directly with AVAudioRecorder on iOS.'
  s.author         = 'NorskTrainerApp'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'MIT' }

  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.frameworks = 'AVFoundation'
end
