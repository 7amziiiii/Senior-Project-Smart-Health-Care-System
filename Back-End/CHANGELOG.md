# CHANGELOG

## [Unreleased]

### Added
- Created `VerificationSession` model with one-to-one relationship to `OperationSession`
- Added documentation for `OperationType.required_instruments` canonical JSON schema
- Added unit test for `VerificationSession` creation
- Implemented RFID reader scanning utility:
  - `verify_reader_connectivity()` - Serial connectivity verification for readers
  - `read_from_reader()` - Single reader tag scanning
  - `scan_all_rfid_tags()` - Round-robin multi-reader scanning with deduplication
- Added comprehensive unit tests for RFID scanning utilities
