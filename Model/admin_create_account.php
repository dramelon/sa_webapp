<?php
// Admin creates new staff account
session_start();

if (empty($_SESSION['staff_id'])) {
    header('Location: ../View/login.html?error=unauth');
    exit;
}

$currentRole = strtolower((string) ($_SESSION['role'] ?? ''));
if ($currentRole !== 'administrator') {
    http_response_code(403);
    header('Location: ../View/login.html?error=unauth');
    exit;
}

try {
    $db = new PDO('mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4', 'dramelon', 'dramelon', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (PDOException $e) {
    die("DB connection failed: " . $e->getMessage());
}

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';
$fullname = trim($_POST['fullname'] ?? '');
$email = trim($_POST['email'] ?? '');
$phone = trim($_POST['phone'] ?? '');
$role = strtolower(trim($_POST['role'] ?? 'project'));

$allowedRoles = ['administrator', 'project', 'procurement', 'accounting'];
if (!in_array($role, $allowedRoles, true)) {
    $role = 'project';
}

if ($username === '' || $password === '' || $email === '') {
    header('Location: ../View/Administrator/admin_create_account.html?error=missing');
    exit;
}

try {
    $hash = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $db->prepare('INSERT INTO staffs (Username, Password, FullName, Email, Phone, Role)
                        VALUES (:u, :p, :f, :e, :ph, :r)');
    $stmt->execute([
        ':u' => $username,
        ':p' => $hash,
        ':f' => $fullname,
        ':e' => $email,
        ':ph' => $phone,
        ':r' => $role
    ]);

    header('Location: ../View/Administrator/admin_create_account.html?created=1');
    exit;
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        header('Location: ../View/Administrator/admin_create_account.html?error=exists');
        exit;
    }

    header('Location: ../View/Administrator/admin_create_account.html?error=server');
    exit;
}