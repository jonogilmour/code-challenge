# Micro-batching Library

A simple library that processes batches of jobs on a minimum frequency.

## Specs & Assumptions

- Usable as an external library.
- A "job" is just an object with a `callback` function in it that does some work. The job "processor" would just call the callback.
- Configurable batch size and frequency.
- Batch size and frequency of > 0 enforced.
- Can set the maximum number of batches that can be queued - meaning max jobs queued = batch size * max batches. This ensures the queue size is always a multiple of batch size.
- A batch need not be full to be processed - if size of queue is lower than batch size, the remaining jobs will be processed as a batch.
- Dependency injection for a batch processor (basic implementation included).
- addJob method returns a `JobResult` that resolves with the result of the `Job` when that Job is run
- Shutdown method returns a promise that resolves when all jobs are finished processing

## Usage

Create a new batcher:

```js
const batcher = newBatcher({ log, batchSize, frequency, batchProcessor, maxBatches })
```

- `log` is a log function with the same signature as `console.log`.
- `batchSize` is the max number of jobs to process in each batch.
- `frequency` is the minimum number of milliseconds between batches.
- `batchProcessor` takes a single named param `{ batch }`, where `batch` is an array of functions (aka jobs).
- `maxBatches` is the maximum number of batches to queue before new jobs are rejected from the queue (the queue is full).

Add a new job using:

```js
const jobResult = batcher.addJob(job);
```

`job` is any function that does some work.

`jobResult` is a promise that resolves to the **return value** of `job` when the job is completed, or rejects with an error thrown by `job`.

To shutdown the batcher:

```js
const shutdownPromise = batcher.shutdown();
await shutdownPromise;
```

The batcher will not accept new jobs once it has been called to shut down. Once the job queue is empty and all batches have been processed, `shutdownPromise` will resolve.

## Building

Run `npm run build` to compile the TS into CommonJS in the `dist` directory.

## Testing

Run `npm test` to run the test library. Run `npm run testw` to run the test library in watch mode.

## Caveats and Thought Process

Due to the way JS intervals work, the frequency is a *minimum* time between batches. `setInterval` calls after **at least** `frequency` ms have passed, meaning depending on the system load or the size of a batch's requirements multiple intervals could pass before a new batch is picked up.