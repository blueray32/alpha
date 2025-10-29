# Changelog

All notable changes to the Alpha multi-agent development system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Model autodiscovery service with intelligent fallback chain (Anthropic → OpenAI)
- Support for both Anthropic and OpenAI providers in conversational agents
- Automatic model selection by preference: Sonnet → Opus → Haiku
- Safe fallback to OpenAI when Anthropic is unavailable
- Environment variable `OPENAI_TEXT_MODEL` for configuring OpenAI fallback model

### Changed
- Agent chat system now discovers models at runtime instead of using hardcoded IDs
- CLI now supports both `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
- Improved error handling with graceful fallback to demo mode

### Fixed
- 404 errors from hardcoded Claude model IDs
- API key handling now never logs sensitive credentials

## [0.1.0] - 2025-01-29

### Added
- Initial release of Alpha multi-agent orchestration system
- Three specialist agents: Forge (backend), Blink (frontend), QA-Lens (testing)
- Alpha orchestrator persona for coordinating agents
- Contract guard system for directory scope enforcement
- Validation runner with Playwright support (stubbed)
- Tower UI for observability via SSE
- TinyLink URL shortener demo application
- Interactive CLI chat interface with agent personas
- OpenAI Realtime API integration for voice (partial)
- Agent persona system with distinct personalities and voices

### Security
- API keys loaded only from environment variables
- No keys stored or committed to repository
- Keys masked in logs and error messages
