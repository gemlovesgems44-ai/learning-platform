<?php
require_once '../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

$database = new Database();
$db = $database->getConnection();

if ($db === null) {
    http_response_code(500);
    echo json_encode(array("message" => "Database connection failed"));
    exit;
}

try {
    $query = "SELECT u.username, 'completed_lesson' as action, l.title as lesson_title, p.completed_at as timestamp 
              FROM progress p 
              JOIN users u ON p.user_id = u.id 
              JOIN lessons l ON p.lesson_id = l.id 
              WHERE p.completed = 1 
              ORDER BY p.completed_at DESC 
              LIMIT 50";
    $stmt = $db->prepare($query);
    $stmt->execute();
    
    $activities = array();
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        array_push($activities, $row);
    }
    
    echo json_encode($activities);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>