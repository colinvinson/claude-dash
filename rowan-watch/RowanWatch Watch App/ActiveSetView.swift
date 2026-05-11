import SwiftUI
import WatchKit

struct ActiveSetView: View {
    let exercise: Exercise
    let weightKg: Double

    @StateObject private var detector = RepDetector()
    @State private var phase: Phase = .counting
    @State private var finalReps = 0
    @State private var posting = false
    @State private var postError = false
    @Environment(\.dismiss) private var dismiss

    enum Phase { case counting, confirming, done }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            switch phase {

            case .counting:
                VStack(spacing: 8) {
                    Text("\(formattedWeight)kg")
                        .font(.caption2).foregroundStyle(.secondary)

                    Text("\(detector.count)")
                        .font(.system(size: 60, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .contentTransition(.numericText())
                        .animation(.spring(response: 0.15), value: detector.count)

                    Text(detector.isAvailable
                         ? "counting reps · \(detector.activeProfile)"
                         : "no accelerometer")
                        .font(.caption2).foregroundStyle(.secondary)

                    Button("Done") {
                        detector.stop()
                        finalReps = detector.count
                        phase = .confirming
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                    .buttonBorderShape(.capsule)
                }
                .onAppear { detector.start(for: exercise) }

            case .confirming:
                VStack(spacing: 8) {
                    Text("\(formattedWeight)kg")
                        .font(.caption2).foregroundStyle(.secondary)

                    Text("\(finalReps)")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .contentTransition(.numericText())
                        .animation(.snappy, value: finalReps)

                    Text("reps  ·  scroll to adjust")
                        .font(.caption2).foregroundStyle(.secondary)

                    Button(posting ? "Logging…" : "Log Set ✓") {
                        guard !posting else { return }
                        Task {
                            posting = true
                            let ok = await APIClient.logSet(
                                exercise: exercise,
                                weightKg: weightKg,
                                reps: finalReps
                            )
                            posting = false
                            phase = ok ? .done : .counting
                            if !ok { postError = true }
                        }
                    }
                    .disabled(posting || finalReps == 0)
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                    .buttonBorderShape(.capsule)
                }
                .focusable(true)
                .digitalCrownRotation(
                    Binding(get: { Double(finalReps) }, set: { finalReps = max(0, Int($0.rounded())) }),
                    from: 0, through: 60, by: 1,
                    sensitivity: .medium,
                    isHapticFeedbackEnabled: true
                )

            case .done:
                VStack(spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 44))
                        .foregroundColor(.green)
                    Text("Logged!")
                        .font(.headline)
                    Text("\(formattedWeight)kg × \(finalReps)")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                .onAppear {
                    WKInterfaceDevice.current().play(.success)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { dismiss() }
                }
            }
        }
        .navigationTitle(exercise.name)
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { detector.stop() }
        .alert("Network error — set not saved", isPresented: $postError) {
            Button("OK") {}
        }
    }

    private var formattedWeight: String {
        weightKg.truncatingRemainder(dividingBy: 1) == 0
            ? "\(Int(weightKg))"
            : String(format: "%.1f", weightKg)
    }
}
