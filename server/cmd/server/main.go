package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"

	"appbox/server/internal/api/router"
	"appbox/server/internal/config"
	"appbox/server/internal/service"
	"appbox/server/internal/util"
	"appbox/server/pkg/logger"
)

func main() {
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatalf("load config failed: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName:               "app-box-server",
		DisableStartupMessage: true,
		ReadTimeout:           cfg.Server.ReadTimeout,
		WriteTimeout:          cfg.Server.WriteTimeout,
	})

	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.CORS.AllowOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-App-Key",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
	}))

	jwtConfig := util.JWTConfig{
		SecretKey:        cfg.JWT.SecretKey,
		ExpiresIn:        cfg.JWT.ExpiresIn,
		RefreshExpiresIn: cfg.JWT.RefreshExpiresIn,
	}

	adminAuthService := service.NewAdminAuthService(cfg.Admin, jwtConfig)
	registry := service.NewProviderRegistry(cfg.Provider.Default)

	if cfg.Provider.Stellar.Enabled {
		stellarProvider := service.NewStellarProvider(cfg.Provider.Stellar)
		registry.Register(stellarProvider.Name(), stellarProvider)
		logger.Infof("provider registered: %s -> %s", stellarProvider.Name(), cfg.Provider.Stellar.BaseURL)
	}

	router.SetupRoutes(app, adminAuthService, registry, jwtConfig)

	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	go func() {
		logger.Infof("app-box server started at %s", addr)
		if err := app.Listen(addr); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("app listen failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := app.ShutdownWithContext(ctx); err != nil {
		logger.Errorf("app shutdown failed: %v", err)
	}
}
