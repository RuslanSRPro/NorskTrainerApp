import ExpoModulesCore
@preconcurrency import MLKitTranslate

public final class OfflineTranslatorModule: Module {

  public func definition() -> ModuleDefinition {

    Name("OfflineTranslator")

    AsyncFunction("translateChunks") {
      (
        chunks: [String],
        sourceLanguage: String,
        targetLanguage: String,
        promise: Promise
      ) in

      let cleanedChunks =
        chunks
          .map {
            $0.trimmingCharacters(
              in: .whitespacesAndNewlines
            )
          }
          .filter {
            !$0.isEmpty
          }

      guard !cleanedChunks.isEmpty else {
        promise.resolve([
          "translations": [],
          "sourceLanguage": sourceLanguage,
          "targetLanguage": targetLanguage,
          "chunkCount": 0
        ])
        return
      }

      guard
        let source =
          self.translateLanguage(
            for: sourceLanguage
          )
      else {
        promise.reject(
          self.makeException(
            code: "ERR_SOURCE_LANGUAGE",
            message:
              "Unsupported source language: \(sourceLanguage)"
          )
        )
        return
      }

      guard
        let target =
          self.translateLanguage(
            for: targetLanguage
          )
      else {
        promise.reject(
          self.makeException(
            code: "ERR_TARGET_LANGUAGE",
            message:
              "Unsupported target language: \(targetLanguage)"
          )
        )
        return
      }

      guard source != target else {
        promise.resolve([
          "translations": cleanedChunks,
          "sourceLanguage": sourceLanguage,
          "targetLanguage": targetLanguage,
          "chunkCount": cleanedChunks.count
        ])
        return
      }

      let options =
        TranslatorOptions(
          sourceLanguage: source,
          targetLanguage: target
        )

      let translator =
        Translator.translator(
          options: options
        )

      let conditions =
        ModelDownloadConditions(
          allowsCellularAccess: false,
          allowsBackgroundDownloading: true
        )

      translator
        .downloadModelIfNeeded(
          with: conditions
        ) { error in

          if let error {
            promise.reject(
              self.makeException(
                code: "ERR_MODEL_DOWNLOAD",
                message:
                  "Could not download the ML Kit translation model. Connect to Wi-Fi and try again. \(error.localizedDescription)"
              )
            )
            return
          }

          var translatedChunks =
            Array(
              repeating: "",
              count: cleanedChunks.count
            )

          func translateNext(
            _ index: Int
          ) {

            if index >=
              cleanedChunks.count {

              promise.resolve([
                "translations":
                  translatedChunks,
                "sourceLanguage":
                  sourceLanguage,
                "targetLanguage":
                  targetLanguage,
                "chunkCount":
                  translatedChunks.count
              ])
              return
            }

            translator.translate(
              cleanedChunks[index]
            ) {
              translatedText,
              translationError in

              if let translationError {
                promise.reject(
                  self.makeException(
                    code: "ERR_TRANSLATION",
                    message:
                      "ML Kit could not translate text chunk \(index + 1) of \(cleanedChunks.count). \(translationError.localizedDescription)"
                  )
                )
                return
              }

              guard
                let translatedText,
                !translatedText
                  .trimmingCharacters(
                    in: .whitespacesAndNewlines
                  )
                  .isEmpty
              else {
                promise.reject(
                  self.makeException(
                    code: "ERR_EMPTY_TRANSLATION",
                    message:
                      "ML Kit returned an empty translation for chunk \(index + 1)."
                  )
                )
                return
              }

              translatedChunks[index] =
                translatedText
                  .trimmingCharacters(
                    in: .whitespacesAndNewlines
                  )

              translateNext(
                index + 1
              )
            }
          }

          translateNext(0)
        }
    }
  }


  private func translateLanguage(
    for rawTag: String
  ) -> TranslateLanguage? {

    let tag =
      rawTag
        .trimmingCharacters(
          in: .whitespacesAndNewlines
        )
        .lowercased()

    switch tag {

    case "no", "nb", "nn":
      return .norwegian

    case "uk":
      return .ukrainian

    case "ru":
      return .russian

    case "en":
      return .english

    default:
      return nil
    }
  }


  private func makeException(
    code: String,
    message: String
  ) -> Exception {

    Exception(
      name: code,
      description: message,
      code: code
    )
  }
}
