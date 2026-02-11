package router

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"appbox/server/internal/api/handler"
	"appbox/server/internal/api/middleware"
	"appbox/server/internal/constant"
	"appbox/server/internal/dto"
	"appbox/server/internal/service"
	"appbox/server/internal/util"
)

func SetupRoutes(app *fiber.App, adminAuthService service.AdminAuthService, registry *service.ProviderRegistry, jwtConfig util.JWTConfig) {
	authMiddleware := middleware.NewAuthMiddleware(jwtConfig)
	adminAuthHandler := handler.NewAdminAuthHandler(adminAuthService)
	adminProviderHandler := handler.NewAdminProviderHandler(registry)

	api := app.Group("/api")
	v1 := api.Group("/v1")

	public := v1.Group("/")
	public.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(dto.Response{
			Code:      fiber.StatusOK,
			Timestamp: time.Now().UnixMilli(),
			Msg:       "ok",
			Data: fiber.Map{
				"service": "app-box-server",
			},
		})
	})
	public.Post("/auth/admin/login", adminAuthHandler.Login)

	admin := v1.Group("/admin")
	admin.Use(authMiddleware.Authenticate)
	admin.Use(authMiddleware.RequireRole(constant.UserRoleAdmin))
	admin.Get("/auth/me", adminAuthHandler.GetMe)
	admin.Get("/providers", adminProviderHandler.ListProviders)
	admin.Get("/users", adminProviderHandler.ListUsers)
	admin.Get("/users/:id/planets", adminProviderHandler.ListUserPlanets)
	admin.Put("/users/:id", adminProviderHandler.UpdateUser)
	admin.Delete("/users/:id", adminProviderHandler.DeleteUser)
	admin.Get("/configs", adminProviderHandler.ListConfigs)
	admin.Put("/configs/:key", adminProviderHandler.UpsertConfig)
	admin.Delete("/configs/:key", adminProviderHandler.DeleteConfig)
}
