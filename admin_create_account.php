<?php
// Admin creates new staff account
session_start();

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
$role = trim($_POST['role'] ?? 'staff');

if (!$username || !$password || !$email) {
    http_response_code(response_code: 400);
    echo 'Missing required fields';
    exit;
}

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

echo 'Account created successfully';
