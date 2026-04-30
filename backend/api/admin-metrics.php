<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/admin-metrics.php
require_once __DIR__ . '/../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
    exit;
}

/**
 * Resolve DB connection from multiple common patterns:
 * - $conn / $pdo / $db / $mysqli / $database / $connection
 * - function getConnection() / getDatabaseConnection()
 * - class Database->getConnection()
 */
$database = null;

// 1) Direct globals
foreach (['conn', 'pdo', 'db', 'mysqli', 'database', 'connection'] as $name) {
    if (isset($GLOBALS[$name])) {
        $database = $GLOBALS[$name];
        break;
    }
}

// 2) Function-based connection
if (!$database && function_exists('getDatabaseConnection')) {
    $database = getDatabaseConnection();
}
if (!$database && function_exists('getConnection')) {
    $database = getConnection();
}

// 3) Class-based connection
if (
    !$database &&
    class_exists('Database')
) {
    $dbObj = new Database();
    if (method_exists($dbObj, 'getConnection')) {
        $database = $dbObj->getConnection();
    }
}

$isPdo = $database instanceof PDO;
$isMysqli = class_exists('mysqli') && $database instanceof mysqli;

if (!$isPdo && !$isMysqli) {
    http_response_code(500);
    echo json_encode([
        "message" => "Database connection not initialized",
        "hint" => "Check backend/config/database.php export (e.g. \$conn, \$pdo, getConnection())"
    ]);
    exit;
}

if ($isPdo) {
    $database->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
}

function scalar($database, string $sql, $default = 0) {
    try {
        if ($database instanceof PDO) {
            $v = $database->query($sql)->fetchColumn();
            return ($v === false || $v === null || $v === '') ? $default : $v;
        }
        if (class_exists('mysqli') && $database instanceof mysqli) {
            $result = $database->query($sql);
            if (!$result) return $default;
            $row = $result->fetch_row();
            return (!$row || !isset($row[0]) || $row[0] === null || $row[0] === '') ? $default : $row[0];
        }
    } catch (Throwable $e) {
        return $default;
    }
    return $default;
}

try {
    $totalUsers = (int) scalar($database, "SELECT COUNT(*) FROM users", 0);

    $totalCompletedLessons = (int) scalar(
        $database,
        "SELECT COUNT(*) FROM progress WHERE completed = 1",
        (int) scalar($database, "SELECT COUNT(*) FROM progress", 0)
    );

    $moduleCompletionPercent = (float) scalar(
        $database,
        "SELECT ROUND(AVG(completed) * 100, 2) FROM progress",
        0
    );

    $mostPopularModule = (string) scalar($database, "
        SELECT m.title
        FROM modules m
        JOIN lessons l ON l.module_id = m.id
        JOIN progress p ON p.lesson_id = l.id
        GROUP BY m.id, m.title
        ORDER BY COUNT(*) DESC
        LIMIT 1
    ", "-");

    $leastCompletedModule = (string) scalar($database, "
        SELECT m.title
        FROM modules m
        LEFT JOIN lessons l ON l.module_id = m.id
        LEFT JOIN progress p ON p.lesson_id = l.id
        GROUP BY m.id, m.title
        ORDER BY COUNT(p.lesson_id) ASC
        LIMIT 1
    ", "-");

    $averageConfidenceImprovement = (float) scalar(
        $database,
        "SELECT ROUND(AVG(confidence_after - confidence_before), 2) 
         FROM progress 
         WHERE confidence_before IS NOT NULL 
         AND confidence_after IS NOT NULL",
        0
    );

    $practiceSuccessRate = (float) scalar(
        $database,
        "SELECT ROUND(
            (SUM(correct_attempts) * 100.0) / NULLIF(SUM(attempts), 0)
        , 2)
        FROM progress
        WHERE attempts > 0",
        0
    );

    // NEW: Check for lessonPerformance query param
    $lessonPerformance = [];
    if (!empty($_GET['include']) && $_GET['include'] === 'lessonPerformance') {
        try {
            $sql = "
                SELECT 
                    u.username,
                    l.title AS lesson_title,
                    COALESCE(p.last_score, 0) AS lesson_score,
                    COALESCE(p.attempts, 0) AS attempts,
                    CASE 
                        WHEN COALESCE(p.completed, 0) = 1 OR COALESCE(p.last_score, 0) >= 70 THEN 'Pass'
                        ELSE 'Fail'
                    END AS pass_fail,
                    GREATEST(COALESCE(p.attempts, 0) - 1, 0) AS retry_count,
                    p.last_attempt_at
                FROM progress p
                INNER JOIN (
                    SELECT MAX(id) AS id
                    FROM progress
                    GROUP BY user_id, lesson_id
                ) latest ON latest.id = p.id
                JOIN users u ON u.id = p.user_id
                JOIN lessons l ON l.id = p.lesson_id
                ORDER BY p.last_attempt_at DESC, p.id DESC
                LIMIT 200
            ";

            if ($isPdo) {
                $stmt = $database->query($sql);
                $lessonPerformance = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } else {
                $result = $database->query($sql);
                $lessonPerformance = [];
                while ($row = $result->fetch_assoc()) {
                    $lessonPerformance[] = $row;
                }
            }
        } catch (Throwable $e) {
            error_log("lesson performance error: " . $e->getMessage());
        }
    }

    // Parse include flags safely (supports: ?include=lessonPerformance or ?include=lessonPerformance,moduleBreakdown)
    $includeRaw = isset($_GET['include']) ? (string)$_GET['include'] : '';
    $includeParts = array_filter(array_map('trim', explode(',', $includeRaw)));
    $includeMap = array_fill_keys($includeParts, true);
    $wantLessonPerformance = isset($includeMap['lessonPerformance']) || $includeRaw === '';

    $moduleBreakdown = [];

    if ($isPdo) {
        $stmt = $database->query("
            SELECT
                m.id,
                m.title,
                COALESCE(SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END), 0) AS completed_count
            FROM modules m
            LEFT JOIN lessons l ON l.module_id = m.id
            LEFT JOIN progress p ON p.lesson_id = l.id
            GROUP BY m.id, m.title
            ORDER BY m.id ASC
        ");
        $moduleBreakdown = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    } else {
        $result = $database->query("
            SELECT
                m.id,
                m.title,
                COALESCE(SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END), 0) AS completed_count
            FROM modules m
            LEFT JOIN lessons l ON l.module_id = m.id
            LEFT JOIN progress p ON p.lesson_id = l.id
            GROUP BY m.id, m.title
            ORDER BY m.id ASC
        ");
        while ($result && ($row = $result->fetch_assoc())) {
            $moduleBreakdown[] = $row;
        }
    }

    echo json_encode([
        "totalUsers" => $totalUsers,
        "totalCompletedLessons" => $totalCompletedLessons,
        "moduleCompletionPercent" => $moduleCompletionPercent,
        "mostPopularModule" => $mostPopularModule ?: "-",
        "mostPopularModuleCount" => $mostPopularModuleCount ?? 0,
        "leastCompletedModule" => $leastCompletedModule ?: "-",
        "leastCompletedModuleCount" => $leastCompletedModuleCount ?? 0,
        "averageConfidenceImprovement" => $averageConfidenceImprovement,
        "practiceSuccessRate" => $practiceSuccessRate,
        "moduleBreakdown" => $moduleBreakdown,
        "lessonPerformance" => $lessonPerformance
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        "message" => "Failed to load admin stats",
        "error" => $e->getMessage()
    ]);
}