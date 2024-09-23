interface Job {
    name: string
    result: JobResult
    callback: Function
}

interface JobResult {
    status: JobStatus
    message?: string
    error?: Error
}

interface Batcher {
    batchSize: number
    maxJobs: number
    isShutdown: boolean
    queue: Job[]
    shutdown: Function
    addJob: (args: AddJobParams) => Job
}

interface BatcherParams {
    batchSize?: number // The number of jobs to process in each batch
    frequency: number // Millisecond delay between processing batches
    processor: Function // Function that will process each job
    maxJobs?: number // Maximum number of jobs to queue
    log?: Function // Logging function
}

interface AddJobParams {
    name?: string // handy name to give a particular job
    callback: Function // function that will be executed when job is processed
}

export enum JobStatus {
    Pending = "PENDING",
    InProgress = "IN_PROGRESS",
    Complete = "COMPLETE",
    Failed = "FAILED"
}

export enum BatcherErrors {
    ShuttingDown = "BATCHER_SHUTTING_DOWN",
    QueueFull = "BATCHER_QUEUE_FULL"
}

/**
 * Creates a new batch processor.
 * 
 * @param args The arguments object.
 * @param args.batchSize (optional) The number of jobs that should be processed in a single batch, default 1.
 * @param args.frequency The number of milliseconds to wait between batches (must be > 0).
 * @param args.processor A callback function that processes a single job.
 * @param args.maxJobs (optional) The maximum number of jobs that can be held in the queue at any time. Defaults to 0 (no limit).
 * @param args.log (optional) A logging function to use, defaults to console.log.
 * @returns An error if the batch queue is full, or if the batcher is shutting down.
 */
const newBatcher = ({ batchSize = 1, frequency, processor, maxJobs = 0, log = console.log }: BatcherParams) => {
    if (frequency < 1) {
        throw new Error('frequency cannot be less than 1ms');
    }
    
    const addJob = ({ name, callback }: AddJobParams): Job => {
        if (batcher.isShutdown) {
            throw new Error(BatcherErrors.ShuttingDown);
        } else {
            // If maxJobs is set, ensure there's room in the queue
            if (batcher.maxJobs === 0 || batcher.queue.length < batcher.maxJobs) {
                const job: Job = {
                    name: name || crypto.randomUUID(),
                    callback,
                    result: {
                        status: JobStatus.Pending
                    }
                };
                batcher.queue.push(job);
                return job;
            } else {
                throw new Error(BatcherErrors.QueueFull);
            }
        }
    };

    const processBatch = async () => {
        if (batcher.queue.length) {
            // If number of remaining jobs < batchSize, save some loops
            const size = Math.min(batcher.batchSize, batcher.queue.length);

            log(`Processing batch of ${size} jobs.`);

            // This holds a list of pending promises representing each job
            const currentBatch: Promise<void>[] = [];

            // Process the next batch of jobs
            for (let i = 0; i < size; i++) {
                // Remove the first job and process it
                const job = batcher.queue.shift();
                if (job) {
                    // Add an IIFE to push a promise onto the current batch
                    currentBatch.push((async () => {
                    job.result.status = JobStatus.InProgress;

                    try {
                        await processor(job);
                        job.result.status = JobStatus.Complete;
                        job.result.message = "Job completed without errors";
                    } catch (err) {
                        job.result.status = JobStatus.Failed;
                        job.result.message = "Job returned an error. Error type unknown";
                        
                        if (err instanceof Error) {
                            job.result.error = err;
                            job.result.message = "Job returned an error";
                        }
                    }
                    })());
                }
            }

            // Ensure all job processing is done for the current batch
            // We don't want an unhandled error to kill the whole batch
            await Promise.allSettled(currentBatch);

            // Check for shutdown
            if (batcher.isShutdown && batcher.queue.length === 0) {
                // This was the final batch
                clearInterval(interval);
                log("Batch processor shut down");
            }
        } else {
            log(`No jobs to process - waiting ${frequency} ms...`);
        }
    };

    const interval = setInterval(processBatch, frequency);
    log(`Starting batch processor - waiting ${frequency}ms...`);

    // shutdown signals the batcher to shut down
    const shutdown = () => {
        if (!batcher.isShutdown) {
            batcher.isShutdown = true;
            log("Shutting down batch processor...");
        }
    }

    const batcher: Batcher = {
        batchSize,
        maxJobs,
        isShutdown: false,
        shutdown,
        queue: [],
        addJob
    };

    // Return the batcher
    return batcher;
};

export {
    newBatcher
};
