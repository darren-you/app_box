package handler

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"appbox/server/internal/dto"
	"appbox/server/internal/service"
)

type AdminAuthHandler interface {
	Login(c *fiber.Ctx) error
	GetMe(c *fiber.Ctx) error
}

type adminAuthHandler struct {
	service service.AdminAuthService
}

func NewAdminAuthHandler(service service.AdminAuthService) AdminAuthHandler {
	return &adminAuthHandler{service: service}
}

func (h *adminAuthHandler) Login(c *fiber.Ctx) error {
	if h.service == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(dto.Response{
			Code:      fiber.StatusServiceUnavailable,
			Timestamp: time.Now().UnixMilli(),
			Msg:       "Admin auth service unavailable",
		})
	}

	var req dto.AdminLoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(dto.Response{
			Code:      fiber.StatusBadRequest,
			Timestamp: time.Now().UnixMilli(),
			Msg:       "Invalid request body",
		})
	}

	resp, err := h.service.Login(c.Context(), req.Password)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "invalid") {
			return c.Status(fiber.StatusUnauthorized).JSON(dto.Response{
				Code:      fiber.StatusUnauthorized,
				Timestamp: time.Now().UnixMilli(),
				Msg:       "invalid password",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(dto.Response{
			Code:      fiber.StatusInternalServerError,
			Timestamp: time.Now().UnixMilli(),
			Msg:       "Internal server error",
		})
	}

	return c.JSON(dto.Response{
		Code:      fiber.StatusOK,
		Timestamp: time.Now().UnixMilli(),
		Msg:       "success",
		Data:      resp,
	})
}

func (h *adminAuthHandler) GetMe(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(uint)
	username, _ := c.Locals("username").(string)
	email, _ := c.Locals("email").(string)
	role, _ := c.Locals("role").(string)

	return c.JSON(dto.Response{
		Code:      fiber.StatusOK,
		Timestamp: time.Now().UnixMilli(),
		Msg:       "success",
		Data: dto.AdminProfileResponse{
			UserID:   userID,
			Username: username,
			Email:    email,
			Role:     role,
		},
	})
}
