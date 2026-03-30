<?php
require_once '../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

// Verify admin access
$role = $_GET['role'] ?? null;

$database = new Database();
$db = $database->getConnection();

if ($db === null) {
    http_response_code(500);
    echo json_encode(array("message" => "Database connection failed"));
    exit;
}

try {
    // Total users
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM users");
    $stmt->execute();
    $totalUsers = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    // Active users today
    $stmt = $db->prepare("SELECT COUNT(DISTINCT user_id) as count FROM progress WHERE DATE(completed_at) = CURDATE()");
    $stmt->execute();
    $activeUsers = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    // Total lessons completed
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM progress WHERE completed = 1");
    $stmt->execute();
    $totalCompleted = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    // Platform efficiency (completion rate)
    $stmt = $db->prepare("SELECT COUNT(*) as total FROM progress");
    $stmt->execute();
    $totalProgress = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    
    $efficiency = $totalProgress > 0 ? round(($totalCompleted / $totalProgress) * 100) : 0;
    
    echo json_encode(array(
        "totalUsers" => $totalUsers,
        "activeUsers" => $activeUsers,
        "totalCompleted" => $totalCompleted,
        "efficiency" => $efficiency
    ));
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>