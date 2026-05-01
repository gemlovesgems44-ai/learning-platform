<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/suggestions.php
require_once '../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

$userId = isset($_GET['userId']) ? (int)$_GET['userId'] : 0;
if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(["message" => "User ID required"]);
    exit;
}

$database = new Database();
$db = $database->getConnection();

if ($db === null) {
    http_response_code(500);
    echo json_encode(["message" => "Database connection failed"]);
    exit;
}

try {
    // Modules not fully completed
    $query = "
        SELECT 
            m.id,
            m.title,
            m.description,
            COUNT(DISTINCT l.id) AS total_lessons,
            COUNT(DISTINCT CASE WHEN p.lesson_id IS NOT NULL THEN l.id END) AS completed_lessons
        FROM modules m
        LEFT JOIN lessons l ON l.module_id = m.id
        LEFT JOIN progress p 
            ON p.lesson_id = l.id
           AND p.user_id = :userId
        GROUP BY m.id, m.title, m.description
        HAVING total_lessons > 0 AND completed_lessons < total_lessons
        ORDER BY completed_lessons ASC, total_lessons ASC, m.id ASC
        LIMIT 3
    ";

    $stmt = $db->prepare($query);
    $stmt->bindValue(':userId', $userId, PDO::PARAM_INT);
    $stmt->execute();
    $suggestions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fallback: if everything appears complete, still return top modules
    if (count($suggestions) === 0) {
        $fallback = $db->query("SELECT id, title, description FROM modules ORDER BY id ASC LIMIT 3");
        $suggestions = $fallback->fetchAll(PDO::FETCH_ASSOC);
    }

    // All modules for AI context
    $allModules = $db->query("SELECT id, title FROM modules ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);

    // Completed module ids for this user
    $completedStmt = $db->prepare("
        SELECT DISTINCT l.module_id
        FROM progress p
        JOIN lessons l ON l.id = p.lesson_id
        WHERE p.user_id = :userId AND p.completed = 1
    ");
    $completedStmt->execute([':userId' => $userId]);
    $completedModuleIds = array_column($completedStmt->fetchAll(PDO::FETCH_ASSOC), 'module_id');

    $completedModules = array_values(array_filter($allModules, fn($m) => in_array($m['id'], $completedModuleIds)));
    $availableModules = array_values(array_filter($allModules, fn($m) => !in_array($m['id'], $completedModuleIds)));

    // Practice success rate
    $practiceStmt = $db->prepare("
        SELECT 
            COALESCE(ROUND((SUM(correct_attempts) * 100.0) / NULLIF(SUM(attempts), 0), 2), 0) AS rate
        FROM progress
        WHERE user_id = :userId AND attempts > 0
    ");
    $practiceStmt->execute([':userId' => $userId]);
    $practiceSuccessRate = (float)($practiceStmt->fetchColumn() ?? 0);

    // Average confidence
    $confStmt = $db->prepare("
        SELECT COALESCE(ROUND(AVG(confidence_after - confidence_before), 2), 0) AS avg_improvement
        FROM progress
        WHERE user_id = :userId
          AND confidence_before IS NOT NULL
          AND confidence_after IS NOT NULL
    ");
    $confStmt->execute([':userId' => $userId]);
    $avgConfidenceImprovement = (float)($confStmt->fetchColumn() ?? 0);

    // AI suggestion via ai_coach.php (server-side curl)
    $aiSuggestion = null;
    $apiKey = getenv('OPENAI_API_KEY');

    if ($apiKey && count($availableModules) > 0) {
        $systemPrompt = "You are a supportive digital skills coach recommending the next learning module.\nRules:\n- Use plain English.\n- Be encouraging and practical.\n- Base your recommendation only on the data provided.\n- Do not invent modules not listed in available modules.\n- Respond with a JSON object only: {\"moduleTitle\": \"...\", \"reason\": \"1-2 sentences why\"}";

        $completedList = implode(', ', array_column($completedModules, 'title')) ?: 'None yet';
        $availableList = implode(', ', array_map(fn($m) => $m['id'] . ': ' . $m['title'], $availableModules));

        $userPrompt = "Completed modules: {$completedList}\n"
            . "Practice success rate: {$practiceSuccessRate}%\n"
            . "Average confidence improvement: {$avgConfidenceImprovement}\n"
            . "Available modules to recommend from:\n{$availableList}\n"
            . "Which single module should this user do next and why?";

        $requestBody = json_encode([
            'model' => getenv('OPENAI_MODEL') ?: 'gpt-4.1-mini',
            'input' => [
                ['role' => 'system', 'content' => [['type' => 'input_text', 'text' => $systemPrompt]]],
                ['role' => 'user', 'content' => [['type' => 'input_text', 'text' => $userPrompt]]]
            ],
            'temperature' => 0.4,
            'max_output_tokens' => 180
        ]);

        $ch = curl_init('https://api.openai.com/v1/responses');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json'
            ],
            CURLOPT_POSTFIELDS => $requestBody,
            CURLOPT_TIMEOUT => 20
        ]);

        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw && $httpCode < 400) {
            $res = json_decode($raw, true) ?: [];
            $answer = trim((string)($res['output_text'] ?? ''));

            if ($answer === '' && !empty($res['output'])) {
                foreach ($res['output'] as $out) {
                    foreach (($out['content'] ?? []) as $c) {
                        if (($c['type'] ?? '') === 'output_text' && !empty($c['text'])) {
                            $answer = trim((string)$c['text']);
                            break 2;
                        }
                    }
                }
            }

            $decoded = json_decode($answer, true);
            if (is_array($decoded) && isset($decoded['moduleTitle'])) {
                $aiSuggestion = $decoded;
            }
        } else {
        }
    }

    echo json_encode([
        'suggestions' => $suggestions,
        'aiSuggestion' => $aiSuggestion  // { moduleTitle, reason } or null
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}
?>