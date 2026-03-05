SHELL := /bin/bash
.DEFAULT_GOAL := help

NVM_DIR ?= $(HOME)/.nvm
NODE_VERSION := $(shell cat .nvmrc)

ifneq ($(strip $(AGENT)),)
export DATABASE_URL ?= postgresql://chores:chores@host.docker.internal:5432/chores
export AUTH_URL ?= http://host.docker.internal:3000
export SMTP_HOST ?= host.docker.internal
endif

define run
@bash -lc 'set -eo pipefail; \
if [ -s "$(NVM_DIR)/nvm.sh" ]; then \
	source "$(NVM_DIR)/nvm.sh"; \
	nvm install "$(NODE_VERSION)"; \
	nvm use "$(NODE_VERSION)" >/dev/null; \
	corepack enable >/dev/null 2>&1 || true; \
fi; \
$(1)'
endef

.PHONY: help install dev db-migrate db-reset seed-chores db-studio typecheck test build lint lint-fix format format-write dev-check dev-fix

help:
	@printf '%s\n' \
	  'Available targets:' \
	  '  install      Install dependencies' \
	  '  dev          Run Next.js dev server' \
	  '  db-migrate   Apply Drizzle migrations' \
	  '  db-reset     Reset DB schemas and migrate' \
	  '  seed-chores  Seed demo chores data' \
	  '  db-studio    Open Drizzle Studio' \
	  '  dev-check    Format, lint, test, typecheck' \
	  '  dev-fix      Auto-fix format/lint then test/typecheck'

install:
	$(call run,corepack yarn@4.12.0 install)

dev:
	$(call run,yarn dev)

db-migrate:
	$(call run,yarn db:migrate)

db-reset:
	$(call run,yarn db:reset)

seed-chores:
	$(call run,yarn seed:chores)

db-studio:
	$(call run,yarn db:studio)

typecheck:
	$(call run,yarn typecheck)

test:
	$(call run,yarn test)

build:
	$(call run,yarn build)

lint:
	$(call run,yarn lint)

lint-fix:
	$(call run,yarn lint:fix)

format:
	$(call run,yarn format)

format-write:
	$(call run,yarn format:write)

dev-check:
	$(call run,yarn dev:check)

dev-fix:
	$(call run,yarn dev:fix)
