<?php
require_once '../config/database.php';

header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array("message" => "Method not allowed"));
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->question)) {
    http_response_code(400);
    echo json_encode(array("message" => "Question required"));
    exit;
}

// Simple coach AI response (replace with real AI service if needed)
$responses = array(
    "password" => "A strong password should be at least 12 characters long and include uppercase, lowercase, numbers, and special characters.",
    "phishing" => "Phishing attacks try to trick you into revealing personal information. Always verify email addresses and don't click suspicious links.",
    "2fa" => "Two-Factor Authentication (2FA) adds an extra security layer by requiring a second verification method after entering your password.",
    "scam" => "Be cautious of unsolicited offers. Verify sources before sharing personal or financial information."
);

$response = "That's a great question! Try to think about the key concepts we covered in the lesson.";

foreach ($responses as $key => $value) {
    if (stripos($data->question, $key) !== false) {
        $response = $value;
        break;
    }
}

echo json_encode(array("response" => $response));
?>