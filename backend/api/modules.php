<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/modules.php
declare(strict_types=1);

// Be tolerant about config location.
$configA = __DIR__ . '/../config/database.php';
$configB = __DIR__ . '/../../config/database.php';

if (file_exists($configA)) {
    require_once $configA;
} elseif (file_exists($configB)) {
    require_once $configB;
} else {
    http_response_code(500);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['message' => 'database.php not found']);
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

try {
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        throw new Exception('Database connection failed');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $moduleId = isset($_GET['moduleId']) ? (int)$_GET['moduleId'] : 0;

        if ($moduleId > 0) {
            $stmt = $db->prepare("SELECT * FROM modules WHERE id = :moduleId");
            $stmt->execute([':moduleId' => $moduleId]);
        } else {
            $stmt = $db->query("SELECT * FROM modules");
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $modules = array_map(function ($r) {
            return [
                'id' => $r['id'] ?? $r['module_id'] ?? null,
                'moduleId' => $r['id'] ?? $r['module_id'] ?? null,
                'title' => $r['title'] ?? $r['name'] ?? 'Module',
                'description' => $r['description'] ?? $r['content'] ?? ''
            ];
        }, $rows);

        echo json_encode($modules);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $moduleId = (int)($data['moduleId'] ?? 0);
        $userId = (int)($data['userId'] ?? 0);

        if ($moduleId <= 0 || $userId <= 0) {
            http_response_code(400);
            echo json_encode(['message' => 'moduleId and userId are required']);
            exit;
        }

        $stmt = $db->prepare("
            INSERT INTO course_completions (user_id, moduleId, completed_at)
            VALUES (:userId, :moduleId, NOW())
            ON DUPLICATE KEY UPDATE completed_at = NOW()
        ");
        $stmt->execute([':userId' => $userId, ':moduleId' => $moduleId]);

        http_response_code(201);
        echo json_encode(['message' => 'Module completion saved']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'message' => 'Server error',
        'error' => $e->getMessage()
    ]);
}