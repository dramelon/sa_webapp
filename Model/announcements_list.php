<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

try {
    $db = new PDO('mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4', 'dramelon', 'dramelon', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    $q = $db->query(
        "SELECT a.AnnounceID, a.Topic, a.Description, a.AnnounceDate,
            COALESCE(s.FullName,'ไม่ทราบผู้ประกาศ') AS AnnouncerName
     FROM Announcement a
     LEFT JOIN staffs s ON s.StaffID = a.Announcer
     WHERE a.Archived = 0
     ORDER BY a.AnnounceDate DESC"
    );
    echo json_encode($q->fetchAll(PDO::FETCH_ASSOC));
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'server']);
}
