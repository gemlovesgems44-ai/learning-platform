<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/progress.php
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json');

function resolveDb(): PDO {
    global $db, $pdo, $conn, $database;

    if (isset($db) && $db instanceof PDO) return $db;
    if (isset($pdo) && $pdo instanceof PDO) return $pdo;
    if (isset($conn) && $conn instanceof PDO) return $conn;
    if (isset($database) && $database instanceof PDO) return $database;

    if (function_exists('getDbConnection')) {
        $tmp = getDbConnection();
        if ($tmp instanceof PDO) return $tmp;
    }
    if (function_exists('getConnection')) {
        $tmp = getConnection();
        if ($tmp instanceof PDO) return $tmp;
    }

    if (class_exists('Database')) {
        $instance = new Database();
        if (method_exists($instance, 'getConnection')) {
            $tmp = $instance->getConnection();
            if ($tmp instanceof PDO) return $tmp;
        }
        if (method_exists($instance, 'connect')) {
            $tmp = $instance->connect();
            if ($tmp instanceof PDO) return $tmp;
        }
    }

    throw new RuntimeException('Database connection not initialized');
}

try {
    $db = resolveDb();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $userId = isset($_GET['userId']) ? (int)$_GET['userId'] : 0;
        if ($userId <= 0) {
            http_response_code(400);
            echo json_encode(['message' => 'Valid userId is required']);
            exit;
        }

        $sql = "
            SELECT
                p.id,
                p.user_id,
                p.lesson_id,
                l.module_id,
                l.title AS lesson_title,
                p.status,
                p.completed,
                p.completed_at,
                p.confidence_before,
                p.confidence_after,
                CASE
                    WHEN p.completed = 1 OR p.status = 'completed' THEN 100
                    WHEN p.status = 'in_progress' THEN 50
                    ELSE 0
                END AS completionPercent
            FROM progress p
            INNER JOIN lessons l ON l.id = p.lesson_id
            WHERE p.user_id = :userId
            ORDER BY p.completed_at DESC, p.id DESC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute([':userId' => $userId]);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        exit;
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $action = $input['action'] ?? null;

        // confidence save (accepts confidence_before / confidence_after)
        if ($action === 'confidence') {
            $userId = (int)($input['userId'] ?? 0);
            $moduleId = (int)($input['moduleId'] ?? 0);

            if ($userId <= 0 || $moduleId <= 0) {
                http_response_code(400);
                echo json_encode(['message' => 'userId and moduleId are required']);
                exit;
            }

            $isBefore = array_key_exists('confidence_before', $input);
            $isAfter = array_key_exists('confidence_after', $input);

            if (!$isBefore && !$isAfter) {
                http_response_code(400);
                echo json_encode(['message' => 'confidence_before or confidence_after is required']);
                exit;
            }

            $rating = (int)($isBefore ? $input['confidence_before'] : $input['confidence_after']);
            if ($rating < 1 || $rating > 5) {
                http_response_code(400);
                echo json_encode(['message' => 'confidence rating must be 1-5']);
                exit;
            }

            // before -> first lesson in module, after -> last lesson in module
            $order = $isAfter ? 'DESC' : 'ASC';
            $lessonStmt = $db->prepare("
                SELECT id
                FROM lessons
                WHERE module_id = :moduleId
                ORDER BY id {$order}
                LIMIT 1
            ");
            $lessonStmt->execute([':moduleId' => $moduleId]);
            $lessonId = (int)$lessonStmt->fetchColumn();

            if ($lessonId <= 0) {
                http_response_code(400);
                echo json_encode(['message' => 'No lessons found for module']);
                exit;
            }

            // ensure row exists
            $find = $db->prepare("SELECT id FROM progress WHERE user_id = :userId AND lesson_id = :lessonId LIMIT 1");
            $find->execute([':userId' => $userId, ':lessonId' => $lessonId]);
            $rowId = (int)$find->fetchColumn();

            if ($rowId > 0) {
                $sql = $isBefore
                    ? "UPDATE progress SET confidence_before = :rating WHERE id = :id"
                    : "UPDATE progress SET confidence_after = :rating WHERE id = :id";
                $upd = $db->prepare($sql);
                $upd->execute([':rating' => $rating, ':id' => $rowId]);
            } else {
                $ins = $db->prepare("
                    INSERT INTO progress (user_id, lesson_id, status, completed, confidence_before, confidence_after)
                    VALUES (:userId, :lessonId, 'in_progress', 0, :beforeVal, :afterVal)
                ");
                $ins->execute([
                    ':userId' => $userId,
                    ':lessonId' => $lessonId,
                    ':beforeVal' => $isBefore ? $rating : null,
                    ':afterVal' => $isAfter ? $rating : null
                ]);
            }

            echo json_encode(['ok' => true]);
            exit;
        }

        // module complete
        if ($action === 'complete_module') {
            $userId = (int)($input['userId'] ?? 0);
            $moduleId = (int)($input['moduleId'] ?? 0);

            if ($userId <= 0 || $moduleId <= 0) {
                http_response_code(400);
                echo json_encode(['message' => 'userId and moduleId are required']);
                exit;
            }

            $lessonStmt = $db->prepare("SELECT id FROM lessons WHERE module_id = :moduleId");
            $lessonStmt->execute([':moduleId' => $moduleId]);
            $lessonIds = $lessonStmt->fetchAll(PDO::FETCH_COLUMN);

            if (!$lessonIds) {
                http_response_code(400);
                echo json_encode(['message' => 'No lessons found for module']);
                exit;
            }

            $find = $db->prepare("SELECT id FROM progress WHERE user_id = :userId AND lesson_id = :lessonId LIMIT 1");
            $upd = $db->prepare("UPDATE progress SET status = 'completed', completed = 1, completed_at = NOW() WHERE id = :id");
            $ins = $db->prepare("
                INSERT INTO progress (user_id, lesson_id, status, completed, completed_at)
                VALUES (:userId, :lessonId, 'completed', 1, NOW())
            ");

            foreach ($lessonIds as $lessonId) {
                $lessonId = (int)$lessonId;
                $find->execute([':userId' => $userId, ':lessonId' => $lessonId]);
                $existingId = (int)$find->fetchColumn();

                if ($existingId > 0) $upd->execute([':id' => $existingId]);
                else $ins->execute([':userId' => $userId, ':lessonId' => $lessonId]);
            }

            echo json_encode(['ok' => true]);
            exit;
        }

        $userId = (int)($input['userId'] ?? 0);
        $lessonId = (int)($input['lessonId'] ?? 0);
        $completed = !empty($input['completed']) ? 1 : 0;

        if ($userId <= 0 || $lessonId <= 0) {
            http_response_code(400);
            echo json_encode(['message' => 'userId and lessonId are required']);
            exit;
        }

        $status = $completed ? 'completed' : 'in_progress';

        // Upsert without requiring a unique index
        $find = $db->prepare("SELECT id FROM progress WHERE user_id = :userId AND lesson_id = :lessonId LIMIT 1");
        $find->execute([':userId' => $userId, ':lessonId' => $lessonId]);
        $existingId = $find->fetchColumn();

        if ($existingId) {
            $update = $db->prepare("
                UPDATE progress
                SET status = :status,
                    completed = :completed,
                    completed_at = CASE WHEN :completed = 1 THEN NOW() ELSE completed_at END
                WHERE id = :id
            ");
            $update->execute([
                ':status' => $status,
                ':completed' => $completed,
                ':id' => (int)$existingId
            ]);
        } else {
            $insert = $db->prepare("
                INSERT INTO progress (user_id, lesson_id, status, completed, completed_at)
                VALUES (:userId, :lessonId, :status, :completed, CASE WHEN :completed = 1 THEN NOW() ELSE NULL END)
            ");
            $insert->execute([
                ':userId' => $userId,
                ':lessonId' => $lessonId,
                ':status' => $status,
                ':completed' => $completed
            ]);
        }

        echo json_encode(['ok' => true]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['message' => 'Method not allowed']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'message' => 'Failed to load/save progress',
        'error' => $e->getMessage()
    ]);
}

function hasColumn(PDO $db, string $table, string $column): bool {
    $stmt = $db->prepare("SHOW COLUMNS FROM `{$table}` LIKE :col");
    $stmt->execute([':col' => $column]);
    return (bool)$stmt->fetch(PDO::FETCH_ASSOC);
}