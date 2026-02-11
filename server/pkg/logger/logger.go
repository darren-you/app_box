package logger

import "log"

func Infof(format string, args ...interface{}) {
	log.Printf("[INFO] "+format, args...)
}

func Warnf(format string, args ...interface{}) {
	log.Printf("[WARN] "+format, args...)
}

func Errorf(format string, args ...interface{}) {
	log.Printf("[ERROR] "+format, args...)
}

func Fatalf(format string, args ...interface{}) {
	log.Fatalf("[FATAL] "+format, args...)
}
