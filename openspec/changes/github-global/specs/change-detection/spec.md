## ADDED Requirements

### Requirement: System detects file changes between commits
The system SHALL detect which Markdown files have changed between the last translated commit and the current HEAD.

#### Scenario: Compare commits for changes
- **WHEN** user requests incremental translation
- **THEN** system fetches commit history from last_commit_sha to HEAD
- **AND** identifies all Markdown files modified in those commits

#### Scenario: Handle initial translation (no baseline)
- **WHEN** repository has no last_commit_sha (first translation)
- **THEN** system treats all selected files as changed
- **AND** performs full translation

#### Scenario: Handle force push or history rewrite
- **WHEN** last_commit_sha is not found in repository history
- **THEN** system falls back to full translation
- **AND** logs a warning about baseline reset

### Requirement: System filters files by translation scope
The system SHALL filter detected changes to only include files within the configured translation scope.

#### Scenario: Filter by selected files
- **WHEN** changes are detected
- **THEN** system filters to only include files selected in translation config
- **AND** ignores files matching .github-global-ignore rules

#### Scenario: Filter by file type
- **WHEN** scanning for changes
- **THEN** system only considers Markdown files (.md, .markdown)
- **AND** ignores other file types

### Requirement: System performs incremental translation
The system SHALL translate only changed files rather than all files when incremental mode is selected.

#### Scenario: Translate only changed files
- **WHEN** user triggers incremental translation
- **THEN** system identifies changed files
- **AND** only sends changed files to translation engine
- **AND** leaves existing translations untouched

#### Scenario: Handle deleted source files
- **WHEN** a source Markdown file is deleted
- **THEN** system marks corresponding translations for deletion
- **AND** notifies user of pending deletions

### Requirement: System commits translations to GitHub
The system SHALL create commits in the GitHub repository with translated files.

#### Scenario: Create commit with translations
- **WHEN** translation completes and user approves
- **THEN** system creates a new commit via GitHub API
- **AND** adds/updates translated files in translations/{lang}/ directories
- **AND** uses descriptive commit message indicating languages translated

#### Scenario: Handle commit conflicts
- **WHEN** repository has new commits since translation started
- **THEN** system attempts to rebase or create commit on current HEAD
- **AND** if conflict occurs, notifies user to retry

#### Scenario: Create pull request option
- **WHEN** user prefers PR workflow over direct commit
- **THEN** system creates a new branch
- **AND** pushes translations to that branch
- **AND** creates a pull request with translation summary

### Requirement: System uses Redis for caching GitHub API responses
The system SHALL cache GitHub API responses in Redis to optimize performance and reduce API calls.

#### Scenario: Cache commit history
- **WHEN** system fetches commit history for change detection
- **THEN** system caches the response in Redis with appropriate TTL
- **AND** subsequent requests use cached data when available

#### Scenario: Cache file tree
- **WHEN** system fetches repository file tree
- **THEN** system caches the tree structure in Redis
- **AND** invalidates cache when new commits are detected
