import SwiftUI

struct SetupView: View {
    let exercise: Exercise
    @State private var weight: Double = 20.0

    private var displayWeight: String {
        weight.truncatingRemainder(dividingBy: 1) == 0
            ? "\(Int(weight))"
            : String(format: "%.1f", weight)
    }

    var body: some View {
        VStack(spacing: 6) {
            Spacer()

            Text(displayWeight)
                .font(.system(size: 48, weight: .bold, design: .rounded))
                .contentTransition(.numericText())
                .animation(.snappy, value: weight)

            Text("kg  ·  scroll crown")
                .font(.caption2)
                .foregroundStyle(.secondary)

            Spacer()

            NavigationLink("Start Set  ▶", destination: ActiveSetView(exercise: exercise, weightKg: weight))
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .buttonBorderShape(.capsule)
        }
        .padding(.horizontal)
        .navigationTitle(exercise.name)
        .navigationBarTitleDisplayMode(.inline)
        .focusable(true)
        .digitalCrownRotation(
            $weight,
            from: 0.0, through: 300.0, by: 2.5,
            sensitivity: .medium,
            isContinuous: false,
            isHapticFeedbackEnabled: true
        )
    }
}
