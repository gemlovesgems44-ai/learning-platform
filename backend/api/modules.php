<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/modules.php

// ...existing code...
declare(strict_types=1);

// Be tolerant about config location.
$configA = __DIR__ . '/../config/database.php';       // backend/config/database.php
$configB = __DIR__ . '/../../config/database.php';    // config/database.php (project root)

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
        $courseId = isset($_GET['courseId']) ? (int)$_GET['courseId'] : 0;

        // modules table uses `id`
        if ($courseId > 0) {
            $stmt = $db->prepare("SELECT * FROM modules WHERE id = :courseId");
            $stmt->execute([':courseId' => $courseId]);
        } else {
            $stmt = $db->query("SELECT * FROM modules");
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Normalize output expected by lesson.js
        $modules = array_map(function ($r) {
            return [
                'id' => $r['id'] ?? $r['module_id'] ?? null,
                'course_id' => null,
                'title' => $r['title'] ?? $r['name'] ?? 'Module',
                'description' => $r['description'] ?? $r['content'] ?? ''
            ];
        }, $rows);

        echo json_encode($modules);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $courseId = (int)($data['courseId'] ?? 0);
        $userId = (int)($data['userId'] ?? 0);

        if ($courseId <= 0 || $userId <= 0) {
            http_response_code(400);
            echo json_encode(['message' => 'courseId and userId are required']);
            exit;
        }

        $stmt = $db->prepare("
            INSERT INTO course_completions (user_id, course_id, completed_at)
            VALUES (:userId, :courseId, NOW())
            ON DUPLICATE KEY UPDATE completed_at = NOW()
        ");
        $stmt->execute([':userId' => $userId, ':courseId' => $courseId]);

        http_response_code(201);
        echo json_encode(['message' => 'Course completion saved']);
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