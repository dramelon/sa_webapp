<?php
session_start();

try {
    $db = new PDO('mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4', 'dramelon', 'dramelon', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (PDOException $e) {
    die("DB connection failed: " . $e->getMessage());
}

$userInput = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';

if ($userInput === '' || $password === '') {
    header('Location: ../View/login.html?error=missing');
    exit;
}

$stmt = $db->prepare('SELECT StaffID, Password, Role, Status FROM staffs WHERE Username = :u OR Email = :u LIMIT 1');
$stmt->execute([':u' => $userInput]);
$staff = $stmt->fetch(PDO::FETCH_ASSOC);

if ($staff && password_verify($password, $staff['Password'])) {
    if (strtolower((string) $staff['Status']) !== 'active') {
        header('Location: ../View/login.html?error=status');
        exit;
    }

    session_regenerate_id(true);
    $_SESSION['staff_id'] = (int) $staff['StaffID'];
    $_SESSION['role'] = $staff['Role'];

    $update = $db->prepare('UPDATE staffs SET LastLogin = NOW() WHERE StaffID = :id');
    $update->execute([':id' => $staff['StaffID']]);

    $roleRedirects = [
        'administrator' => '../View/Administrator/home.html',
        'project' => '../View/Project/dashboard.html',
        'procurement' => '../View/Procurement/dashboard.html',
        'accounting' => '../View/Accounting/dashboard.html',
    ];

    $roleKey = strtolower((string) $staff['Role']);
    $target = $roleRedirects[$roleKey] ?? '../View/login.html?error=unauth';

    header("Location: $target");
    exit;
}

header('Location: ../View/login.html?error=1');
exit;