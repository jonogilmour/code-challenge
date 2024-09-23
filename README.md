# Micro-batching Library

## Specs & Assumptions
- Usable as an external library.
- Configurable batch size and frequency.
- Batch size of > 0 enforced.
- Frequency can be set to `null`, meaning the next batch starts only after the previous batch is complete.

## Testing
run `npm test` to run the test library