package handler

import (
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"appbox/server/internal/dto"
	"appbox/server/internal/service"
	"appbox/server/internal/util"
)

type AdminProviderHandler interface {
	ListProviders(c *fiber.Ctx) error
	ListUsers(c *fiber.Ctx) error
	ListUserPlanets(c *fiber.Ctx) error
	UpdateUser(c *fiber.Ctx) error
	DeleteUser(c *fiber.Ctx) error
	ListConfigs(c *fiber.Ctx) error
	UpsertConfig(c *fiber.Ctx) error
	DeleteConfig(c *fiber.Ctx) error
}

type adminProviderHandler struct {
	registry *service.ProviderRegistry
}

func NewAdminProviderHandler(registry *service.ProviderRegistry) AdminProviderHandler {
	return &adminProviderHandler{registry: registry}
}

func (h *adminProviderHandler) ListProviders(c *fiber.Ctx) error {
	return c.JSON(dto.Response{
		Code:      fiber.StatusOK,
		Timestamp: time.Now().UnixMilli(),
		Msg:       "success",
		Data:      h.registry.List(),
	})
}

func (h *adminProviderHandler) ListUsers(c *fiber.Ctx) error {
	provider, err := h.resolveProvider(c)
	if err != nil {
		return h.fail(c, err)
	}

	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("pageSize", c.QueryInt("page_size", 10))
	keyword := strings.TrimSpace(c.Query("keyword"))
	page, pageSize = util.GetPaginationParams(page, pageSize)

	result, err := provider.ListUsers(c.Context(), page, pageSize, keyword)
	if err != nil {
		return h.fail(c, err)
	}

	return c.JSON(dto.Response{Code: fiber.StatusOK, Timestamp: time.Now().UnixMilli(), Msg: "success", Data: result})
}

func (h *adminProviderHandler) ListUserPlanets(c *fiber.Ctx) error {
	provider, err := h.resolveProvider(c)
	if err != nil {
		return h.fail(c, err)
	}

	userID, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.Response{Code: fiber.StatusBadRequest, Timestamp: time.Now().UnixMilli(), Msg: "Invalid user id"})
	}

	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("pageSize", c.QueryInt("page_size", 10))
	page, pageSize = util.GetPaginationParams(page, pageSize)

	result, err := provider.ListUserPlanets(c.Context(), userID, page, pageSize)
	if err != nil {
		return h.fail(c, err)
	}

	return c.JSON(dto.Response{Code: fiber.StatusOK, Timestamp: time.Now().UnixMilli(), Msg: "success", Data: result})
}

func (h *adminProviderHandler) UpdateUser(c *fiber.Ctx) error {
	provider, err := h.resolveProvider(c)
	if err != nil {
		return h.fail(c, err)
	}

	userID, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.Response{Code: fiber.StatusBadRequest, Timestamp: time.Now().UnixMilli(), Msg: "Invalid user id"})
	}

	var req dto.AdminUserUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.Response{Code: fiber.StatusBadRequest, Timestamp: time.Now().UnixMilli(), Msg: "Invalid request body"})
	}

	updated, err := provider.UpdateUser(c.Context(), userID, req)
	if err != nil {
		return h.fail(c, err)
	}

	return c.JSON(dto.Response{Code: fiber.StatusOK, Timestamp: time.Now().UnixMilli(), Msg: "success", Data: updated})
}

func (h *adminProviderHandler) DeleteUser(c *fiber.Ctx) error {
	provider, err := h.resolveProvider(c)
	if err != nil {
		return h.fail(c, err)
	}

	userID, err := parseUintParam(c, "id")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.Response{Code: fiber.StatusBadRequest, Timestamp: time.Now().UnixMilli(), Msg: "Invalid user id"})
	}

	if err := provider.DeleteUser(c.Context(), userID); err != nil {
		return h.fail(c, err)
	}

	return c.JSON(dto.Response{Code: fiber.StatusOK, Timestamp: time.Now().UnixMilli(), Msg: "User deleted successfully"})
}

