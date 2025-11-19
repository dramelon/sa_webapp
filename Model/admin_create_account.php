<?php
require_once __DIR__ . '/database_connector.php';
require_once __DIR__ . '/audit_log.php';

// Admin creates new staff account
session_start();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed', 'message' => 'This endpoint only accepts POST requests.']);
    exit;
}

$isFirstAdminCreation = false;
try {
    $db_check = DatabaseConnector::getConnection();
    $stmt_check = $db_check->query("SELECT COUNT(*) FROM staffs WHERE Role = 'administrator'");
    if ($stmt_check->fetchColumn() == 0) {
        $isFirstAdminCreation = true;
    }
} catch (PDOException $e) {
    // Fail safely if the database/table isn't ready. The regular checks will apply.
}

if (!$isFirstAdminCreation) {
    if (empty($_SESSION['staff_id'])) {
        http_response_code(401);
        echo json_encode(['error' => 'unauthorized', 'message' => 'You must be logged in to create an account.']);
        exit;
    }

    $currentRole = strtolower((string) ($_SESSION['role'] ?? ''));
    if ($currentRole !== 'administrator') {
        http_response_code(403);
        echo json_encode(['error' => 'forbidden', 'message' => 'You do not have permission to perform this action.']);
        exit;
    }
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid_payload', 'message' => 'The request payload is not valid JSON.']);
    exit;
}

try {
    $db = DatabaseConnector::getConnection();

    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';
    $fullname = trim($input['fullname'] ?? '');
    $email = trim($input['email'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $role = strtolower(trim($input['role'] ?? 'staff'));

    if ($isFirstAdminCreation) {
        $role = 'administrator'; // Force the first account to be an administrator
    } else {
        $allowedRoles = ['administrator', 'project', 'procurement', 'accounting', 'staff'];
        if (!in_array($role, $allowedRoles, true)) {
            $role = 'staff';
        }
    }

    if ($username === '' || $password === '' || $email === '') {
        http_response_code(400);
        echo json_encode(['error' => 'missing_fields', 'message' => 'Username, password, and email are required.']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $db->prepare(
        'INSERT INTO staffs (Username, Password, FullName, Email, Phone, Role)
         VALUES (:username, :password, :fullname, :email, :phone, :role)'
    );
    $stmt->execute([
        ':username' => $username,
        ':password' => $hash,
        ':fullname' => $fullname ?: null,
        ':email' => $email,
        ':phone' => $phone ?: null,
        ':role' => $role
    ]);

    $staffId = (int) $db->lastInsertId();
    if ($staffId > 0) {
        // For the first admin, the ActionBy user is the user themselves.
        $actionBy = $isFirstAdminCreation ? $staffId : (int) $_SESSION['staff_id'];
        recordAuditEvent($db, 'staff', $staffId, 'CREATE', $actionBy);
    }

    echo json_encode(['success' => true, 'staff_id' => $staffId]);
} catch (PDOException $e) {
    if ((int) $e->getCode() === 23000) {
        http_response_code(409); // Conflict
        echo json_encode(['error' => 'duplicate_entry', 'message' => 'This username or email already exists.']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'database_error', 'message' => 'A server error occurred.']);
    }
}