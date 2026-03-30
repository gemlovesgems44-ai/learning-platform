<?php
require_once __DIR__ . '/../../vendor/autoload.php';

// Load .env file
$envFile = __DIR__ . '/../../.env';

if (file_exists($envFile)) {
    $content = file_get_contents($envFile);
    $lines = explode("\n", $content);
    foreach ($lines as $line) {
        $line = trim($line);
        if (!empty($line) && strpos($line, '=') !== false && strpos($line, '#') !== 0) {
            list($key, $value) = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

class Database {
    private $host;
    private $db_name;
    private $username;
    public $conn;

    public function __construct() {
        $this->host = $_ENV['DB_HOST'] ?? 'localhost';
        $this->db_name = $_ENV['DB_NAME'] ?? 'learning_platform';
        $this->username = $_ENV['DB_USER'] ?? 'root';
    }

    private function getPassword() {
        return $_ENV['DB_PASS'] ?? '';
    }

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new PDO("mysql:host=" . $this->host . ";dbname=" . $this->db_name, $this->username, $this->getPassword());
            $this->conn->exec("set names utf8");
        } catch(PDOException $exception) {
            http_response_code(500);
            echo json_encode(array("message" => "Database connection error: " . $exception->getMessage()));
            return null;
        }
        return $this->conn;
    }
}
?>