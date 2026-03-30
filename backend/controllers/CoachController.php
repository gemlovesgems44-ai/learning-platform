<?php
class CoachController {
    private $db;

    public function __construct($database) {
        $this->db = $database;
    }

    public function getCoachHelp($userId) {
        $query = "SELECT * FROM coach_help WHERE user_id = :user_id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function saveCoachFeedback($userId, $feedback) {
        $query = "INSERT INTO coach_feedback (user_id, feedback) VALUES (:user_id, :feedback)";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':user_id', $userId);
        $stmt->bindParam(':feedback', $feedback);
        return $stmt->execute();
    }

    public function submitCoachHelpRequest($data) {
        if (!isset($data->question) || !isset($data->userId)) {
            return [
                'success' => false,
                'message' => 'Missing required fields: question, userId'
            ];
        }

        $query = "INSERT INTO coach_help_requests (user_id, question, created_at) 
                  VALUES (:user_id, :question, NOW())";
        
        $stmt = $this->db->prepare($query);
        
        $stmt->bindParam(':user_id', $data->userId);
        $stmt->bindParam(':question', $data->question);
        
        if ($stmt->execute()) {
            return [
                'success' => true,
                'message' => 'Help request submitted successfully',
                'id' => $this->db->lastInsertId()
            ];
        } else {
            return [
                'success' => false,
                'message' => 'Failed to submit help request'
            ];
        }
    }
}
?>