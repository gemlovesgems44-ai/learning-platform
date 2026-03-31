<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/lessons.php
require_once '../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

// Create database connection.
$database = new Database();
$db = $database->getConnection();

// Stop early if database connection failed.
if ($db === null) {
    http_response_code(500);
    echo json_encode(["message" => "Database connection failed"]);
    exit;
}

// Helper: check whether a table contains a given column.
// Used so this API can support slightly different database schemas.
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

// Only allow GET requests for reading lesson data.
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
    exit;
}

// Read optional query parameters from the URL.
// $courseId = isset($_GET['courseId']) ? (int)$_GET['courseId'] : 0;
$moduleId = isset($_GET['moduleId']) ? (int)$_GET['moduleId'] : 0;

try {
    // If a specific module ID is provided, return only lessons for that module.
    if ($moduleId > 0) {
        $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
                FROM lessons l
                WHERE l.module_id = :moduleId
                ORDER BY l.id ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute([':moduleId' => $moduleId]);

    // Otherwise, if a course ID is provided, try to return lessons for that course.
    // } elseif ($courseId > 0) {

    //     // Preferred schema: modules table contains course_id.
    //     if (hasColumn($db, 'modules', 'course_id')) {
    //         $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
    //                 FROM lessons l
    //                 INNER JOIN modules m ON m.id = l.module_id
    //                 WHERE m.course_id = :courseId
    //                 ORDER BY m.id ASC, l.id ASC";
    //         $stmt = $db->prepare($sql);
    //         $stmt->execute([':courseId' => $courseId]);

        // // Alternative schema: lessons table contains course_id directly.
        // } elseif (hasColumn($db, 'lessons', 'course_id')) {
        //     $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
        //             FROM lessons l
        //             WHERE l.course_id = :courseId
        //             ORDER BY l.id ASC";
        //     $stmt = $db->prepare($sql);
        //     $stmt->execute([':courseId' => $courseId]);

        // // Fallback for current schema: return all lessons instead of failing.
        // } else {
        //     $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
        //             FROM lessons l
        //             ORDER BY l.id ASC";
        //     $stmt = $db->prepare($sql);
        //     $stmt->execute();
        // }

    // If no filters are provided, return all lessons.
    } else {
        $sql = "SELECT l.id, l.module_id, l.title, l.content, l.created_at
                FROM lessons l
                ORDER BY l.id ASC";
        $stmt = $db->prepare($sql);
        $stmt->execute();
    }

    // Send lesson data back as JSON.
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));

} catch (Throwable $e) {
    // Return a server error if the query fails.
    http_response_code(500);
    echo json_encode([
        "message" => "Database error",
        "error" => $e->getMessage()
    ]);
}
?>