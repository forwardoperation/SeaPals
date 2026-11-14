import Foundation
import Vision

// Local-only OCR for CI screenshots. No app code, account, or network service
// is involved; this checks the actual pixels produced by WKWebView.
guard CommandLine.arguments.count == 2 else {
    fatalError("Pass the simulator screenshot path.")
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["en-US"]
request.usesLanguageCorrection = false
try VNImageRequestHandler(url: URL(fileURLWithPath: CommandLine.arguments[1]), options: [:]).perform([request])
let text = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
let output = try JSONSerialization.data(withJSONObject: text)
print(String(decoding: output, as: UTF8.self))
