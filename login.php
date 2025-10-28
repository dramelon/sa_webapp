<?php
session_start();

try {
    $db = new PDO('mysql:host=localhost;dbname=sa_app;charset=utf8mb4', 'dbuser', 'dbpass', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (PDOException $e) {
    die("DB connection failed: " . $e->getMessage());
}

$userInput = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';

if (!$userInput || !$password) {
    http_response_code(400);
    echo 'Missing input';
    exit;
}

$stmt = $db->prepare(query: 'SELECT StaffID, Password FROM staffs WHERE Username = :u OR Email = :u LIMIT 1');
$stmt->execute([':u' => $userInput]);
$staff = $stmt->fetch(PDO::FETCH_ASSOC);

if ($staff && password_verify($password, $staff['Password'])) {
    session_regenerate_id(true);
    $_SESSION['staff_id'] = $staff['StaffID'];

    $update = $db->prepare('UPDATE staffs SET LastLogin = NOW() WHERE StaffID = :id');
    $update->execute([':id' => $staff['StaffID']]);

    echo 'login ok';
} else {
    http_response_code(401);
    echo 'invalid';
}
