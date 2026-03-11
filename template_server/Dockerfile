# syntax=docker/dockerfile:1.7
# check=skip=InvalidDefaultArgInFrom
ARG BASE_IMAGE_REGISTRY
ARG BUILDER_BASE_IMAGE
ARG RUNTIME_BASE_IMAGE
ARG PROJECT_NAME

FROM ${BASE_IMAGE_REGISTRY}/${BUILDER_BASE_IMAGE} AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates tzdata git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG PROJECT_NAME
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/${PROJECT_NAME} ./cmd/server

FROM ${BASE_IMAGE_REGISTRY}/${RUNTIME_BASE_IMAGE}

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

ARG ENV
ARG PROJECT_NAME
ARG REMOTE_CONTAINER_PORT
ENV APP_ENV=${ENV}
ENV PROJECT_NAME=${PROJECT_NAME}
ENV SERVER_PORT=${REMOTE_CONTAINER_PORT}

COPY --from=builder /out/ /out/
RUN cp "/out/${PROJECT_NAME}" /usr/local/bin/server && rm -rf /out

EXPOSE ${REMOTE_CONTAINER_PORT}

ENTRYPOINT ["server"]
