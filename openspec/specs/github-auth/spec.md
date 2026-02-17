## Requirements

### Requirement: User can login with GitHub OAuth
The system SHALL provide GitHub OAuth authentication allowing users to login with their GitHub account.

#### Scenario: Successful OAuth login
- **WHEN** user clicks "Login with GitHub" button
- **THEN** system redirects user to GitHub OAuth authorization page
- **AND** requests OAuth scopes: `repo`, `user:email`, `read:user`
- **AND** after user authorizes, system creates or updates user record
- **AND** system establishes an authenticated session

#### Scenario: User denies authorization
- **WHEN** user denies GitHub OAuth authorization
- **THEN** system redirects to login page with error message
- **AND** no user record is created

### Requirement: System requests appropriate OAuth scopes
The system SHALL request the following OAuth scopes for proper functionality:

| Scope | Purpose |
|-------|---------|
| `repo` | Read repository content, write translation files, create commits, create PRs, configure Webhooks |
| `user:email` | Get user email for commit submission |
| `read:user` | Get user basic information |

#### Scenario: Scope granted
- **WHEN** user grants all requested OAuth scopes
- **THEN** system stores the access token with granted scopes
- **AND** user can access all platform features

#### Scenario: Partial scope granted
- **WHEN** user grants only partial scopes
- **THEN** system stores the access token
- **AND** system warns user about limited functionality
- **AND** user can re-authorize to grant additional scopes

### Requirement: System encrypts sensitive user data
The system SHALL encrypt GitHub access tokens and OpenRouter API keys using AES-256-GCM encryption before storage.

#### Scenario: Storing GitHub token
- **WHEN** user completes OAuth flow
- **THEN** system encrypts the GitHub access token
- **AND** stores only the encrypted ciphertext in database

#### Scenario: Storing OpenRouter API key
- **WHEN** user saves their OpenRouter API key in settings
- **THEN** system encrypts the API key
- **AND** stores only the encrypted ciphertext in database

### Requirement: User can logout
The system SHALL allow authenticated users to logout and revoke their session. When a user logs out, the system MUST delete the session data from Redis immediately.

#### Scenario: Successful logout
- **WHEN** authenticated user clicks "Logout"
- **THEN** system retrieves the session ID from the session cookie
- **AND** system deletes the session data from Redis
- **AND** system clears the session cookie
- **AND** redirects user to homepage

#### Scenario: Logout with invalid session
- **WHEN** user clicks "Logout" but session is already invalid or expired
- **THEN** system clears the session cookie
- **AND** redirects user to homepage
- **AND** no error is raised

#### Scenario: Redis deletion failure
- **WHEN** authenticated user clicks "Logout" but Redis deletion fails
- **THEN** system still clears the session cookie
- **AND** redirects user to homepage
- **AND** logs the error for monitoring

### Requirement: User can view and update their settings
The system SHALL provide a settings page where users can configure their OpenRouter API key and default preferences.

#### Scenario: Update API key
- **WHEN** user enters a valid OpenRouter API key
- **THEN** system validates the key format
- **AND** encrypts and stores the key
- **AND** confirms successful update to user

#### Scenario: Remove API key
- **WHEN** user removes their OpenRouter API key
- **THEN** system deletes the stored key
- **AND** reverts to platform-provided translation quota

### Requirement: Platform provides hosted AI translation quota
The system SHALL provide platform-hosted AI translation quota for users without their own API key.

#### Scenario: Use platform quota
- **WHEN** user has no OpenRouter API key configured
- **THEN** system uses platform-provided AI quota for translation
- **AND** displays remaining quota to user

#### Scenario: Platform quota exhausted
- **WHEN** user's platform quota is exhausted
- **THEN** system prompts user to provide their own API key
- **OR** wait for quota reset (daily/monthly)

### Requirement: System implements rate limiting
The system SHALL implement multi-level rate limiting to prevent abuse.

#### Scenario: User rate limit hit
- **WHEN** user exceeds rate limit (100 files/hour)
- **THEN** system returns 429 status with retry-after header
- **AND** displays remaining time until limit reset

#### Scenario: IP rate limit hit
- **WHEN** IP exceeds rate limit (60 requests/minute)
- **THEN** system returns 429 status
- **AND** logs the event for security monitoring

#### Scenario: Whitelisted user bypasses limit
- **WHEN** whitelisted user makes requests
- **THEN** system skips rate limit checks
- **AND** processes request normally

### Requirement: System implements CSRF protection
The system SHALL implement CSRF protection for OAuth flow using state parameter validation.

#### Scenario: Generate and validate state parameter
- **WHEN** user initiates OAuth login
- **THEN** system generates random state string (32 characters)
- **AND** stores state in session with timestamp
- **AND** includes state in authorization URL

#### Scenario: Validate state on callback
- **WHEN** GitHub redirects back with state parameter
- **THEN** system compares state against session-stored value
- **AND** rejects request if state does not match
- **AND** rejects request if state is older than 10 minutes

### Requirement: System implements secure session management
The system SHALL implement secure session management with appropriate cookie attributes.

#### Scenario: Set secure session cookie
- **WHEN** user successfully authenticates
- **THEN** system creates session with HttpOnly cookie
- **AND** sets Secure flag in production environment
- **AND** sets SameSite=Lax attribute
- **AND** sets appropriate max-age (7 days)
