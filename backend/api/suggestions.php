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
    // Suggest modules the user has NOT fully completed.
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

    // Fallback: if everything appears complete, still return top modules.
    if (count($suggestions) === 0) {
        $fallback = $db->query("SELECT id, title, description FROM modules ORDER BY id ASC LIMIT 3");
        $suggestions = $fallback->fetchAll(PDO::FETCH_ASSOC);
    }

    echo json_encode($suggestions);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database error: " . $e->getMessage()]);
}
?>