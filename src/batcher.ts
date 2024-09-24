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
    maxBatches: number
    isShutdown: boolean
    queue: Job[]
    shutdown: Function
    addJob: (args: AddJobParams) => Job
}

interface BatcherParams {
    batchSize?: number // The number of jobs to process in each batch
    frequency: number // Millisecond delay between processing batches
    batchProcessor: Function
    maxBatches?: number // Maximum number of batches to queue
    log?: Function // Logging function
}

interface AddJobParams {
    name?: string // handy name to give a particular job
    callback: Function // function that will be executed when job is processed
}

interface ProcessBatchParams {
    queue: Job[]
    log?: Function
    jobProcessor: (job: Job) => Promise<void>
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
 * Creates a new micro-batcher.
 * 
 * @param args The arguments object.
 * @param args.batchSize (optional) The number of jobs that should be processed in a single batch, default 1.
 * @param args.frequency The number of milliseconds to wait between batches (must be > 0).
 * @param args.maxBatches (optional) The maximum number of batches that can be held in the queue at any time (ie. queue max = batch size * max batches). Defaults to 0 (no limit).
 * @param args.log (optional) A logging function to use, defaults to console.log.
 * @returns An error if the batch queue is full, or if the batcher is shutting down.
 */
const newBatcher = ({ batchSize = 1, frequency, maxBatches = 0, batchProcessor, log = console.log }: BatcherParams) => {
    if (frequency < 1) {
        throw new Error('frequency cannot be less than 1ms');
    }

    if (batchSize < 1) {
        throw new Error('batch size cannot be less than 1');
    }
    
    // Adds a new job onto the queue. A job should 
    const addJob = ({ name, callback }: AddJobParams): Job => {
        if (batcher.isShutdown) {
            throw new Error(BatcherErrors.ShuttingDown);
        } else {
            // If maxBatches is set, ensure there's room in the queue
            if (batcher.maxBatches < 1 || batcher.queue.length < batcher.maxBatches * batcher.batchSize) {
                const job: Job = {
                    name: name || crypto.randomUUID(), // Default name to a uuid 
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

    const processBatch = async (batchProcessor: (batchSize: number) => Promise<PromiseSettledResult<void>[]>) => {
        if (batcher.queue.length) {
            // If number of remaining jobs < batchSize, save some loops
            const size = Math.min(batcher.batchSize, batcher.queue.length);
    
            log(`Processing batch of ${size} jobs.`);
    
            await batchProcessor(size);

            // Check for shutdown
            if (batcher.isShutdown && batcher.queue.length === 0) {
                // This was the final batch
                clearInterval(interval);
                log("Batch processor shut down");
            }
        } else {
            log(`No jobs to process - waiting ${frequency} ms...`);
        }
    }

    // shutdown signals the batcher to shut down
    const shutdown = () => {
        if (!batcher.isShutdown) {
            batcher.isShutdown = true;
            log("Shutting down batch processor...");
        }
    }

    const batcher: Batcher = {
        batchSize,
        maxBatches: maxBatches < 1 ? 0 : Math.floor(maxBatches),
        isShutdown: false,
        shutdown,
        queue: [],
        addJob
    };

    const jobProcessor = newJobProcessor();
    const batchProcessor1 = newBatchProcessor({ log, queue: batcher.queue, jobProcessor });

    // Start the batching process
    const interval = setInterval(() => processBatch(batchProcessor1), frequency);
    log(`Starting batch processor - waiting ${frequency}ms...`);

    // Return the batcher
    return batcher;
};

// A new batch processor
const newBatchProcessor = ({ log = console.log, queue, jobProcessor }: ProcessBatchParams) => async (batchSize: number) => {
    // This holds a list of pending promises representing each job
    const currentBatch: Promise<void>[] = [];

    // Process the next batch of jobs
    for (let i = 0; i < batchSize; i++) {
        // Remove the first job and process it
        const job = queue.shift();
        if (job) {
            // Push the promise onto the current batch
            currentBatch.push(jobProcessor(job));
        }
    }

    // Ensure all job processing is done for the current batch
    // We don't want an unhandled error to kill the whole batch
    return Promise.allSettled(currentBatch);
};

// A new job processor
const newJobProcessor = () => async (job: Job) => {
    job.result.status = JobStatus.InProgress;

    try {
        await job.callback();
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
}

export {
    newBatcher
};
