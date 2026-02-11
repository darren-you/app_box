package service

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"appbox/server/internal/dto"
)

type AdminProvider interface {
	Name() string
	ListUsers(ctx context.Context, page, pageSize int, keyword string) (*dto.AdminUsersPaginationResponse, error)
	ListUserPlanets(ctx context.Context, userID uint, page, pageSize int) (*dto.PaginationResponse[dto.PlanetItem], error)
	UpdateUser(ctx context.Context, userID uint, req dto.AdminUserUpdateRequest) (*dto.User, error)
	DeleteUser(ctx context.Context, userID uint) error
	ListConfigs(ctx context.Context) ([]dto.AppConfig, error)
	UpsertConfig(ctx context.Context, key string, req dto.AppConfigUpsertRequest) (*dto.AppConfig, error)
	DeleteConfig(ctx context.Context, key string) error
}

type ProviderRegistry struct {
	mu         sync.RWMutex
	providers  map[string]AdminProvider
	defaultKey string
}

func NewProviderRegistry(defaultKey string) *ProviderRegistry {
	return &ProviderRegistry{
		providers:  make(map[string]AdminProvider),
		defaultKey: strings.TrimSpace(defaultKey),
	}
}

func (r *ProviderRegistry) Register(key string, provider AdminProvider) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.providers[strings.TrimSpace(key)] = provider
}

func (r *ProviderRegistry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	keys := make([]string, 0, len(r.providers))
	for k := range r.providers {
		keys = append(keys, k)
	}
	return keys
}

func (r *ProviderRegistry) Resolve(providerKey string) (AdminProvider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	key := strings.TrimSpace(providerKey)
	if key == "" {
		key = r.defaultKey
	}
	provider, ok := r.providers[key]
	if !ok {
		return nil, fmt.Errorf("provider not found: %s", key)
	}
	return provider, nil
}
