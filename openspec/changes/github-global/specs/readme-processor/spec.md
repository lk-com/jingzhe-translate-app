## ADDED Requirements

### Requirement: System analyzes README structure with AI
The system SHALL use AI to analyze README structure and determine optimal insertion point for language switcher links.

#### Scenario: Analyze existing README
- **WHEN** translation includes README files
- **THEN** system sends README content to AI for structure analysis
- **AND** AI identifies document structure: title, description, TOC, existing language links

#### Scenario: Determine insertion strategy
- **WHEN** AI analyzes README
- **THEN** it classifies the structure into one of: has_existing_links, has_toc, has_description, minimal
- **AND** recommends insertion point based on classification

### Requirement: System generates language switcher links
The system SHALL generate formatted language switcher links for all target languages.

#### Scenario: Generate links for single README
- **WHEN** README is translated to multiple languages
- **THEN** system generates links in format: `[Language Name](./translations/{lang}/README.md)`
- **AND** combines links with separator: ` | `
- **AND** wraps in section header: `## 🌐 Translations / 多语言`

#### Scenario: Handle language name display
- **WHEN** generating language switcher
- **THEN** each link shows language name in native script
- **AND** includes English name in tooltip or parenthetical

### Requirement: System inserts language links at optimal position
The system SHALL insert or update language switcher section at the optimal position in README.

#### Scenario: Insert after existing language section
- **WHEN** README already has language switcher section
- **THEN** system updates existing section with new links
- **AND** preserves original section position

#### Scenario: Insert before table of contents
- **WHEN** README has table of contents but no language section
- **THEN** system inserts language section before TOC
- **AND** ensures proper Markdown formatting

#### Scenario: Insert after title/description
- **WHEN** README has title and description but no TOC
- **THEN** system inserts language section after description paragraph
- **AND** adds horizontal rule before and after for visual separation

#### Scenario: Insert at beginning as fallback
- **WHEN** README has minimal structure (just title)
- **THEN** system inserts language section after title
- **AND** maintains document readability

### Requirement: System preserves README content integrity
The system SHALL ensure language link insertion does not corrupt or alter existing README content.

#### Scenario: Preserve existing content
- **WHEN** inserting language links
- **THEN** all original README content remains unchanged
- **AND** only the language switcher section is added or updated

#### Scenario: Handle special Markdown features
- **WHEN** README contains HTML blocks, comments, or frontmatter
- **THEN** system preserves these elements
- **AND** inserts language section in appropriate location

### Requirement: System updates all README files consistently
The system SHALL apply language link insertion consistently across all translated README files.

#### Scenario: Update main README
- **WHEN** main README.md is translated
- **THEN** system inserts language links in original README
- **AND** each translation also gets appropriate language links

#### Scenario: Update subdirectory READMEs
- **WHEN** subdirectory docs/guide/README.md exists
- **AND** it is included in translation scope
- **THEN** system applies same language link insertion logic
- **AND** adjusts paths relative to subdirectory location

### Requirement: System uses OpenRouter API for README analysis
The system SHALL use OpenRouter API to analyze README structure and determine optimal insertion strategy.

#### Scenario: Analyze with platform quota
- **WHEN** user has no OpenRouter API key configured
- **THEN** system uses platform-provided AI quota for README analysis
- **AND** applies same rate limiting as translation tasks

#### Scenario: Analyze with user API key
- **WHEN** user has configured their own OpenRouter API key
- **THEN** system uses user's API key for README analysis
- **AND** does not consume platform quota
