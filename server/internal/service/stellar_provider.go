package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"appbox/server/internal/config"
	"appbox/server/internal/dto"
)

type stellarProvider struct {
	cfg    config.StellarProviderConfig
	client *http.Client
}

type upstreamResponse[T any] struct {
	Code      int    `json:"code"`
	Timestamp int64  `json:"timestamp"`
	Msg       string `json:"msg"`
	Data      T      `json:"data"`
}

type voidData struct{}

func NewStellarProvider(cfg config.StellarProviderConfig) AdminProvider {
	return &stellarProvider{
		cfg: cfg,
		client: &http.Client{
			Timeout: cfg.Timeout,
		},
	}
}

func (p *stellarProvider) Name() string {
	return p.cfg.Name
}

func (p *stellarProvider) ListUsers(ctx context.Context, page, pageSize int, keyword string) (*dto.AdminUsersPaginationResponse, error) {
	q := url.Values{}
	q.Set("page", fmt.Sprintf("%d", page))
	q.Set("pageSize", fmt.Sprintf("%d", pageSize))
	if strings.TrimSpace(keyword) != "" {
		q.Set("keyword", strings.TrimSpace(keyword))
	}

	var result dto.AdminUsersPaginationResponse
	if err := p.doJSON(ctx, http.MethodGet, "/admin/users?"+q.Encode(), nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (p *stellarProvider) ListUserPlanets(ctx context.Context, userID uint, page, pageSize int) (*dto.PaginationResponse[dto.PlanetItem], error) {
	q := url.Values{}
	q.Set("page", fmt.Sprintf("%d", page))
	q.Set("pageSize", fmt.Sprintf("%d", pageSize))

	path := fmt.Sprintf("/admin/users/%d/planets?%s", userID, q.Encode())
	var result dto.PaginationResponse[dto.PlanetItem]
	if err := p.doJSON(ctx, http.MethodGet, path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (p *stellarProvider) UpdateUser(ctx context.Context, userID uint, req dto.AdminUserUpdateRequest) (*dto.User, error) {
	path := fmt.Sprintf("/admin/users/%d", userID)
	var result dto.User
	if err := p.doJSON(ctx, http.MethodPut, path, req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (p *stellarProvider) DeleteUser(ctx context.Context, userID uint) error {
	path := fmt.Sprintf("/admin/users/%d", userID)
	return p.doJSON(ctx, http.MethodDelete, path, nil, &voidData{})
}

func (p *stellarProvider) ListConfigs(ctx context.Context) ([]dto.AppConfig, error) {
	result := make([]dto.AppConfig, 0)
	if err := p.doJSON(ctx, http.MethodGet, "/admin/configs", nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (p *stellarProvider) UpsertConfig(ctx context.Context, key string, req dto.AppConfigUpsertRequest) (*dto.AppConfig, error) {
	path := fmt.Sprintf("/admin/configs/%s", url.PathEscape(key))
	var result dto.AppConfig
	if err := p.doJSON(ctx, http.MethodPut, path, req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (p *stellarProvider) DeleteConfig(ctx context.Context, key string) error {
	path := fmt.Sprintf("/admin/configs/%s", url.PathEscape(key))
	return p.doJSON(ctx, http.MethodDelete, path, nil, &voidData{})
}

func (p *stellarProvider) doJSON(ctx context.Context, method, path string, reqBody interface{}, out interface{}) error {
	fullURL := p.cfg.BaseURL + "/" + strings.TrimPrefix(path, "/")

	var bodyReader io.Reader
	if reqBody != nil {
		payload, err := json.Marshal(reqBody)
		if err != nil {
			return fmt.Errorf("marshal request failed: %w", err)
		}
		bodyReader = bytes.NewBuffer(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
	if err != nil {
		return fmt.Errorf("build request failed: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set(p.cfg.GatewayHead, p.cfg.GatewayKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("request upstream failed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read upstream response failed: %w", err)
	}

	var wrapped upstreamResponse[json.RawMessage]
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &wrapped); err != nil {
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				return fmt.Errorf("upstream response is not json: %s", string(raw))
			}
			return &UpstreamError{StatusCode: resp.StatusCode, Message: string(raw)}
		}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 || wrapped.Code != http.StatusOK {
		msg := strings.TrimSpace(wrapped.Msg)
		if msg == "" {
			msg = fmt.Sprintf("upstream request failed: status=%d", resp.StatusCode)
		}
		statusCode := resp.StatusCode
		if statusCode == 0 {
			statusCode = wrapped.Code
		}
		if statusCode == 0 {
			statusCode = http.StatusBadGateway
		}
		return &UpstreamError{StatusCode: statusCode, Message: msg}
	}

	if out == nil {
		return nil
	}
	if len(wrapped.Data) == 0 || string(wrapped.Data) == "null" {
		return nil
	}
	if err := json.Unmarshal(wrapped.Data, out); err != nil {
		return fmt.Errorf("unmarshal upstream data failed: %w", err)
	}
	return nil
}
