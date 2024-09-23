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
 * @param args.batchSize The number of jobs that should be processed in a single batch.
 * @param args.frequency The number of milliseconds to wait between batches.
 * @param args.processor A callback function that processes a single job.
 * @param args.maxJobs (optional) The maximum number of jobs that can be held in the queue at any time. Defaults to 0 (no limit).
 * @returns An error if the batch queue is full, or if the batcher is shutting down.
 */
const newBatcher = ({ batchSize = 1, frequency, processor, maxJobs = 0 }: BatcherParams) => {
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

    const processBatch = () => {
    };

    const interval = setInterval(processBatch, frequency);
    console.log(`Starting batch processor - waiting ${frequency} ms...`);

    // shutdown signals the batcher to shut down
    const shutdown = () => {
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
