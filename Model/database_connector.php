<?php
require_once __DIR__ . '/database_connector.php';

/**
 * Centralized database connector for the SA WebApp models.
 *
 * Every model should call DatabaseConnector::getConnection() instead of
 * instantiating PDO manually. The method reuses a single PDO instance per
 * request so multiple queries can share one stable connection.
 * 
 * version :1
 */
final class DatabaseConnector
{
    /**
     * Shared PDO connection that gets reused across the request lifecycle.
     *
     * @var PDO|null
     */
    private static $connection = null;

    /**
     * Returns a PDO connection configured for this application.
     *
     * The DSN and credentials can be overridden via the SA_WEBAPP_DB_* env
     * variables when deploying to different environments.
     *
     * @return PDO
     */
    public static function getConnection()
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $dsn = getenv('SA_WEBAPP_DB_DSN') ?: 'mysql:host=localhost;dbname=sa_webapp;charset=utf8mb4';
        $username = getenv('SA_WEBAPP_DB_USER') ?: 'dramelon';
        $password = getenv('SA_WEBAPP_DB_PASSWORD') ?: 'dramelon';

        self::$connection = new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);

        return self::$connection;
    }
}