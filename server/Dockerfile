FROM golang:1.25-alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates tzdata git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/app-box-server ./cmd/server

FROM alpine:3.22

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

ARG ENV=production
ENV APP_ENV=${ENV}

COPY --from=builder /out/app-box-server /usr/local/bin/app-box-server

EXPOSE 8090

ENTRYPOINT ["app-box-server"]
