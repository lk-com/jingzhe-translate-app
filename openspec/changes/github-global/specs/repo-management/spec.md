## ADDED Requirements

### Requirement: User can import GitHub repositories
The system SHALL allow authenticated users to import their accessible GitHub repositories.

#### Scenario: List user repositories
- **WHEN** authenticated user requests repository list
- **THEN** system fetches repositories from GitHub API
- **AND** displays repositories with name, description, and language

#### Scenario: Import a repository
- **WHEN** user selects a repository to import
- **THEN** system validates repository accessibility
- **AND** creates a repository record with default configuration
- **AND** fetches initial repository metadata (default branch, last commit SHA)

#### Scenario: Repository already imported
- **WHEN** user tries to import an already imported repository
- **THEN** system shows the existing repository configuration
- **AND** offers to navigate to repository details

### Requirement: System displays repository file tree
The system SHALL display the repository's file tree structure for translation scope selection.

#### Scenario: Load file tree
- **WHEN** user opens repository configuration page
- **THEN** system fetches repository contents from GitHub API
- **AND** displays hierarchical file tree with directories and Markdown files
- **AND** indicates which files are currently selected for translation

#### Scenario: Handle large repositories
- **WHEN** repository has many files (>1000)
- **THEN** system loads file tree with pagination or lazy loading
- **AND** shows loading indicator during fetch

### Requirement: User can configure repository translation settings
The system SHALL allow users to configure repository-specific translation settings.

#### Scenario: Set base and target languages
- **WHEN** user configures repository settings
- **THEN** system allows selecting one base language (source)
- **AND** allows selecting multiple target languages
- **AND** validates at least one target language is selected

#### Scenario: Save configuration
- **WHEN** user saves repository configuration
- **THEN** system persists settings to database
- **AND** shows success confirmation

### Requirement: System stores repository state
The system SHALL maintain repository state including last translated commit SHA for incremental translation support.

#### Scenario: Record commit SHA after translation
- **WHEN** translation task completes successfully
- **THEN** system updates the repository's last_commit_sha field
- **AND** this SHA is used as baseline for next incremental translation

### Requirement: System persists repository data in MySQL
The system SHALL store repository configuration and state in MySQL database with proper indexing.

#### Scenario: Store repository record
- **WHEN** user imports a repository
- **THEN** system creates a record in repositories table
- **AND** includes fields: user_id, github_repo_id, owner, name, default_branch, base_language, target_languages, ignore_rules, last_commit_sha

#### Scenario: Query repositories efficiently
- **WHEN** user requests their repository list
- **THEN** system queries using user_id index
- **AND** returns results with pagination support
