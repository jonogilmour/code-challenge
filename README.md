# Micro-batching Library

A simple library that processes batches of jobs on a minimum frequency.

## Specs & Assumptions

- Usable as an external library.
- A "job" is just an object with a `callback` function in it that does some work. The job "processor" would just call the callback.
- Configurable batch size and frequency.
- Batch size and frequency of > 0 enforced.
- Can set the maximum number of batches that can be queued - meaning max jobs queued = batch size * max batches. This ensures the queue size is always a multiple of batch size.
- Each job can be tracked internally, meaning the state of the job is saved inside the job object. The `job.result` can be checked to see if a job is pending, in progress, completed, or failed with an error.
- A batch need not be full to be processed - if size of queue is lower than batch size, the remaining jobs will be processed as a batch.
- Dependency injection for a batch processor (basic implementation included).

## Building

Run `npm run build` to compile the TS into CommonJS in the `dist` directory.

## Testing

Run `npm test` to run the test library. Run `npm run testw` to run the test library in watch mode.

## Caveats and Thought Process

I ran out of time to test it fully in a "library" scenario, but the test suite does pass and has many tests. Given more time I would build, for example, a CLI to push in jobs, and log to the console when jobs are in-progress or complete to show their status.

Due to the way JS intervals work, the frequency is a *minimum* time between batches. `setInterval` calls after **at least** `frequency` ms have passed, meaning depending on the system load or the size of a batch's requirements multiple intervals could pass before a new batch is picked up.

Also, because a batch must complete processing before another batch can be brought in, a whole batch can be held in limbo by a single large job hanging or taking a long time to run.

A possible solution to this could be using worker threads (available as of Node v12) to dispatch threads to handle CPU bound jobs, but time didn't allow this to be explored.