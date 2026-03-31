<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/progress.php
require_once '../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

$database = new Database();
$db = $database->getConnection();

if ($db === null) {
    http_response_code(500);
    echo json_encode(["message" => "Database connection failed"]);
    exit;
}

function hasColumn(PDO $db, string $table, string $column): bool {
    $sql = "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column";
    $stmt = $db->prepare($sql);
    $stmt->execute([':table' => $table, ':column' => $column]);
    return (int)$stmt->fetchColumn() > 0;
}

try {
    $hasCompleted   = hasColumn($db, 'progress', 'completed');
    $hasCompletedAt = hasColumn($db, 'progress', 'completed_at');
    $hasCreatedAt   = hasColumn($db, 'progress', 'created_at');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $userId = $_GET['userId'] ?? null;
        if (!$userId) {
            http_response_code(400);
            echo json_encode(["message" => "User ID required"]);
            exit;
        }

        $dateExpr = $hasCompletedAt
            ? "p.completed_at"
            : ($hasCreatedAt ? "p.created_at" : "NULL");

        $where = "p.user_id = :userId";
        if ($hasCompleted) {
            $where .= " AND p.completed = 1";
        }

        $query = "SELECT p.id, COALESCE(l.title, 'Lesson') AS lessonTitle, {$dateExpr} AS completed_at
                  FROM progress p
                  LEFT JOIN lessons l ON p.lesson_id = l.id
                  WHERE {$where}
                  ORDER BY " . ($hasCompletedAt ? "p.completed_at" : "p.id") . " DESC";

        $stmt = $db->prepare($query);
        $stmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $stmt->execute();

        $progress = $stmt->fetchAll(PDO::FETCH_ASSOC);
        http_response_code(200);
        echo json_encode($progress ?: []);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents("php://input"));

        if (!isset($data->userId) || !isset($data->lessonId)) {
            http_response_code(400);
            echo json_encode(["message" => "User ID and Lesson ID required"]);
            exit;
        }

        $userId = (int)$data->userId;
        $lessonId = (int)$data->lessonId;

        if ($userId <= 0 || $lessonId <= 0) {
            http_response_code(400);
            echo json_encode(["message" => "Valid userId and lessonId required"]);
            exit;
        }

        $checkSql = "SELECT id FROM progress WHERE user_id = :userId AND lesson_id = :lessonId LIMIT 1";
        $checkStmt = $db->prepare($checkSql);
        $checkStmt->execute([
            ':userId' => $userId,
            ':lessonId' => $lessonId
        ]);

        if ($checkStmt->fetch(PDO::FETCH_ASSOC)) {
            http_response_code(200);
            echo json_encode(["message" => "Progress already saved"]);
            exit;
        }

        $columns = ["user_id", "lesson_id"];
        $values  = [":userId", ":lessonId"];
        $params  = [
            ':userId' => $userId,
            ':lessonId' => $lessonId
        ];

        if ($hasCompleted) {
            $columns[] = "completed";
            $values[]  = ":completed";
            $params[':completed'] = 1;
        }
        if ($hasCompletedAt) {
            $columns[] = "completed_at";
            $values[]  = "NOW()";
        }

        $sql = "INSERT INTO progress (" . implode(", ", $columns) . ")
                VALUES (" . implode(", ", $values) . ")";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        http_response_code(201);
        echo json_encode(["message" => "Progress saved"]);
        exit;
    }

    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}
?>