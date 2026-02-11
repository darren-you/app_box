package dto

// AdminUserUpdateRequest 管理端更新用户
// 字段与前端保持一致
//nolint:tagliatelle
type AdminUserUpdateRequest struct {
	Username              *string `json:"username"`
	Avatar                *string `json:"avatar"`
	Role                  *string `json:"role"`
	Status                *string `json:"status"`
	IsSubscriber          *bool   `json:"isSubscriber"`
	SubscriptionExpiresAt *string `json:"subscriptionExpiresAt"`
}

type AdminUsersPaginationResponse struct {
	PaginationResponse[User]
	SubscriberTotal int64 `json:"subscriberTotal"`
}

type User struct {
	ID                    uint    `json:"id"`
	Username              string  `json:"username"`
	Phone                 string  `json:"phone"`
	Avatar                string  `json:"avatar"`
	Role                  string  `json:"role"`
	Status                string  `json:"status"`
	IsSubscriber          bool    `json:"isSubscriber"`
	SubscriptionExpiresAt *string `json:"subscriptionExpiresAt"`
	CreatedAt             string  `json:"createdAt"`
}

type PlanetItem struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	UserID    uint     `json:"userId"`
	ImageURL  string   `json:"imageUrl"`
	DateKey   string   `json:"dateKey"`
	PlanetNo  string   `json:"planetNo"`
	Keywords  []string `json:"keywords"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt"`
}

type AppConfig struct {
	ID          uint   `json:"id"`
	ConfigKey   string `json:"configKey"`
	Alias       string `json:"alias"`
	ConfigValue string `json:"configValue"`
	ValueType   string `json:"valueType"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type AppConfigUpsertRequest struct {
	Alias       string `json:"alias"`
	ConfigValue string `json:"configValue"`
	ValueType   string `json:"valueType"`
	Description string `json:"description"`
}
