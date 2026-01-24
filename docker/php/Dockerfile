FROM php:8.4-cli-alpine

# Install dependencies and extensions
RUN apk add --no-cache \
    postgresql-dev \
    postgresql-client \
    libzip-dev \
    unzip \
    git \
    linux-headers

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

# Expose port
EXPOSE 8000

# Default command
CMD ["php", "artisan", "octane:start", "--server=swoole", "--host=0.0.0.0", "--port=8000"]
