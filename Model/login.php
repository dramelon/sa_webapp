<?php
session_start();

try {
    $db = new PDO('mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4', 'dramelon', 'dramelon', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
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

$stmt = $db->prepare('SELECT StaffID, Password FROM staffs WHERE Username = :u OR Email = :u LIMIT 1');
$stmt->execute([':u' => $userInput]);
$staff = $stmt->fetch(PDO::FETCH_ASSOC);

if ($staff && password_verify($password, hash: $staff['Password'])) {
    session_regenerate_id(delete_old_session: true);
    $_SESSION['staff_id'] = $staff['StaffID'];
    $db->prepare('UPDATE staffs SET LastLogin=NOW() WHERE StaffID=:id')->execute([':id' => $row['StaffID']]);
    header('Location: ../View/home.html'); // success
    exit;
}
header('Location: ../View/login.html?error=1'); // bad credentials
exit;