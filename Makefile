SHELL := /bin/bash
.DEFAULT_GOAL := help

NVM_DIR ?= $(HOME)/.nvm
NODE_VERSION := $(shell cat .nvmrc)
args ?=

ifneq ($(strip $(AGENT)),)
export DATABASE_URL ?= postgresql://chores:chores@host.docker.internal:5432/chores
export AUTH_URL ?= http://host.docker.internal:3000
export SMTP_HOST ?= host.docker.internal
export E2E_MAILPIT_URL ?= http://host.docker.internal:8025
endif

export PLAYWRIGHT_BROWSERS_PATH ?= $(CURDIR)/.e2e/browsers

define run
@bash -lc 'set -eo pipefail; \
if [ -s "$(NVM_DIR)/nvm.sh" ]; then \
	source "$(NVM_DIR)/nvm.sh"; \
	nvm use "$(NODE_VERSION)" >/dev/null 2>&1 || nvm install "$(NODE_VERSION)"; \
fi; \
$(subst ','\'',$(1))'
endef

.PHONY: help install dev email-dev db-generate db-migrate db-reset seed-chores db-studio typecheck test test/e2e test/e2e/combined test/e2e/regressions test/e2e/contention e2e/install build lint lint-fix format format-write dev-check dev-fix

help:
	@printf '%s\n' \
	  'Available targets:' \
	  '  install      Install dependencies' \
	  '  dev          Run Next.js dev server' \
	  '  email-dev    Run React Email preview server' \
	  '  db-generate  Generate Drizzle migrations' \
	  '  db-migrate   Apply Drizzle migrations' \
	  '  db-reset     Reset DB schemas and migrate' \
	  '  seed-chores  Seed demo chores data' \
	  '  db-studio    Open Drizzle Studio' \
	  '  dev-check    Format, lint, test, typecheck' \
	  '  dev-fix      Auto-fix format/lint then test/typecheck'
	@printf '%s\n' \
	  '  e2e/install             Download Chromium into the configured browser cache' \
	  '  test/e2e                Run live smoke tests with a managed app' \
	  '  test/e2e/combined       Run smoke and regressions with one managed app' \
	  '  test/e2e/regressions    Run issue-linked regressions' \
	  '  test/e2e/contention     Run isolated database-pool contention regression' \
	  '  args="--grep ..."       Filter an E2E suite during iteration'

db-generate:
	$(call run,corepack yarn db:generate)

install:
	$(call run,corepack yarn@4.12.0 install --immutable)

dev:
	$(call run,corepack yarn dev)

email-dev:
	$(call run,corepack yarn email:dev)

db-migrate:
	$(call run,corepack yarn db:migrate)

db-reset:
	$(call run,corepack yarn db:reset)

seed-chores:
	$(call run,corepack yarn seed:chores)

db-studio:
	$(call run,corepack yarn db:studio)

typecheck:
	$(call run,corepack yarn typecheck)

test:
	$(call run,corepack yarn test)

# manual — requires local PostgreSQL, Mailpit and Chromium; see docs/e2e-testing.md
test/e2e:
	$(call run,corepack yarn test:e2e $(args))

# manual — smoke and regressions share one managed app; contention stays separate
test/e2e/combined:
	$(call run,corepack yarn test:e2e:combined $(args))

# manual — requires the live local stack
test/e2e/regressions:
	$(call run,corepack yarn test:e2e:regressions $(args))

# manual — intentionally saturates only the managed test app pool
test/e2e/contention:
	$(call run,corepack yarn test:e2e:contention $(args))

e2e/install:
	$(call run,corepack yarn e2e:install)

build:
	$(call run,corepack yarn build)

lint:
	$(call run,corepack yarn lint)

lint-fix:
	$(call run,corepack yarn lint:fix)

format:
	$(call run,corepack yarn format)

format-write:
	$(call run,corepack yarn format:write)

dev-check:
	$(call run,corepack yarn dev:check)

dev-fix:
	$(call run,corepack yarn dev:fix)
