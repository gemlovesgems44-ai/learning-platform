<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/lessons.php
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
    $sql = "SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table
              AND COLUMN_NAME = :column";
    $stmt = $db->prepare($sql);
    $stmt->execute([
        ':table' => $table,
        ':column' => $column
    ]);
    return (int)$stmt->fetchColumn() > 0;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
    exit;
}

$courseId = isset($_GET['courseId']) ? (int)$_GET['courseId'] : 0;
$moduleId = isset($_GET['moduleId']) ? (int)$_GET['moduleId'] : 0;

try {
    if ($moduleId > 0) {
        $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
                FROM lessons l
                WHERE l.module_id = :moduleId
                ORDER BY l.id ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute([':moduleId' => $moduleId]);
    } elseif ($courseId > 0) {
        if (hasColumn($db, 'modules', 'course_id')) {
            $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
                    FROM lessons l
                    INNER JOIN modules m ON m.id = l.module_id
                    WHERE m.course_id = :courseId
                    ORDER BY m.id ASC, l.id ASC";
            $stmt = $db->prepare($sql);
            $stmt->execute([':courseId' => $courseId]);
        } elseif (hasColumn($db, 'lessons', 'course_id')) {
            $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
                    FROM lessons l
                    WHERE l.course_id = :courseId
                    ORDER BY l.id ASC";
            $stmt = $db->prepare($sql);
            $stmt->execute([':courseId' => $courseId]);
        } else {
            // fallback for current schema: return all lessons instead of throwing 500
            $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
                    FROM lessons l
                    ORDER BY l.id ASC";
            $stmt = $db->prepare($sql);
            $stmt->execute();
        }
    } else {
        $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
                FROM lessons l
                ORDER BY l.id ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute();
    }

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "message" => "Database error",
        "error" => $e->getMessage()
    ]);
}
?>