<?php
// Returns { full_name, avatar, role } for current session
session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['staff_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

try {
    $db = new PDO('mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4', 'dramelon', 'dramelon', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $q = $db->prepare('SELECT FullName, COALESCE(AvatarPath, "") AS AvatarPath, Role FROM staffs WHERE StaffID = :id LIMIT 1');
    $q->execute([':id' => $_SESSION['staff_id']]);
    $u = $q->fetch(PDO::FETCH_ASSOC);

    if (!$u) {
        http_response_code(401);
        echo json_encode(['error' => 'unauthorized']);
        exit;
    }

    $roleKey = strtolower((string) $u['Role']);
    $roleLabels = [
        'administrator' => 'Administrator',
        'project' => 'Project',
        'procurement' => 'Procurement',
        'accounting' => 'Accounting',
    ];

    $homeRoutes = [
        'administrator' => 'View/Administrator/home.html',
        'project' => 'View/Project/dashboard.html',
        'procurement' => 'View/Procurement/dashboard.html',
        'accounting' => 'View/Accounting/dashboard.html',
    ];

    echo json_encode([
        'full_name' => $u['FullName'] ?: 'ผู้ใช้งาน',
        'avatar' => $u['AvatarPath'],
        'role' => $roleLabels[$roleKey] ?? $u['Role'],
        'role_key' => $roleKey,
        'home_path' => $homeRoutes[$roleKey] ?? 'View/login.html'
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}