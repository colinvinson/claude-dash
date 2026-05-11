import Foundation
import CoreMotion
import WatchKit

// Schmitt-trigger rep counter. Works regardless of watch orientation.
// Each rep = acceleration magnitude peaks above HIGH then drops below LOW.
// Enforces a minimum gap between reps to reject noise.
//
// Thresholds AUTO-TUNE per exercise based on muscle group + exercise type:
//
//   Lower-body lifts (Squat, Leg Press, etc.) — the wrist barely moves while
//   bracing or holding a bar against the back. Need much higher sensitivity.
//
//   Isolation lifts (Lateral Raise, Curl) — slower, more controlled tempo.
//   Slightly longer min interval; moderate sensitivity.
//
//   Compound upper-body (Bench, OHP, Row) — clean strong motion. Standard.
//
//   Secondary/default — middle ground.

class RepDetector: ObservableObject {
    @Published private(set) var count = 0

    private let manager     = CMMotionManager()
    private var ema         = 0.0
    private var state       = DetectState.low
    private var lastRepTime = Date.distantPast

    // Tunable per-exercise — set by start(for:)
    private var HIGH: Double = 0.35
    private var LOW:  Double = 0.15
    private var MIN_INTERVAL: TimeInterval = 0.5
    private let ALPHA: Double = 0.3  // EMA smoothing (0=no smooth, 1=max)

    // What thresholds were actually picked for the active exercise — exposed for the UI
    private(set) var activeProfile: String = "default"

    private enum DetectState { case low, high }

    private static let LOWER_BODY_MUSCLES: Set<String> =
        ["Quads", "Hamstrings", "Glutes", "Calves"]

    var isAvailable: Bool { manager.isAccelerometerAvailable }

    func start(for exercise: Exercise?) {
        configureThresholds(for: exercise)
        count = 0
        ema   = 0
        state = .low
        lastRepTime = .distantPast
        guard isAvailable else { return }
        manager.accelerometerUpdateInterval = 1.0 / 50.0  // 50 Hz
        manager.startAccelerometerUpdates(to: .main) { [weak self] data, _ in
            guard let self, let acc = data?.acceleration else { return }
            self.process(acc)
        }
    }

    func stop() {
        manager.stopAccelerometerUpdates()
    }

    private func configureThresholds(for exercise: Exercise?) {
        let group = exercise?.muscle_group ?? ""
        let type  = exercise?.exercise_type ?? "Secondary"

        // Lower-body: watch barely registers motion. Crank sensitivity way up.
        if RepDetector.LOWER_BODY_MUSCLES.contains(group) {
            HIGH = 0.18
            LOW  = 0.08
            MIN_INTERVAL = 0.7
            activeProfile = "lower-body"
            return
        }

        // Isolation upper: slower controlled tempo, smaller ROM
        if type == "Isolation" {
            HIGH = 0.25
            LOW  = 0.12
            MIN_INTERVAL = 0.7
            activeProfile = "isolation"
            return
        }

        // Compound upper: strong predictable motion
        if type == "Compound" {
            HIGH = 0.35
            LOW  = 0.15
            MIN_INTERVAL = 0.5
            activeProfile = "compound"
            return
        }

        // Secondary / default
        HIGH = 0.30
        LOW  = 0.13
        MIN_INTERVAL = 0.55
        activeProfile = "default"
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
