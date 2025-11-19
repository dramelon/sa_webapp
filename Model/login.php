<?php
require_once __DIR__ . '/database_connector.php';

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed', 'message' => 'This endpoint only accepts POST requests.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_payload', 'message' => 'The request payload is not valid JSON.']);
    exit;
}

$username = trim($input['username'] ?? '');
$password = $input['password'] ?? '';

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['error' => 'missing_credentials', 'message' => 'Username and password are required.']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $stmt = $db->prepare(
        'SELECT StaffID, Username, Password, FullName, Role, Status
         FROM staffs
         WHERE Username = :username OR Email = :username
         LIMIT 1'
    );
    $stmt->execute([':username' => $username]);
    $staff = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$staff) {
        http_response_code(401); // Unauthorized
        echo json_encode(['error' => 'invalid_credentials', 'message' => 'Invalid username or password.']);
        exit;
    }

    if (!password_verify($password, (string)$staff['Password'])) {
        http_response_code(401); // Unauthorized
        echo json_encode(['error' => 'invalid_credentials', 'message' => 'Invalid username or password.']);
        exit;
    }

    if (strtolower((string)$staff['Status']) !== 'active') {
        http_response_code(403); // Forbidden
        echo json_encode(['error' => 'account_inactive', 'message' => 'Your account is not active. Please contact an administrator.']);
        exit;
    }

    // Regenerate session ID to prevent session fixation
    session_regenerate_id(true);

    // Store essential, non-sensitive information in the session
    $_SESSION['staff_id'] = (int) $staff['StaffID'];
    $_SESSION['username'] = $staff['Username'];
    $_SESSION['fullname'] = $staff['FullName'];
    $_SESSION['role'] = strtolower((string) $staff['Role']);

    // Update LastLogin timestamp
    $updateStmt = $db->prepare('UPDATE staffs SET LastLogin = CURRENT_TIMESTAMP WHERE StaffID = :id');
    $updateStmt->execute([':id' => $staff['StaffID']]);

    echo json_encode([
        'success' => true,
        'message' => 'Login successful.',
        'role' => $_SESSION['role']
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server_error', 'message' => 'A server error occurred during login.']);
}