## MODIFIED Requirements

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
