package router

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"appbox/appbox_server/internal/api/handler"
	"appbox/appbox_server/internal/dto"
	"appbox/appbox_server/internal/service"
)

func SetupRoutes(app *fiber.App, registry *service.ProviderRegistry) {
	adminProviderHandler := handler.NewAdminProviderHandler(registry)

	api := app.Group("/api")
	v1 := api.Group("/v1")

	v1.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(dto.Response{
			Code:      fiber.StatusOK,
			Timestamp: time.Now().UnixMilli(),
			Msg:       "ok",
			Data: fiber.Map{
				"service": "appbox_server",
			},
		})
	})

	admin := v1.Group("/admin")
	admin.Get("/providers", adminProviderHandler.ListProviders)
	admin.Get("/users", adminProviderHandler.ListUsers)
	admin.Get("/users/:id/planets", adminProviderHandler.ListUserPlanets)
	admin.Put("/users/:id", adminProviderHandler.UpdateUser)
	admin.Delete("/users/:id", adminProviderHandler.DeleteUser)
	admin.Get("/configs", adminProviderHandler.ListConfigs)
	admin.Put("/configs/:key", adminProviderHandler.UpsertConfig)
	admin.Delete("/configs/:key", adminProviderHandler.DeleteConfig)
}
