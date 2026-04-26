<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/progress.php
require_once __DIR__ . '/../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
    exit;
}

function resolveDb() {
    foreach (['conn', 'pdo', 'db', 'mysqli', 'database', 'connection'] as $k) {
        if (isset($GLOBALS[$k])) return $GLOBALS[$k];
    }
    if (function_exists('getDatabaseConnection')) return getDatabaseConnection();
    if (function_exists('getConnection')) return getConnection();
    if (class_exists('Database')) {
        $obj = new Database();
        if (method_exists($obj, 'getConnection')) return $obj->getConnection();
    }
    return null;
}

$database = resolveDb();
$isPdo = $database instanceof PDO;
$isMysqli = class_exists('mysqli') && $database instanceof mysqli;

if (!$isPdo && !$isMysqli) {
    http_response_code(500);
    echo json_encode(["message" => "Database unavailable"]);
    exit;
}

// GET branch can now safely use $database / $isPdo
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = (int)($_GET['userId'] ?? 0);
    if ($userId <= 0) {
        http_response_code(400);
        echo json_encode(["message" => "Missing userId"]);
        exit;
    }

    try {
        if ($isPdo) {
            $stmt = $database->prepare("
                SELECT 
                    p.id,
                    p.user_id,
                    p.lesson_id,
                    p.status,
                    p.completed,
                    COALESCE(p.attempts, 0) AS attempts,
                    COALESCE(p.correct_attempts, 0) AS correct_attempts,
                    COALESCE(p.last_score, 0) AS last_score,
                    COALESCE(p.first_attempt_correct, 0) AS first_attempt_correct,
                    p.confidence_before,
                    p.confidence_after,
                    p.completed_at,
                    p.last_attempt_at,
                    l.title AS lesson_title,
                    l.module_id,
                    m.title AS module_title
                FROM progress p
                LEFT JOIN lessons l ON l.id = p.lesson_id
                LEFT JOIN modules m ON m.id = l.module_id
                WHERE p.user_id = :userId
                ORDER BY m.id, l.id
            ");
            $stmt->execute([':userId' => $userId]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $completedLessons = (int)$database->query("
                SELECT COUNT(*) FROM progress 
                WHERE user_id = {$userId} AND completed = 1
            ")->fetchColumn();

            $practiceRate = (float)$database->query("
                SELECT COALESCE(ROUND((SUM(correct_attempts) * 100.0) / NULLIF(SUM(attempts), 0), 2), 0)
                FROM progress
                WHERE user_id = {$userId} AND attempts > 0
            ")->fetchColumn();

            $avgConfidenceImprovement = (float)$database->query("
                SELECT COALESCE(ROUND(AVG(confidence_after - confidence_before), 2), 0)
                FROM progress
                WHERE user_id = {$userId}
                  AND confidence_before IS NOT NULL
                  AND confidence_after IS NOT NULL
            ")->fetchColumn();
        } else {
            $rows = [];
            $q = $database->query("
                SELECT 
                    p.id, p.user_id, p.lesson_id, p.status, p.completed,
                    COALESCE(p.attempts, 0) AS attempts,
                    COALESCE(p.correct_attempts, 0) AS correct_attempts,
                    COALESCE(p.last_score, 0) AS last_score,
                    COALESCE(p.first_attempt_correct, 0) AS first_attempt_correct,
                    p.confidence_before, p.confidence_after,
                    p.completed_at, p.last_attempt_at,
                    l.title AS lesson_title, l.module_id, m.title AS module_title
                FROM progress p
                LEFT JOIN lessons l ON l.id = p.lesson_id
                LEFT JOIN modules m ON m.id = l.module_id
                WHERE p.user_id = {$userId}
                ORDER BY m.id, l.id
            ");
            while ($q && $r = $q->fetch_assoc()) $rows[] = $r;

            $completedLessons = 0;
            $r1 = $database->query("SELECT COUNT(*) c FROM progress WHERE user_id = {$userId} AND completed = 1");
            if ($r1 && ($x = $r1->fetch_assoc())) $completedLessons = (int)$x['c'];

            $practiceRate = 0.0;
            $r2 = $database->query("
                SELECT COALESCE(ROUND((SUM(correct_attempts) * 100.0) / NULLIF(SUM(attempts), 0), 2), 0) v
                FROM progress
                WHERE user_id = {$userId} AND attempts > 0
            ");
            if ($r2 && ($x = $r2->fetch_assoc())) $practiceRate = (float)$x['v'];

            $avgConfidenceImprovement = 0.0;
            $r3 = $database->query("
                SELECT COALESCE(ROUND(AVG(confidence_after - confidence_before), 2), 0) v
                FROM progress
                WHERE user_id = {$userId}
                  AND confidence_before IS NOT NULL
                  AND confidence_after IS NOT NULL
            ");
            if ($r3 && ($x = $r3->fetch_assoc())) $avgConfidenceImprovement = (float)$x['v'];
        }

        echo json_encode([
            "userId" => $userId,
            "progress" => $rows,
            "overview" => [
                "completedLessons" => $completedLessons,
                "practiceSuccessRate" => $practiceRate,
                "averageConfidenceImprovement" => $avgConfidenceImprovement
            ]
        ]);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(["message" => "Error: " . $e->getMessage()]);
        exit;
    }
}

// POST flow
$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) $data = [];
$action = $data['action'] ?? '';

try {
    if ($action === 'confidence') {
        $userId = (int)($data['userId'] ?? 0);
        $moduleId = (int)($data['moduleId'] ?? 0);
        $stage = $data['stage'] ?? null;
        $rating = isset($data['rating']) ? (int)$data['rating'] : null;

        $before = array_key_exists('confidence_before', $data)
            ? (int)$data['confidence_before']
            : ($stage === 'before' ? $rating : null);

        $after = array_key_exists('confidence_after', $data)
            ? (int)$data['confidence_after']
            : ($stage === 'after' ? $rating : null);

        if ($userId <= 0 || $moduleId <= 0 || ($before === null && $after === null)) {
            http_response_code(400);
            echo json_encode(["message" => "Missing confidence fields"]);
            exit;
        }

        // store module-level confidence on first lesson row of that module
        $lessonStmt = $database->prepare("
            SELECT id FROM lessons WHERE module_id = :module_id ORDER BY id ASC LIMIT 1
        ");
        $lessonStmt->execute([':module_id' => $moduleId]);
        $lessonId = (int)$lessonStmt->fetchColumn();

        if ($lessonId <= 0) {
            http_response_code(400);
            echo json_encode(["message" => "No lessons found for module"]);
            exit;
        }

        $upsert = $database->prepare("
            INSERT INTO progress
                (user_id, lesson_id, status, completed, confidence_before, confidence_after, last_attempt_at)
            VALUES
                (:user_id, :lesson_id, 'not_started', 0, :before_insert, :after_insert, NOW())
            ON DUPLICATE KEY UPDATE
                confidence_before = COALESCE(:before_update, confidence_before),
                confidence_after  = COALESCE(:after_update, confidence_after),
                last_updated = NOW()
        ");

        $upsert->execute([
            ':user_id' => $userId,
            ':lesson_id' => $lessonId,
            ':before_insert' => $before,
            ':after_insert' => $after,
            ':before_update' => $before,
            ':after_update' => $after
        ]);

        echo json_encode(["message" => "Confidence saved"]);
        exit;
    }

    if ($action === 'practice_result') {
        $userId = (int)($data['userId'] ?? 0);
        $lessonId = (int)($data['lessonId'] ?? 0);
        $isCorrect = !empty($data['isCorrect']) ? 1 : 0;

        if ($userId <= 0 || $lessonId <= 0) {
            http_response_code(400);
            echo json_encode(["message" => "Missing userId/lessonId"]);
            exit;
        }

        $database->beginTransaction();

        $sel = $database->prepare("
            SELECT id, COALESCE(attempts,0) AS attempts, COALESCE(correct_attempts,0) AS correct_attempts, COALESCE(first_attempt_correct,0) AS first_attempt_correct
            FROM progress
            WHERE user_id = :user_id AND lesson_id = :lesson_id
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
        ");
        $sel->execute([':user_id' => $userId, ':lesson_id' => $lessonId]);
        $row = $sel->fetch(PDO::FETCH_ASSOC);

        $status = $isCorrect ? 'completed' : 'in_progress';
        $completed = $isCorrect ? 1 : 0;
        $lastScore = $isCorrect ? 100 : 0;

        if ($row) {
            $prevAttempts = (int)$row['attempts'];
            $newAttempts = $prevAttempts + 1;
            $newCorrectAttempts = (int)$row['correct_attempts'] + ($isCorrect ? 1 : 0);
            $newFirstAttemptCorrect = ($prevAttempts === 0) ? $isCorrect : (int)$row['first_attempt_correct'];

            $upd = $database->prepare("
                UPDATE progress
                SET attempts = :attempts,
                    correct_attempts = :correct_attempts,
                    last_score = :last_score,
                    first_attempt_correct = :first_attempt_correct,
                    status = :status,
                    completed = GREATEST(COALESCE(completed,0), :completed),
                    completed_at = IF(:completed = 1, NOW(), completed_at),
                    last_attempt_at = NOW(),
                    last_updated = NOW()
                WHERE id = :id
            ");
            $upd->execute([
                ':attempts' => $newAttempts,
                ':correct_attempts' => $newCorrectAttempts,
                ':last_score' => $lastScore,
                ':first_attempt_correct' => $newFirstAttemptCorrect,
                ':status' => $status,
                ':completed' => $completed,
                ':id' => (int)$row['id']
            ]);
        } else {
            $ins = $database->prepare("
                INSERT INTO progress
                    (user_id, lesson_id, status, completed, attempts, correct_attempts, last_score, first_attempt_correct, completed_at, last_attempt_at)
                VALUES
                    (:user_id, :lesson_id, :status, :completed, 1, :correct_attempts, :last_score, :first_attempt_correct,
                     IF(:completed = 1, NOW(), NULL), NOW())
            ");
            $ins->execute([
                ':user_id' => $userId,
                ':lesson_id' => $lessonId,
                ':status' => $status,
                ':completed' => $completed,
                ':correct_attempts' => $isCorrect ? 1 : 0,
                ':last_score' => $lastScore,
                ':first_attempt_correct' => $isCorrect ? 1 : 0
            ]);
        }

        $database->commit();
        echo json_encode(["message" => "Practice result saved"]);
        exit;
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["message" => "Error: " . $e->getMessage()]);
}