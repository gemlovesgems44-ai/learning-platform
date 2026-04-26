<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/module-feedback.php
require_once __DIR__ . '/../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true) ?: [];

function resolveDb() {
    foreach (['conn', 'pdo', 'db', 'mysqli', 'database', 'connection'] as $k) {
        if (isset($GLOBALS[$k])) return $GLOBALS[$k];
    }
    if (function_exists('getDatabaseConnection')) return getDatabaseConnection();
    if (function_exists('getConnection')) return getConnection();
    if (class_exists('Database')) {
        $obj = new Database();
        if (method_exists($obj, 'getConnection')) return $obj->getConnection();
    }
    return null;
}

$database = resolveDb();
if (!($database instanceof PDO)) {
    http_response_code(500);
    echo json_encode(["message" => "Database connection not initialized"]);
    exit;
}

try {
    $userId = (int)($data['userId'] ?? 0);
    $moduleId = (int)($data['moduleId'] ?? 0);
    $easeOfUse = isset($data['easeOfUse']) ? (int)$data['easeOfUse'] : null;
    $coachHelpfulness = isset($data['coachHelpfulness']) ? (int)$data['coachHelpfulness'] : null;
    $confidenceImprovement = isset($data['confidenceImprovement']) ? (int)$data['confidenceImprovement'] : null;
    $difficulties = trim((string)($data['difficulties'] ?? ''));

    if ($userId <= 0 || $moduleId <= 0) {
        http_response_code(400);
        echo json_encode(["message" => "Missing userId or moduleId"]);
        exit;
    }

    $stmt = $database->prepare("
        INSERT INTO module_feedback (user_id, module_id, ease_of_use, coach_helpfulness, confidence_improvement, difficulties)
        VALUES (:user_id, :module_id, :ease_of_use, :coach_helpfulness, :confidence_improvement, :difficulties)
    ");

    $stmt->execute([
        ':user_id' => $userId,
        ':module_id' => $moduleId,
        ':ease_of_use' => $easeOfUse,
        ':coach_helpfulness' => $coachHelpfulness,
        ':confidence_improvement' => $confidenceImprovement,
        ':difficulties' => $difficulties
    ]);

    echo json_encode(["message" => "Feedback saved successfully"]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error saving feedback: " . $e->getMessage()]);
}