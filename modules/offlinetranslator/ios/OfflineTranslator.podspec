require File.join(
  File.dirname(`node --print "require.resolve('react-native/package.json')"`),
  "scripts/react_native_pods"
)

Pod::Spec.new do |s|
  s.name           = 'OfflineTranslator'
  s.version        = '1.0.0'
  s.summary        = 'Offline Google ML Kit translation for NorskTrainerApp'
  s.description    = 'Expo native module for on-device Norwegian translation using Google ML Kit.'
  s.author         = 'NorskTrainerApp'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'MIT' }

  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'GoogleMLKit/Translate', '8.0.0'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
