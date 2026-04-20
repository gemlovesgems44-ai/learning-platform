<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/lessons.php
require_once __DIR__ . '/../config/database.php';

// Normalize DB handle from common patterns.
if (!isset($db)) {
    if (isset($pdo) && $pdo instanceof PDO) {
        $db = $pdo;
    } elseif (isset($conn) && $conn instanceof PDO) {
        $db = $conn;
    } elseif (function_exists('getDbConnection')) {
        $tmp = getDbConnection();
        if ($tmp instanceof PDO) $db = $tmp;
    } elseif (function_exists('getConnection')) {
        $tmp = getConnection();
        if ($tmp instanceof PDO) $db = $tmp;
    } elseif (class_exists('Database')) {
        $database = new Database();
        if (method_exists($database, 'getConnection')) {
            $tmp = $database->getConnection();
            if ($tmp instanceof PDO) $db = $tmp;
        } elseif (method_exists($database, 'connect')) {
            $tmp = $database->connect();
            if ($tmp instanceof PDO) $db = $tmp;
        }
    }
}

if (!isset($db) || !($db instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Database connection not initialized']);
    exit;
}

header('Content-Type: application/json');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['message' => 'Method not allowed']);
        exit;
    }

    $moduleId = isset($_GET['moduleId']) ? (int)$_GET['moduleId'] : 0;
    
    if ($moduleId <= 0) {
        http_response_code(400);
        echo json_encode(['message' => 'Valid moduleId is required']);
        exit;
    }

    // Detect table name: lessons or lesson
    $table = null;
    foreach (['lessons', 'lesson'] as $candidate) {
        $t = $db->prepare("SHOW TABLES LIKE :t");
        $t->execute([':t' => $candidate]);
        if ($t->fetch()) { $table = $candidate; break; }
    }

    if (!$table) {
        throw new RuntimeException('Neither "lessons" nor "lesson" table exists.');
    }

    // Detect available columns
    $cstmt = $db->query("SHOW COLUMNS FROM `{$table}`");
    $cols = $cstmt->fetchAll(PDO::FETCH_COLUMN, 0);
    $colSet = array_flip($cols);

    $wanted = [
        'id',
        'module_id',
        'title',
        'content',
        'task_type',
        'task_data',
        'order_index',
        'created_at'
    ];

    $selectCols = array_values(array_filter($wanted, fn($c) => isset($colSet[$c])));
    if (empty($selectCols)) {
        throw new RuntimeException("No expected columns found in {$table}.");
    }

    $selectSql = implode(",\n                ", array_map(fn($c) => "l.`{$c}`", $selectCols));
    $orderSql = isset($colSet['order_index']) ? "COALESCE(l.`order_index`, l.`id`) ASC" : "l.`id` ASC";

    $sql = "SELECT 
                {$selectSql}
            FROM `{$table}` l
            WHERE l.`module_id` = :moduleId
            ORDER BY {$orderSql}";

    $stmt = $db->prepare($sql);
    $stmt->execute([':moduleId' => $moduleId]);
    $lessons = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($lessons);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'message' => 'Failed to load lessons',
        'error' => $e->getMessage()
    ]);
}