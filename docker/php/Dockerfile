FROM php:8.4-cli-alpine

# Install dependencies and extensions
RUN apk add --no-cache \
    postgresql-dev \
    postgresql-client \
    libzip-dev \
    unzip \
    git \
    linux-headers \
    wget \
    tar

# Install PHP extensions using mlocati installer for ease or manual
COPY --from=mlocati/php-extension-installer /usr/bin/install-php-extensions /usr/local/bin/

RUN install-php-extensions \
    pdo_pgsql \
    zip \
    pcntl \
    sockets \
    bcmath \
    intl \
    gd \
    redis \
    swoole

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install RoadRunner binary for Octane
# Download RoadRunner binary directly (version 2025.1.6 for linux amd64)
# This avoids needing Laravel to be fully configured during build
RUN wget -q https://github.com/roadrunner-server/roadrunner/releases/download/v2025.1.6/roadrunner-2025.1.6-linux-amd64.tar.gz -O /tmp/rr.tar.gz && \
    tar -xzf /tmp/rr.tar.gz -C /tmp && \
    mv /tmp/roadrunner-2025.1.6-linux-amd64/rr /var/www/html/rr && \
    chmod +x /var/www/html/rr && \
    rm -rf /tmp/roadrunner-* /tmp/rr.tar.gz || true

# Expose port
EXPOSE 8000

# Default command
CMD ["php", "artisan", "octane:start", "--server=swoole", "--host=0.0.0.0", "--port=8000"]
