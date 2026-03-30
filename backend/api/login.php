<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/login.php
require_once '../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array("message" => "Method not allowed"));
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->username) || !isset($data->password)) {
    http_response_code(400);
    echo json_encode(array("message" => "Username and password required"));
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
    $query = "SELECT id, username, role FROM users WHERE username = :username AND password = :password LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':username', $data->username);
    $stmt->bindParam(':password', $data->password);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        http_response_code(200);
        echo json_encode(array(
            "message" => "Login successful",
            "userId" => $user['id'],
            "username" => $user['username'],
            "role" => $user['role']
        ));
    } else {
        http_response_code(401);
        echo json_encode(array("message" => "Invalid credentials"));
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(array("message" => "Database error: " . $e->getMessage()));
}
?>