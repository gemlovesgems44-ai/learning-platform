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

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = $_GET['userId'] ?? null;
    
    if (!$userId) {
        http_response_code(400);
        echo json_encode(array("message" => "User ID required"));
        exit;
    }
    
    try {
        $query = "SELECT p.id, l.title as lessonTitle, p.completed_at 
                  FROM progress p 
                  LEFT JOIN lessons l ON p.lesson_id = l.id 
                  WHERE p.user_id = :userId AND p.completed = 1 
                  ORDER BY p.completed_at DESC";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':userId', $userId, PDO::PARAM_INT);
        $stmt->execute();
        
        $progress = array();
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            array_push($progress, $row);
        }
        
        echo json_encode($progress);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
} 
else if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"));
    
    if (!isset($data->userId) || !isset($data->lessonId)) {
        http_response_code(400);
        echo json_encode(array("message" => "User ID and Lesson ID required"));
        exit;
    }
    
    try {
        $query = "INSERT INTO progress (user_id, lesson_id, completed, completed_at) 
                  VALUES (:userId, :lessonId, 1, NOW())";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':userId', $data->userId, PDO::PARAM_INT);
        $stmt->bindParam(':lessonId', $data->lessonId, PDO::PARAM_INT);
        
        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode(array("message" => "Progress saved"));
        } else {
            http_response_code(500);
            echo json_encode(array("message" => "Failed to save progress"));
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(array("message" => "Database error: " . $e->getMessage()));
    }
}
?>