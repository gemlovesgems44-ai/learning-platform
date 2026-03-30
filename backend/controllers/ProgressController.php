<?php
class ProgressController {
    private $progressModel;

    public function __construct($progressModel) {
        $this->progressModel = $progressModel;
    }

    public function saveProgress($userId, $courseId, $lessonId, $progressData) {
        // Logic to save user progress
        return $this->progressModel->save($userId, $courseId, $lessonId, $progressData);
    }

    public function getProgress($userId) {
        // Logic to retrieve user progress
        return $this->progressModel->getByUserId($userId);
    }
}
?>