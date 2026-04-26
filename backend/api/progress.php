<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/progress.php
require_once __DIR__ . '/../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

// DEBUG: find what database.php exports
$_availableGlobals = [];
foreach (['conn', 'pdo', 'db', 'mysqli', 'database', 'connection'] as $k) {
    if (isset($GLOBALS[$k])) {
        $_availableGlobals[$k] = get_class($GLOBALS[$k]);
    }
}
error_log('DB globals available: ' . json_encode($_availableGlobals));

// Also check for class
if (class_exists('Database')) {
    error_log('Database class exists');
    $obj = new Database();
    $methods = get_class_methods($obj);
    error_log('Database methods: ' . json_encode($methods));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) $data = [];

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

$action = $data['action'] ?? '';

try {
    if ($action === 'confidence') {
        $userId = (int)($data['userId'] ?? 0);
        $moduleId = (int)($data['moduleId'] ?? 0);
        $stage = $data['stage'] ?? null; // "before" or "after"
        $rating = isset($data['rating']) ? (int)$data['rating'] : null;

        $confidenceBefore = array_key_exists('confidence_before', $data)
            ? (int)$data['confidence_before']
            : ($stage === 'before' ? $rating : null);

        $confidenceAfter = array_key_exists('confidence_after', $data)
            ? (int)$data['confidence_after']
            : ($stage === 'after' ? $rating : null);

        if (!$userId || !$moduleId || ($confidenceBefore === null && $confidenceAfter === null)) {
            http_response_code(400);
            echo json_encode(["message" => "Missing userId/moduleId/confidence value"]);
            exit;
        }

        if ($isPdo) {
            $database->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $firstLessonStmt = $database->prepare("
                SELECT id FROM lessons WHERE module_id = :moduleId ORDER BY id ASC LIMIT 1
            ");
            $firstLessonStmt->execute([':moduleId' => $moduleId]);
            $firstLessonId = (int)$firstLessonStmt->fetchColumn();

            if (!$firstLessonId) {
                http_response_code(400);
                echo json_encode(["message" => "No lessons found for module"]);
                exit;
            }

            if ($confidenceBefore !== null) {
                $u = $database->prepare("
                    UPDATE progress
                    SET confidence_before = :val
                    WHERE user_id = :userId
                      AND lesson_id IN (SELECT id FROM lessons WHERE module_id = :moduleId)
                ");
                $u->execute([':val' => $confidenceBefore, ':userId' => $userId, ':moduleId' => $moduleId]);

                if ($u->rowCount() === 0) {
                    $i = $database->prepare("
                        INSERT INTO progress (user_id, lesson_id, status, completed, confidence_before)
                        VALUES (:userId, :lessonId, 'not_started', 0, :val)
                    ");
                    $i->execute([':userId' => $userId, ':lessonId' => $firstLessonId, ':val' => $confidenceBefore]);
                }
            }

            if ($confidenceAfter !== null) {
                $u = $database->prepare("
                    UPDATE progress
                    SET confidence_after = :val
                    WHERE user_id = :userId
                      AND lesson_id IN (SELECT id FROM lessons WHERE module_id = :moduleId)
                ");
                $u->execute([':val' => $confidenceAfter, ':userId' => $userId, ':moduleId' => $moduleId]);

                if ($u->rowCount() === 0) {
                    $i = $database->prepare("
                        INSERT INTO progress (user_id, lesson_id, status, completed, confidence_after)
                        VALUES (:userId, :lessonId, 'not_started', 0, :val)
                    ");
                    $i->execute([':userId' => $userId, ':lessonId' => $firstLessonId, ':val' => $confidenceAfter]);
                }
            }
        } else {
            $firstLessonRes = $database->query("SELECT id FROM lessons WHERE module_id = {$moduleId} ORDER BY id ASC LIMIT 1");
            $row = $firstLessonRes ? $firstLessonRes->fetch_assoc() : null;
            $firstLessonId = $row ? (int)$row['id'] : 0;

            if (!$firstLessonId) {
                http_response_code(400);
                echo json_encode(["message" => "No lessons found for module"]);
                exit;
            }

            if ($confidenceBefore !== null) {
                $database->query("
                    UPDATE progress
                    SET confidence_before = {$confidenceBefore}
                    WHERE user_id = {$userId}
                      AND lesson_id IN (SELECT id FROM lessons WHERE module_id = {$moduleId})
                ");
                if ($database->affected_rows === 0) {
                    $database->query("
                        INSERT INTO progress (user_id, lesson_id, status, completed, confidence_before)
                        VALUES ({$userId}, {$firstLessonId}, 'not_started', 0, {$confidenceBefore})
                    ");
                }
            }

            if ($confidenceAfter !== null) {
                $database->query("
                    UPDATE progress
                    SET confidence_after = {$confidenceAfter}
                    WHERE user_id = {$userId}
                      AND lesson_id IN (SELECT id FROM lessons WHERE module_id = {$moduleId})
                ");
                if ($database->affected_rows === 0) {
                    $database->query("
                        INSERT INTO progress (user_id, lesson_id, status, completed, confidence_after)
                        VALUES ({$userId}, {$firstLessonId}, 'not_started', 0, {$confidenceAfter})
                    ");
                }
            }
        }

        echo json_encode(["message" => "Confidence rating saved"]);
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