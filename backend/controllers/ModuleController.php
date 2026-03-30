<?php
class ModuleController {
    private $moduleModel;

    public function __construct($moduleModel) {
        $this->moduleModel = $moduleModel;
    }

    public function getModules() {
        $modules = $this->moduleModel->fetchAllModules();
        echo json_encode($modules);
    }

    public function getModule($id) {
        $module = $this->moduleModel->fetchModuleById($id);
        echo json_encode($module);
    }

    public function createModule($data) {
        $result = $this->moduleModel->insertModule($data);
        echo json_encode(['success' => $result]);
    }

    public function updateModule($id, $data) {
        $result = $this->moduleModel->updateModule($id, $data);
        echo json_encode(['success' => $result]);
    }

    public function deleteModule($id) {
        $result = $this->moduleModel->deleteModule($id);
        echo json_encode(['success' => $result]);
    }
}
?>