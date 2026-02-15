## ADDED Requirements

### Requirement: System translates Markdown content via OpenRouter API
The system SHALL translate Markdown file content using OpenRouter API with appropriate translation prompts.

#### Scenario: Translate a Markdown file
- **WHEN** translation task processes a Markdown file
- **THEN** system sends content to OpenRouter API with translation prompt
- **AND** specifies target language in request
- **AND** receives translated content

#### Scenario: Preserve Markdown formatting
- **WHEN** content contains Markdown syntax (headings, links, code blocks, etc.)
- **THEN** system instructs AI to preserve all Markdown formatting
- **AND** verifies output maintains valid Markdown structure

#### Scenario: Handle large files
- **WHEN** file content exceeds API token limit
- **THEN** system splits content into chunks
- **AND** translates chunks sequentially
- **AND** combines results maintaining context

### Requirement: System supports dual AI quota mode
The system SHALL support both platform-hosted quota and user-provided API key for translation.

#### Scenario: Use platform-hosted quota
- **WHEN** user has no OpenRouter API key configured
- **THEN** system uses platform-provided API key
- **AND** decrements user's platform quota
- **AND** displays remaining quota to user

#### Scenario: Use user-provided API key
- **WHEN** user has configured their own OpenRouter API key
- **THEN** system uses user's API key for translation
- **AND** does not consume platform quota
- **AND** user bears all API costs

#### Scenario: Platform quota exhausted
- **WHEN** platform quota is exhausted and user has no API key
- **THEN** system pauses translation task
- **AND** prompts user to provide their own API key
- **AND** allows user to continue with their key

### Requirement: System enforces rate limiting on translation
The system SHALL enforce rate limits to prevent abuse of AI translation resources.

#### Scenario: User file limit reached
- **WHEN** user exceeds file translation limit (100 files/hour)
- **THEN** system pauses translation task
- **AND** returns 429 status with retry-after information
- **AND** displays remaining time until limit reset

#### Scenario: Global AI call limit reached
- **WHEN** platform global AI call limit (10000/hour) is reached
- **THEN** system queues pending translation tasks
- **AND** processes them when quota resets
- **AND** notifies affected users of delay

### Requirement: System manages translation tasks asynchronously
The system SHALL process translation tasks asynchronously to handle long-running operations.

#### Scenario: Create translation task
- **WHEN** user initiates translation
- **THEN** system creates a translation task record with status "pending"
- **AND** queues the task for processing
- **AND** returns task ID for status tracking

#### Scenario: Process translation task
- **WHEN** worker picks up a pending task
- **THEN** status changes to "running"
- **AND** system processes files sequentially or with controlled concurrency
- **AND** updates progress (processed_files count) in real-time

#### Scenario: Complete translation task
- **WHEN** all files are processed
- **THEN** status changes to "completed"
- **AND** system stores results summary
- **AND** records final commit SHA for incremental tracking

#### Scenario: Handle translation failures
- **WHEN** a file translation fails
- **THEN** system retries up to 3 times with exponential backoff
- **AND** if still failing, marks file as failed
- **AND** continues with remaining files
- **AND** updates task with error details

### Requirement: System provides translation progress tracking
The system SHALL provide real-time progress information for active translation tasks.

#### Scenario: Query task status
- **WHEN** user requests translation status
- **THEN** system returns current status: pending, running, completed, or failed
- **AND** returns progress: total_files, processed_files, failed_files

#### Scenario: Display progress in UI
- **WHEN** translation is running
- **THEN** UI shows progress bar or percentage
- **AND** lists currently processing file
- **AND** updates without requiring page refresh

### Requirement: User can preview translation results
The system SHALL allow users to preview translated content before committing to GitHub.

#### Scenario: View file preview
- **WHEN** user requests preview for a translated file
- **THEN** system displays side-by-side diff of original and translated content
- **AND** highlights changes for easy review

#### Scenario: Navigate between files
- **WHEN** user is in preview mode
- **THEN** system allows navigating between all translated files
- **AND** shows overall progress through preview
