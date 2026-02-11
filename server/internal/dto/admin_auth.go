package dto

type AdminLoginRequest struct {
	Password string `json:"password"`
}

type AdminLoginResponse struct {
	UserID       uint   `json:"userId"`
	Username     string `json:"username"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	Token        string `json:"token"`
}

type AdminProfileResponse struct {
	UserID   uint   `json:"userId"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}
