# Token Limit Configuration

This document describes the token limit configuration system used in the application.

## Overview

The token limit system manages several aspects of API usage:
- Token consumption limits (daily, monthly)
- Cost limits
- Rate limiting
- Warning thresholds
- Model optimization rules

## Configuration Structure

### Token Rates
Token rates are defined per model and split between prompt and completion tokens:
```typescript
TOKEN_RATES = {
  'gpt-4o-mini': {
    prompt: 0.03,
    completion: 0.06
  }
  // ... other models
}
```

### Token Limits
Token limits are enforced at multiple levels:
- Daily limits per model
- Monthly limits per model
- Cost limits (daily, monthly, annual)
- Rate limits (requests per minute)

### Warning Thresholds
The system uses three warning levels:
- WARNING (70% of limit)
- ELEVATED_WARNING (85% of limit)
- FINAL_WARNING (95% of limit)

## Usage Guidelines

1. **Checking Token Usage**
```typescript
const result = await limitEnforcement.checkTokenUsage(
  estimatedTokens,
  'gpt-4o-mini'
);
```

2. **Rate Limiting**
Rate limiting is automatically applied through middleware:
- Default: 60 requests per minute
- Burst: 100 requests per minute
- Window: 60 seconds

## Migration History

### v1.x.x - Configuration Consolidation
- Consolidated token configurations from separate files
- Preserved conservative limits from legacy system
- Enhanced rate limiting with burst capacity
- Added comprehensive test coverage

## Monitoring and Alerts

The system generates alerts when:
- Token usage approaches warning thresholds
- Cost limits are nearly reached
- Rate limits are consistently hit

## Configuration Changes

Any changes to limits or rates should:
1. Be reviewed by the team
2. Include corresponding test updates
3. Be deployed to staging first
4. Be monitored for at least 24 hours in production

## Emergency Procedures

In case of issues:
1. Monitor `/metrics` endpoint for usage spikes
2. Check logs for rate limit or token limit errors
3. Use rollback procedure if necessary