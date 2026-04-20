<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/progress.php
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json');

try {
    // Resolve PDO from common config patterns
    $db = $db ?? null;

    if (!($db instanceof PDO)) {
        if (isset($pdo) && $pdo instanceof PDO) $db = $pdo;
        elseif (isset($conn) && $conn instanceof PDO) $db = $conn;
        elseif (isset($database) && $database instanceof PDO) $db = $database;
        elseif (function_exists('getDbConnection')) {
            $tmp = getDbConnection();
            if ($tmp instanceof PDO) $db = $tmp;
        } elseif (function_exists('getConnection')) {
            $tmp = getConnection();
            if ($tmp instanceof PDO) $db = $tmp;
        } elseif (class_exists('Database')) {
            $instance = new Database();
            if (method_exists($instance, 'getConnection')) {
                $tmp = $instance->getConnection();
                if ($tmp instanceof PDO) $db = $tmp;
            } elseif (method_exists($instance, 'connect')) {
                $tmp = $instance->connect();
                if ($tmp instanceof PDO) $db = $tmp;
            }
        }
    }

    if (!($db instanceof PDO)) {
        throw new RuntimeException('Database connection not initialized');
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed']);
        exit;
    }

    $userId = isset($_GET['userId']) ? (int)$_GET['userId'] : 0;
    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(['message' => 'Valid userId is required']);
        exit;
    }

    // Detect lessons table
    $lessonTable = null;
    foreach (['lessons', 'lesson'] as $t) {
        $s = $db->prepare("SHOW TABLES LIKE :t");
        $s->execute([':t' => $t]);
        if ($s->fetch()) { $lessonTable = $t; break; }
    }
    if (!$lessonTable) {
        throw new RuntimeException('No lessons table found');
    }

    // Detect progress table
    $progressTable = null;
    foreach (['lesson_progress', 'progress', 'user_progress'] as $t) {
        $s = $db->prepare("SHOW TABLES LIKE :t");
        $s->execute([':t' => $t]);
        if ($s->fetch()) { $progressTable = $t; break; }
    }
    if (!$progressTable) {
        throw new RuntimeException('No progress table found');
    }

    $cols = $db->query("SHOW COLUMNS FROM `{$progressTable}`")->fetchAll(PDO::FETCH_COLUMN, 0);
    $colSet = array_flip($cols);

    $userCol      = isset($colSet['user_id']) ? 'user_id' : (isset($colSet['userid']) ? 'userid' : null);
    $lessonCol    = isset($colSet['lesson_id']) ? 'lesson_id' : (isset($colSet['lessonid']) ? 'lessonid' : null);
    $completedAt  = isset($colSet['completed_at']) ? 'completed_at' : (isset($colSet['updated_at']) ? 'updated_at' : null);
    $wrongCol     = isset($colSet['wrong_attempts']) ? 'wrong_attempts' : (isset($colSet['mistakes']) ? 'mistakes' : null);
    $accuracyCol  = isset($colSet['accuracy']) ? 'accuracy' : (isset($colSet['score']) ? 'score' : null);
    $completedCol = isset($colSet['completed']) ? 'completed' : null;

    if (!$userCol || !$lessonCol) {
        throw new RuntimeException("Progress table '{$progressTable}' missing user/lesson columns");
    }

    $whereCompleted = $completedCol ? " AND COALESCE(p.`{$completedCol}`, 0) = 1" : "";

    $sql = "
        SELECT
            l.`module_id` AS module_id,
            l.`title` AS lesson_title,
            " . ($completedAt ? "p.`{$completedAt}`" : "NULL") . " AS completed_at,
            " . ($wrongCol ? "COALESCE(p.`{$wrongCol}`, 0)" : "0") . " AS wrong_attempts,
            " . ($accuracyCol ? "p.`{$accuracyCol}`" : "NULL") . " AS accuracy
        FROM `{$progressTable}` p
        INNER JOIN `{$lessonTable}` l
            ON l.`id` = p.`{$lessonCol}`
        WHERE p.`{$userCol}` = :userId
        {$whereCompleted}
        ORDER BY " . ($completedAt ? "p.`{$completedAt}` DESC" : "l.`id` DESC") . "
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute([':userId' => $userId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($rows);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'message' => 'Failed to load progress',
        'error' => $e->getMessage()
    ]);
}