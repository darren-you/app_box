package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig
	CORS     CORSConfig
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

type ProviderConfig struct {
	Default  string
	Stellar  StellarProviderConfig
	TinyText TinyTextProviderConfig
}

type StellarProviderConfig struct {
	Enabled     bool
	Name        string
	BaseURL     string
	GatewayKey  string
	GatewayHead string
	Timeout     time.Duration
}

type TinyTextProviderConfig struct {
	Enabled     bool
	Name        string
	BaseURL     string
	GatewayKey  string
	GatewayHead string
	Timeout     time.Duration
}

func Load() (*Config, error) {
	cfgPath, err := resolveConfigPath()
	if err != nil {
		return nil, err
	}

	raw := defaultRawConfig()
	data, err := os.ReadFile(cfgPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file %q: %w", cfgPath, err)
	}
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse config file %q: %w", cfgPath, err)
	}

	cfg := &Config{
		Server: ServerConfig{
			Host:         normalizeString(raw.Server.Host, "0.0.0.0"),
			Port:         normalizeInt(raw.Server.Port, 8090),
			ReadTimeout:  parseDuration(raw.Server.ReadTimeout, 10*time.Second),
			WriteTimeout: parseDuration(raw.Server.WriteTimeout, 10*time.Second),
		},
		CORS: CORSConfig{
			AllowOrigins: normalizeString(raw.CORS.AllowOrigins, "*"),
		},
		Provider: ProviderConfig{
			Default: strings.TrimSpace(raw.Provider.Default),
			Stellar: StellarProviderConfig{
				Enabled:     raw.Provider.Stellar.Enabled,
				Name:        normalizeString(raw.Provider.Stellar.Name, "stellar"),
				BaseURL:     normalizeBaseURL(raw.Provider.Stellar.BaseURL),
				GatewayKey:  strings.TrimSpace(raw.Provider.Stellar.GatewayKey),
				GatewayHead: normalizeString(raw.Provider.Stellar.GatewayHead, "X-Gateway-Key"),
				Timeout:     parseDuration(raw.Provider.Stellar.Timeout, 10*time.Second),
			},
			TinyText: TinyTextProviderConfig{
				Enabled:     raw.Provider.TinyText.Enabled,
				Name:        normalizeString(raw.Provider.TinyText.Name, "tinytext"),
				BaseURL:     normalizeBaseURL(raw.Provider.TinyText.BaseURL),
				GatewayKey:  strings.TrimSpace(raw.Provider.TinyText.GatewayKey),
				GatewayHead: normalizeString(raw.Provider.TinyText.GatewayHead, "X-Gateway-Key"),
				Timeout:     parseDuration(raw.Provider.TinyText.Timeout, 10*time.Second),
			},
		},
	}

	if cfg.Provider.Stellar.Enabled {
		if cfg.Provider.Stellar.Name == "" {
			return nil, fmt.Errorf("provider.stellar.name is required when stellar provider is enabled")
		}
		if cfg.Provider.Stellar.BaseURL == "" {
			return nil, fmt.Errorf("provider.stellar.base_url is required when stellar provider is enabled")
		}
		if cfg.Provider.Stellar.GatewayKey == "" {
			return nil, fmt.Errorf("provider.stellar.gateway_key is required when stellar provider is enabled")
		}
	}

	if cfg.Provider.TinyText.Enabled {
		if cfg.Provider.TinyText.Name == "" {
			return nil, fmt.Errorf("provider.tinytext.name is required when tinytext provider is enabled")
		}
		if cfg.Provider.TinyText.BaseURL == "" {
			return nil, fmt.Errorf("provider.tinytext.base_url is required when tinytext provider is enabled")
		}
		if cfg.Provider.TinyText.GatewayKey == "" {
			return nil, fmt.Errorf("provider.tinytext.gateway_key is required when tinytext provider is enabled")
		}
	}

	if cfg.Provider.Default == "" && cfg.Provider.Stellar.Enabled {
		cfg.Provider.Default = cfg.Provider.Stellar.Name
	}
	if cfg.Provider.Default == "" && cfg.Provider.TinyText.Enabled {
		cfg.Provider.Default = cfg.Provider.TinyText.Name
	}
	return cfg, nil
}

type rawConfig struct {
	Server   rawServerConfig   `yaml:"server"`
	CORS     rawCORSConfig     `yaml:"cors"`
	Provider rawProviderConfig `yaml:"provider"`
}

type rawServerConfig struct {
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	ReadTimeout  string `yaml:"read_timeout"`
	WriteTimeout string `yaml:"write_timeout"`
}

type rawCORSConfig struct {
	AllowOrigins string `yaml:"allow_origins"`
}

type rawProviderConfig struct {
	Default  string                 `yaml:"default"`
	Stellar  rawProviderItemConfig  `yaml:"stellar"`
	TinyText rawProviderItemConfig  `yaml:"tinytext"`
}

type rawProviderItemConfig struct {
	Enabled     bool   `yaml:"enabled"`
	Name        string `yaml:"name"`
	BaseURL     string `yaml:"base_url"`
	GatewayKey  string `yaml:"gateway_key"`
	GatewayHead string `yaml:"gateway_header"`
	Timeout     string `yaml:"timeout"`
}

func defaultRawConfig() rawConfig {
	return rawConfig{
		Server: rawServerConfig{
			Host:         "0.0.0.0",
			Port:         8090,
			ReadTimeout:  "10s",
			WriteTimeout: "10s",
		},
		CORS: rawCORSConfig{
			AllowOrigins: "*",
		},
		Provider: rawProviderConfig{
			Default: "",
			Stellar: rawProviderItemConfig{
				Enabled:     false,
				Name:        "stellar",
				BaseURL:     "http://127.0.0.1:8080/api/v1",
				GatewayKey:  "",
				GatewayHead: "X-Gateway-Key",
				Timeout:     "10s",
			},
			TinyText: rawProviderItemConfig{
				Enabled:     false,
				Name:        "tinytext",
				BaseURL:     "http://127.0.0.1:8081/api/v1",
				GatewayKey:  "",
				GatewayHead: "X-Gateway-Key",
				Timeout:     "10s",
			},
		},
	}
}

func resolveConfigPath() (string, error) {
	candidates := []string{
		filepath.Join("config", "config.yaml"),
		"config.yaml",
	}

	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("config file not found; tried: %s", strings.Join(candidates, ", "))
}

func normalizeString(value string, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func normalizeInt(value int, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func parseDuration(raw string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(raw)
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
