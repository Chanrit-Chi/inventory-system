#!/bin/sh
set -e

echo "==> Starting Laravel deployment preparation..."

# Ensure storage directories exist and have proper permissions
mkdir -p /var/www/html/storage/framework/cache/data \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/storage/logs \
         /var/www/html/bootstrap/cache

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Discover packages with loaded environment variables
echo "==> Discovering Laravel packages..."
php artisan package:discover --ansi || true

# Create public storage symlink if not already linked
php artisan storage:link --force || true

# Run database migrations if DB is configured
if [ -n "$DB_HOST" ] || [ -n "$DATABASE_URL" ]; then
    echo "==> Running database migrations..."
    php artisan migrate --force --no-interaction || echo "Warning: Database migration failed. Please check credentials."
fi

# Cache configuration, routes, and views for production performance
echo "==> Caching Laravel configuration and routes..."
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

echo "==> Starting PHP-FPM and Nginx on port 8080..."

# Start PHP-FPM in the background
php-fpm -D

# Start Nginx in the foreground
exec nginx -g "daemon off;"
