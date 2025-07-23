# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sub-Merger-CFWorker is a Cloudflare Worker application that merges Clash subscription URLs and adds traffic routing configurations. It's built with Hono framework and provides a web interface for managing subscription sources.

## Development Commands

- `pnpm install` - Install dependencies
- `pnpm run dev` - Start local development server with Wrangler
- `pnpm run deploy` - Deploy to Cloudflare Workers with minification

## Architecture

### Core Components

- **Entry Point**: `src/index.tsx` - Main Hono application with routes and middleware
- **Types**: `src/types/types.d.ts` - TypeScript definitions for subscription types and data structures
- **Utilities**: `src/utils/` - Core business logic modules
- **Data**: `src/data/` - Default configurations and node data (now supports dynamic configuration)

### Key Features

1. **Authentication System**: Cookie-based auth with password hashing
2. **Subscription Management**: Web UI for managing subscription sources (monthly/traffic package types)
3. **Dynamic Configuration Management**: Interface for modifying self-hosted nodes and default YAML rules without code changes
4. **YAML Generation**: Converts subscription data to Clash-compatible YAML configs
5. **Caching Layer**: Uses Cloudflare KV for caching generated configs (auto-clears when configuration changes)
6. **Scheduled Updates**: Hourly cron job to refresh cached data
7. **Client Detection**: Serves different configs for Stash vs other clients

### Environment Configuration

Required environment variables are defined in `wrangler.toml.template`:
- `PASSWORD`, `SALT` - Authentication credentials
- `TABLENAME`, `KEY_VERSION` - KV storage keys
- `MAGIC` - URL magic string for subscription endpoints
- Pattern matching variables for different service types (YouTube, Telegram, etc.)

### API Endpoints

- `/` - Login page (redirects to dashboard if authenticated)
- `/dashboard` - Subscription management interface with configuration management
- `/subscribe/:magic` - Monthly subscription YAML endpoint
- `/onetime/:magic` - Traffic package subscription YAML endpoint
- `/api/save` - Save subscription configuration
- `/api/config` (GET) - Retrieve current configuration (self-hosted nodes + default YAML)
- `/api/config` (POST) - Save configuration settings

### Data Flow

1. User configures subscription sources and system configurations via web interface
2. Data stored in Cloudflare KV (subscriptions and configurations stored separately)
3. Configuration changes automatically clear related caches
4. Scheduled task refreshes cached YAML configs hourly
5. Client requests trigger YAML generation with caching logic
6. Different YAML variants served based on client User-Agent

### Configuration Management

#### Self-hosted Nodes Configuration
- Stored as JSON array in KV storage under `${TABLENAME}:config`
- Automatically appends '【自建】' suffix to node names
- Falls back to hardcoded default if configuration is empty or invalid
- Accessible via `/api/config` endpoints

#### Default YAML Rules Configuration
- Stored as plain text YAML in KV storage under `${TABLENAME}:config`
- Contains DNS, rule providers, and routing rules
- Falls back to hardcoded default if configuration is empty
- Changes take effect immediately after saving

#### Cache Management
- Configuration changes automatically clear subscription caches
- Cache keys: `${TABLENAME}:${KEY_VERSION}:cacheObj:${SubscriptionType}`
- Ensures updated configurations are reflected in generated subscriptions

### Dependencies

- **Hono**: Web framework for Cloudflare Workers
- **dayjs**: Date/time manipulation with timezone support
- **yaml**: YAML parsing and generation
- **@cloudflare/workers-types**: TypeScript types for Workers environment

## Development Notes

- Uses pnpm for package management
- TypeScript with ESNext target
- JSX support via Hono's JSX runtime
- Wrangler for local development and deployment
- KV binding required: `SUB_MERGER_KV`
- Scheduled triggers run every hour (`0 */1 * * *`)
- Configuration data is stored separately from subscription data in KV storage