# ==========================================
# Production Dockerfile for Laravel Backend
# Compatible with Fly.io, Railway, Render, & Docker
# ==========================================
FROM php:8.4-fpm-alpine

# Set environment variables
ENV COMPOSER_ALLOW_SUPERUSER=1

# Set working directory
WORKDIR /var/www/html

# Install system dependencies & libraries needed for extensions
RUN apk add --no-cache \
    nginx \
    curl \
    git \
    unzip \
    libzip-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    postgresql-dev \
    icu-dev \
    oniguruma-dev \
    libxml2-dev \
    bash

# Configure and install all required PHP extensions (including Excel/Flysystem requirements)
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo \
        pdo_pgsql \
        pgsql \
        pdo_mysql \
        zip \
        gd \
        intl \
        bcmath \
        opcache \
        mbstring \
        dom \
        xml \
        simplexml \
        fileinfo \
        pcntl

# Copy OPcache production settings
RUN echo "opcache.enable=1" >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini \
    && echo "opcache.enable_cli=1" >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini \
    && echo "opcache.memory_consumption=128" >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini \
    && echo "opcache.interned_strings_buffer=8" >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini \
    && echo "opcache.max_accelerated_files=10000" >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini \
    && echo "opcache.validate_timestamps=0" >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini \
    && echo "opcache.save_comments=1" >> /usr/local/etc/php/conf.d/docker-php-ext-opcache.ini \
    && echo "upload_max_filesize=20M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "post_max_size=25M" >> /usr/local/etc/php/conf.d/uploads.ini \
    && echo "memory_limit=256M" >> /usr/local/etc/php/conf.d/uploads.ini

# Install Composer
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

# Copy Nginx configuration
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# Step 1: Copy composer definitions first for layer caching
COPY composer.json composer.lock /var/www/html/

# Step 2: Install dependencies without executing artisan scripts
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist --no-autoloader

# Step 3: Copy the rest of the application files
COPY . /var/www/html

# Step 4: Generate optimized autoloader classmap
RUN composer dump-autoload --optimize --no-dev

# Setup storage directory permissions
RUN mkdir -p /var/www/html/storage/framework/cache/data \
    /var/www/html/storage/framework/sessions \
    /var/www/html/storage/framework/views \
    /var/www/html/storage/logs \
    /var/www/html/bootstrap/cache \
    && chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache \
    && chmod +x /var/www/html/docker/entrypoint.sh

# Expose default HTTP port for Fly.io
EXPOSE 8080

# Run entrypoint script
ENTRYPOINT ["/var/www/html/docker/entrypoint.sh"]
