package service

import "fmt"

type UpstreamError struct {
	StatusCode int
	Message    string
}

func (e *UpstreamError) Error() string {
	if e == nil {
		return "upstream error"
	}
	if e.Message == "" {
		return fmt.Sprintf("upstream status=%d", e.StatusCode)
	}
	return e.Message
}
