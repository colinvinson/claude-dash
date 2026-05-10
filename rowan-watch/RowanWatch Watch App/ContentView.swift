import SwiftUI

struct ContentView: View {
    @State private var exercises: [Exercise] = []
    @State private var selectedSplit = "Push"
    @State private var isLoading = true

    let splits = ["Push", "Pull", "Legs"]

    var filtered: [Exercise] {
        exercises.filter { ($0.split_day ?? "") == selectedSplit }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $selectedSplit) {
                    ForEach(splits, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.wheel)
                .frame(height: 52)

                if isLoading {
                    Spacer()
                    ProgressView("Loading…").padding()
                    Spacer()
                } else if filtered.isEmpty {
                    Spacer()
                    Text("No exercises for \(selectedSplit)")
                        .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center).padding()
                    Spacer()
                } else {
                    List(filtered) { ex in
                        NavigationLink(destination: SetupView(exercise: ex)) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(ex.name)
                                    .font(.system(size: 14, weight: .medium))
                                if let g = ex.muscle_group {
                                    Text(g).font(.system(size: 11)).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Rowan")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            exercises = await APIClient.fetchExercises()
            isLoading = false
        }
    }
}
