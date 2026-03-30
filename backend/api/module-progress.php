<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/module-progress.php
require_once '../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

$database = new Database();
$db = $database->getConnection();

if ($db === null) {
    http_response_code(500);
    echo json_encode(["message" => "Database connection failed"]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = isset($_GET['userId']) ? (int)$_GET['userId'] : 0;
    $courseId = isset($_GET['courseId']) ? (int)$_GET['courseId'] : 0;

    if ($userId <= 0 || $courseId <= 0) {
        http_response_code(400);
        echo json_encode(["message" => "userId and courseId are required"]);
        exit;
    }

    try {
        $sql = "SELECT mp.module_id
                FROM module_progress mp
                INNER JOIN modules m ON m.id = mp.module_id
                WHERE mp.user_id = :userId AND m.id = :courseId";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':userId' => $userId,
            ':courseId' => $courseId
        ]);

        $ids = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $ids[] = (int)$row['module_id'];
        }

        echo json_encode(["completedModuleIds" => $ids]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    $userId = isset($data->userId) ? (int)$data->userId : 0;
    $moduleId = isset($data->moduleId) ? (int)$data->moduleId : 0;

    if ($userId <= 0 || $moduleId <= 0) {
        http_response_code(400);
        echo json_encode(["message" => "userId and moduleId are required"]);
        exit;
    }

    try {
        $sql = "INSERT INTO module_progress (user_id, module_id, completed_at)
                VALUES (:userId, :moduleId, NOW())
                ON DUPLICATE KEY UPDATE completed_at = NOW()";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':userId' => $userId,
            ':moduleId' => $moduleId
        ]);

        echo json_encode(["message" => "Progress saved"]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(["message" => "Method not allowed"]);
?>