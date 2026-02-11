package dto

type Response struct {
	Code      int         `json:"code"`
	Timestamp int64       `json:"timestamp"`
	Msg       string      `json:"msg"`
	Data      interface{} `json:"data,omitempty"`
}

type PaginationResponse[T any] struct {
	Total       int64 `json:"total"`
	Page        int   `json:"page"`
	PageSize    int   `json:"pageSize"`
	TotalPages  int   `json:"totalPages"`
	HasNext     bool  `json:"hasNext"`
	HasPrevious bool  `json:"hasPrevious"`
	Data        []T   `json:"data"`
}
