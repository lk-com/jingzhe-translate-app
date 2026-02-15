## ADDED Requirements

### Requirement: System provides predefined language list
The system SHALL provide a standardized list of supported languages for selection.

#### Scenario: Display language options
- **WHEN** user opens language selection interface
- **THEN** system displays supported languages with code, native name, and English name
- **AND** languages include: en, zh-CN, zh-TW, ja, ko, es, fr, de, pt, ru, ar, hi, it, nl, pl, tr, vi, th, id, ms

#### Scenario: Select multiple target languages
- **WHEN** user selects target languages
- **THEN** system allows multi-select
- **AND** validates at least one language is selected
- **AND** prevents selecting base language as target

### Requirement: User can visually select translation scope
The system SHALL provide a visual file tree interface for selecting which files to translate.

#### Scenario: Select individual files
- **WHEN** user clicks checkboxes next to Markdown files
- **THEN** system marks those files for translation
- **AND** updates the selection state in database

#### Scenario: Select entire directories
- **WHEN** user checks a directory checkbox
- **THEN** system selects all Markdown files within that directory
- **AND** maintains selection state for nested items

#### Scenario: Sync to ignore rules
- **WHEN** user modifies file selection
- **THEN** system generates corresponding ignore rules
- **AND** saves to .github-global-ignore configuration

### Requirement: System supports ignore rules configuration
The system SHALL support .github-global-ignore file for specifying files/directories to exclude from translation.

#### Scenario: Parse ignore rules
- **WHEN** system loads repository configuration
- **THEN** it parses .github-global-ignore file if exists
- **AND** applies rules to filter file tree display

#### Scenario: Edit ignore rules
- **WHEN** user edits ignore rules in text mode
- **THEN** system validates rule syntax
- **AND** saves rules to .github-global-ignore
- **AND** updates visual selection to reflect new rules

### Requirement: User can select AI model for translation
The system SHALL allow users to select which AI model to use for translation.

#### Scenario: Display available models
- **WHEN** user opens model selection
- **THEN** system displays available models from OpenRouter
- **AND** shows model info: name, provider, approximate cost per token

#### Scenario: Select model with BYOK
- **WHEN** user has provided their own OpenRouter API key
- **THEN** system allows selecting from all available models
- **AND** translates using user's API key

#### Scenario: Select model with platform quota
- **WHEN** user uses platform-provided translation
- **THEN** system may restrict model selection based on cost
- **AND** shows remaining quota to user
