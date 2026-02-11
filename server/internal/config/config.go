package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Server   ServerConfig
	CORS     CORSConfig
	JWT      JWTConfig
	Admin    AdminConfig
	Provider ProviderConfig
}

type ServerConfig struct {
	Host         string
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type CORSConfig struct {
	AllowOrigins string
}

type JWTConfig struct {
	SecretKey        string
	ExpiresIn        time.Duration
	RefreshExpiresIn time.Duration
}

type AdminConfig struct {
	Username string
	Email    string
	Password string
}

type ProviderConfig struct {
	Default string
	Stellar StellarProviderConfig
}

type StellarProviderConfig struct {
	Enabled     bool
	Name        string
	BaseURL     string
	GatewayKey  string
	GatewayHead string
	Timeout     time.Duration
}

func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			Port:         getEnvInt("SERVER_PORT", 8090),
			ReadTimeout:  getEnvDuration("SERVER_READ_TIMEOUT", 10*time.Second),
			WriteTimeout: getEnvDuration("SERVER_WRITE_TIMEOUT", 10*time.Second),
		},
		CORS: CORSConfig{
			AllowOrigins: getEnv("CORS_ALLOW_ORIGINS", "*"),
		},
		JWT: JWTConfig{
			SecretKey:        getEnv("JWT_SECRET_KEY", "please-change-this-secret"),
			ExpiresIn:        getEnvDuration("JWT_EXPIRES_IN", 2*time.Hour),
			RefreshExpiresIn: getEnvDuration("JWT_REFRESH_EXPIRES_IN", 168*time.Hour),
		},
		Admin: AdminConfig{
			Username: getEnv("ADMIN_USERNAME", "app_box_admin"),
			Email:    getEnv("ADMIN_EMAIL", "app_box_admin@local"),
			Password: getEnv("ADMIN_PASSWORD", "pass_the_appbox_admin"),
		},
		Provider: ProviderConfig{
			Default: strings.TrimSpace(getEnv("DEFAULT_APP_PROVIDER", "stellar")),
			Stellar: StellarProviderConfig{
				Enabled:     getEnvBool("STELLAR_ENABLED", true),
				Name:        strings.TrimSpace(getEnv("STELLAR_PROVIDER_NAME", "stellar")),
				BaseURL:     normalizeBaseURL(getEnv("STELLAR_API_BASE_URL", "http://127.0.0.1:8080/api/v1")),
				GatewayKey:  strings.TrimSpace(getEnv("STELLAR_GATEWAY_KEY", "")),
				GatewayHead: strings.TrimSpace(getEnv("STELLAR_GATEWAY_HEADER", "X-Gateway-Key")),
				Timeout:     getEnvDuration("STELLAR_TIMEOUT", 10*time.Second),
			},
		},
	}

	if cfg.Provider.Stellar.Enabled {
		if cfg.Provider.Stellar.Name == "" {
			return nil, fmt.Errorf("STELLAR_PROVIDER_NAME is required when stellar provider is enabled")
		}
		if cfg.Provider.Stellar.BaseURL == "" {
			return nil, fmt.Errorf("STELLAR_API_BASE_URL is required when stellar provider is enabled")
		}
		if cfg.Provider.Stellar.GatewayKey == "" {
			return nil, fmt.Errorf("STELLAR_GATEWAY_KEY is required when stellar provider is enabled")
		}
		if cfg.Provider.Stellar.GatewayHead == "" {
			cfg.Provider.Stellar.GatewayHead = "X-Gateway-Key"
		}
	}

	if cfg.Provider.Default == "" {
		cfg.Provider.Default = cfg.Provider.Stellar.Name
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func normalizeBaseURL(raw string) string {
	return strings.TrimRight(strings.TrimSpace(raw), "/")
}
