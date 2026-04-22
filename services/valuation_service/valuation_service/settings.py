"""
Django settings for valuation_service project.
"""

from pathlib import Path
from datetime import timedelta
from django.core.exceptions import ImproperlyConfigured
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

DEFAULT_SECRET_KEY = 'unsafe-valuation-dev-key-change-me'

SECRET_KEY = config('SECRET_KEY', default=DEFAULT_SECRET_KEY)
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = [
    host.strip()
    for host in config('ALLOWED_HOSTS', default='127.0.0.1,localhost').split(',')
    if host.strip()
]

if not DEBUG and SECRET_KEY == DEFAULT_SECRET_KEY:
    raise ImproperlyConfigured('SECRET_KEY must be set when DEBUG is disabled.')

# --------------- Application definition ---------------

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'django_filters',
    'corsheaders',
    # Our apps
    'valuation',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'valuation_service.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'valuation_service.wsgi.application'

# --------------- Database ---------------

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='carspecs_db'),
        'USER': config('DB_USER', default='carspecs_admin'),
        'PASSWORD': config('DB_PASSWORD', default='change-me'),
        'HOST': config('DB_HOST', default='127.0.0.1'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# --------------- DRF ---------------

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'valuation.authentication.ServiceJWTAuthentication',
        'valuation.authentication.ApiKeyAuthentication',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
}

JWT_SIGNING_KEY = config('JWT_SIGNING_KEY', default=SECRET_KEY)

SIMPLE_JWT = {
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': JWT_SIGNING_KEY,
    'VERIFYING_KEY': '',
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# --------------- CORS ---------------

CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=False, cast=bool)
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in config(
        'CORS_ALLOWED_ORIGINS',
        default='http://127.0.0.1:3000,http://localhost:3000',
    ).split(',')
    if origin.strip()
]

# --------------- Internal service URLs ---------------

VEHICLE_SERVICE_URL = config('VEHICLE_SERVICE_URL', default='http://127.0.0.1:8001')
VIN_SERVICE_URL = config('VIN_SERVICE_URL', default='http://127.0.0.1:8002')

# --------------- i18n ---------------

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# --------------- Static ---------------

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