func (h *adminProviderHandler) ListConfigs(c *fiber.Ctx) error {
	provider, err := h.resolveProvider(c)
	if err != nil {
		return h.fail(c, err)
	}

	result, err := provider.ListConfigs(c.Context())
	if err != nil {
		return h.fail(c, err)
	}

	return c.JSON(dto.Response{Code: fiber.StatusOK, Timestamp: time.Now().UnixMilli(), Msg: "success", Data: result})
}

func (h *adminProviderHandler) UpsertConfig(c *fiber.Ctx) error {
	provider, err := h.resolveProvider(c)
	if err != nil {
		return h.fail(c, err)
	}

	key := strings.TrimSpace(c.Params("key"))
	if key == "" {
		return c.Status(fiber.StatusBadRequest).JSON(dto.Response{Code: fiber.StatusBadRequest, Timestamp: time.Now().UnixMilli(), Msg: "Config key is required"})
	}

	var req dto.AppConfigUpsertRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.Response{Code: fiber.StatusBadRequest, Timestamp: time.Now().UnixMilli(), Msg: "Invalid request body"})
	}

	result, err := provider.UpsertConfig(c.Context(), key, req)
	if err != nil {
		return h.fail(c, err)
	}

	return c.JSON(dto.Response{Code: fiber.StatusOK, Timestamp: time.Now().UnixMilli(), Msg: "success", Data: result})
}

func (h *adminProviderHandler) DeleteConfig(c *fiber.Ctx) error {
	provider, err := h.resolveProvider(c)
	if err != nil {
		return h.fail(c, err)
	}

	key := strings.TrimSpace(c.Params("key"))
	if key == "" {
		return c.Status(fiber.StatusBadRequest).JSON(dto.Response{Code: fiber.StatusBadRequest, Timestamp: time.Now().UnixMilli(), Msg: "Config key is required"})
	}

	if err := provider.DeleteConfig(c.Context(), key); err != nil {
		return h.fail(c, err)
	}

	return c.JSON(dto.Response{Code: fiber.StatusOK, Timestamp: time.Now().UnixMilli(), Msg: "Config deleted successfully"})
}

func (h *adminProviderHandler) resolveProvider(c *fiber.Ctx) (service.AdminProvider, error) {
	providerKey := strings.TrimSpace(c.Get("X-App-Key"))
	if providerKey == "" {
		providerKey = strings.TrimSpace(c.Query("app"))
	}
	return h.registry.Resolve(providerKey)
}

func (h *adminProviderHandler) fail(c *fiber.Ctx, err error) error {
	upErr := &service.UpstreamError{}
	if asUpstreamError(err, upErr) {
		code := upErr.StatusCode
		if code < 400 || code > 599 {
			code = fiber.StatusBadGateway
		}
		return c.Status(code).JSON(dto.Response{Code: code, Timestamp: time.Now().UnixMilli(), Msg: upErr.Message})
	}

	msg := err.Error()
	if strings.Contains(msg, "provider not found") {
		return c.Status(fiber.StatusBadRequest).JSON(dto.Response{Code: fiber.StatusBadRequest, Timestamp: time.Now().UnixMilli(), Msg: msg})
	}

	return c.Status(fiber.StatusInternalServerError).JSON(dto.Response{Code: fiber.StatusInternalServerError, Timestamp: time.Now().UnixMilli(), Msg: "Internal server error"})
}

func parseUintParam(c *fiber.Ctx, key string) (uint, error) {
	parsed, err := strconv.ParseUint(strings.TrimSpace(c.Params(key)), 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(parsed), nil
}

func asUpstreamError(err error, target *service.UpstreamError) bool {
	if err == nil {
		return false
	}
	current := err
	for current != nil {
		typed, ok := current.(*service.UpstreamError)
		if ok {
			target.StatusCode = typed.StatusCode
			target.Message = typed.Message
			return true
		}
		unwrapper, ok := current.(interface{ Unwrap() error })
		if !ok {
			break
		}
		current = unwrapper.Unwrap()
	}
	return false
}
