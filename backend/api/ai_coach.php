<?php
// filepath: /Users/jemimansandax/Desktop/synoptic project/learning-platform/backend/api/ai_coach.php
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

$apiKey = getenv('OPENAI_API_KEY');
if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'AI key not configured']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];

$action = trim((string)($payload['action'] ?? ''));
$lessonTitle = trim((string)($payload['lessonTitle'] ?? ''));
$lessonContent = trim((string)($payload['lessonContent'] ?? ''));
$keyPoints = $payload['keyPoints'] ?? [];

if ($action === '' || $lessonTitle === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Missing required fields']);
    exit;
}

if (!is_array($keyPoints)) $keyPoints = [];
$keyPoints = array_slice(array_map(fn($x) => trim((string)$x), $keyPoints), 0, 8);
$lessonContent = mb_substr($lessonContent, 0, 2500);

$systemPrompt = <<<TXT
You are a supportive digital skills coach.
Rules:
- Use plain English.
- Stay within the provided lesson context only.
- Do not ask for or infer personal data.
- Be warm, patient, and non-judgmental.
- Use encouraging language without sounding robotic or overly formal.
- Give practical next steps the learner can try right away.
- Respond in 2 to 3 short sentences.
TXT;

$userPrompt = "Action: {$action}\n"
    . "Lesson title: {$lessonTitle}\n"
    . "Key points: " . implode('; ', $keyPoints) . "\n"
    . "Lesson content:\n{$lessonContent}\n";

$requestBody = [
    'model' => getenv('OPENAI_MODEL') ?: 'gpt-4.1-mini',
    'input' => [
        [
            'role' => 'system',
            'content' => [
                ['type' => 'input_text', 'text' => $systemPrompt]
            ]
        ],
        [
            'role' => 'user',
            'content' => [
                ['type' => 'input_text', 'text' => $userPrompt]
            ]
        ]
    ],
    'temperature' => 0.4,
    'max_output_tokens' => 180
];

$ch = curl_init('https://api.openai.com/v1/responses');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode($requestBody),
    CURLOPT_TIMEOUT => 20
]);

$raw = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($raw === false || $httpCode >= 400) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'message' => 'AI request failed',
        'status' => $httpCode,
        'error' => $curlErr ?: $raw
    ]);
    exit;
}

$res = json_decode($raw, true) ?: [];
$answer = trim((string)($res['output_text'] ?? ''));

if ($answer === '' && !empty($res['output']) && is_array($res['output'])) {
    foreach ($res['output'] as $out) {
        foreach (($out['content'] ?? []) as $c) {
            if (($c['type'] ?? '') === 'output_text' && !empty($c['text'])) {
                $answer .= ($answer ? "\n" : "") . trim((string)$c['text']);
            }
        }
    }
}

if ($answer === '') {
    http_response_code(502);
    echo json_encode(['ok' => false, 'message' => 'Empty AI response', 'raw' => $res]);
    exit;
}

echo json_encode(['ok' => true, 'answer' => $answer]);