package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"appbox/server/internal/util"
)

type AuthMiddleware struct {
	jwtConfig util.JWTConfig
}

func NewAuthMiddleware(jwtConfig util.JWTConfig) *AuthMiddleware {
	return &AuthMiddleware{jwtConfig: jwtConfig}
}

func (m *AuthMiddleware) Authenticate(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"code":      fiber.StatusUnauthorized,
			"timestamp": time.Now().UnixMilli(),
			"msg":       "Token not provided",
		})
	}

	tokenString, err := util.ExtractTokenFromHeader(authHeader)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"code":      fiber.StatusUnauthorized,
			"timestamp": time.Now().UnixMilli(),
			"msg":       "Invalid token",
		})
	}

	claims, err := util.ParseToken(tokenString, m.jwtConfig.SecretKey)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"code":      fiber.StatusUnauthorized,
			"timestamp": time.Now().UnixMilli(),
			"msg":       "Invalid or expired token",
		})
	}

	c.Locals("userID", claims.UserID)
	c.Locals("username", claims.Username)
	c.Locals("email", claims.Email)
	c.Locals("role", claims.Role)

	return c.Next()
}

func (m *AuthMiddleware) RequireRole(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals("role").(string)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"code":      fiber.StatusUnauthorized,
				"timestamp": time.Now().UnixMilli(),
				"msg":       "Unauthorized",
			})
		}

		for _, allowed := range roles {
			if role == allowed {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"code":      fiber.StatusForbidden,
			"timestamp": time.Now().UnixMilli(),
			"msg":       "Forbidden",
		})
	}
}
