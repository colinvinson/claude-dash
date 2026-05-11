import Foundation

struct Exercise: Identifiable, Codable {
    let id: String
    let name: String
    let split_day: String?
    let muscle_group: String?
    let exercise_type: String?   // "Compound" | "Secondary" | "Isolation" — used for rep threshold tuning
}

enum APIClient {
    static func fetchExercises() async -> [Exercise] {
        guard var comps = URLComponents(string: "\(Constants.apiBase)/api/workouts/exercises") else { return [] }
        comps.queryItems = [
            .init(name: "user_id", value: Constants.userId),
            .init(name: "api_key", value: Constants.apiKey),
        ]
        guard let url = comps.url else { return [] }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            return (try? JSONDecoder().decode([Exercise].self, from: data)) ?? []
        } catch { return [] }
    }

    static func logSet(exercise: Exercise, weightKg: Double, reps: Int) async -> Bool {
        guard let url = URL(string: "\(Constants.apiBase)/api/workouts/log-set") else { return false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "exercise_id": exercise.id,
            "split_day":   exercise.split_day ?? "",
            "weight_kg":   weightKg,
            "reps":        reps,
            "user_id":     Constants.userId,
            "api_key":     Constants.apiKey,
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (_, resp) = try await URLSession.shared.data(for: req)
            return (resp as? HTTPURLResponse)?.statusCode == 200
        } catch { return false }
    }
}
