package service

import (
	"context"
	"fmt"

	"appbox/server/internal/config"
	"appbox/server/internal/constant"
	"appbox/server/internal/dto"
	"appbox/server/internal/util"
)

const hardcodedAdminUserID uint = 1000001

type AdminAuthService interface {
	Login(ctx context.Context, password string) (*dto.AdminLoginResponse, error)
}

type adminAuthService struct {
	adminConfig config.AdminConfig
	jwtConfig   util.JWTConfig
}

func NewAdminAuthService(adminConfig config.AdminConfig, jwtConfig util.JWTConfig) AdminAuthService {
	return &adminAuthService{
		adminConfig: adminConfig,
		jwtConfig:   jwtConfig,
	}
}

func (s *adminAuthService) Login(_ context.Context, password string) (*dto.AdminLoginResponse, error) {
	if password != s.adminConfig.Password {
		return nil, fmt.Errorf("invalid admin credentials")
	}

	accessToken, err := util.GenerateToken(hardcodedAdminUserID, s.adminConfig.Username, s.adminConfig.Email, constant.UserRoleAdmin, s.jwtConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token")
	}

	refreshToken, err := util.GenerateRefreshToken(hardcodedAdminUserID, s.jwtConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token")
	}

	return &dto.AdminLoginResponse{
		UserID:       hardcodedAdminUserID,
		Username:     s.adminConfig.Username,
		Email:        s.adminConfig.Email,
		Role:         constant.UserRoleAdmin,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Token:        accessToken,
	}, nil
}
