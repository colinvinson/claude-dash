import Foundation
import CoreMotion
import WatchKit

// Schmitt-trigger rep counter. Works regardless of watch orientation.
// Each rep = acceleration magnitude peaks above HIGH then drops below LOW.
// Enforces 500ms minimum between reps to reject noise.
class RepDetector: ObservableObject {
    @Published private(set) var count = 0

    private let manager     = CMMotionManager()
    private var ema         = 0.0
    private var state       = DetectState.low
    private var lastRepTime = Date.distantPast

    private enum DetectState { case low, high }

    // Thresholds in g-force (CMAcceleration units).
    // Lower HIGH → more sensitive but more false positives.
    // Raise if your rep style is very slow; lower for isolation movements.
    private let HIGH: Double = 0.35
    private let LOW:  Double = 0.15
    private let ALPHA: Double = 0.3         // EMA smoothing (0=no smooth, 1=max)
    private let MIN_INTERVAL: TimeInterval = 0.5  // seconds between reps

    var isAvailable: Bool { manager.isAccelerometerAvailable }

    func start() {
        count = 0
        ema   = 0
        state = .low
        lastRepTime = .distantPast
        guard isAvailable else { return }
        manager.accelerometerUpdateInterval = 1.0 / 50.0   // 50 Hz
        manager.startAccelerometerUpdates(to: .main) { [weak self] data, _ in
            guard let self, let acc = data?.acceleration else { return }
            self.process(acc)
        }
    }

    func stop() {
        manager.stopAccelerometerUpdates()
    }

    private func process(_ acc: CMAcceleration) {
        let mag = (acc.x * acc.x + acc.y * acc.y + acc.z * acc.z).squareRoot()
        ema = ALPHA * mag + (1 - ALPHA) * ema

        switch state {
        case .low  where ema > HIGH:
            state = .high
        case .high where ema < LOW:
            state = .low
            let now = Date()
            if now.timeIntervalSince(lastRepTime) > MIN_INTERVAL {
                count += 1
                lastRepTime = now
                WKInterfaceDevice.current().play(.notification)
            }
        default: break
        }
    }
}
