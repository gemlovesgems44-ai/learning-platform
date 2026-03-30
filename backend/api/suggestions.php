<?php
require_once '../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

$userId = $_GET['userId'] ?? null;

if (!$userId) {
    http_response_code(400);
    echo json_encode(array("message" => "User ID required"));
    exit;
}

$database = new Database();
$db = $database->getConnection();

if ($db === null) {
    http_response_code(500);
    echo json_encode(array("message" => "Database connection failed"));
    exit;
}

try {
    // Get modules not yet started by user
    $query = "SELECT m.id, m.title, m.description FROM modules m 
              WHERE m.id NOT IN (
                  SELECT DISTINCT l.module_id FROM progress p 
                  JOIN lessons l ON p.lesson_id = l.id 
                  WHERE p.user_id = :userId
              ) LIMIT 3";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':userId', $userId);
    $stmt->execute();
    
    $suggestions = array();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        array_push($suggestions, $row);
    }
    
    echo json_encode($suggestions);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>