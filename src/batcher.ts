interface Batcher {
    batchSize: number
    maxBatches: number
    isShutdown: boolean
    shutdownResolver?: Resolver
    queue: Job[]
    shutdown: Function
    addJob: (job: Job) => Promise<void>
}

interface BatcherParams {
    batchSize?: number // The number of jobs to process in each batch
    frequency: number // Millisecond delay between processing batches
    batchProcessor: BatchProcessor // Injectable batch processor
    maxBatches?: number // Maximum number of batches to queue
    log?: Function // Logging function
}

interface BatchProcessorParams {
    batch: Job[]
}

type Resolver = (value: void | PromiseLike<void>) => void;

type Job = (...args: any) => any | Promise<any>;

type BatchProcessor = (args: BatchProcessorParams) => Promise<any>;

type JobResult = Promise<any>;

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
 * @param args.batchProcessor A function that processes a batch.
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
    
    // Adds a new job onto the queue. The resturned JobResult is a promise that resolves upon completion of the job (success or fail).
    const addJob = (job: Job): JobResult => new Promise((resolve, reject) => {
        if (batcher.isShutdown) {
            reject(new Error(BatcherErrors.ShuttingDown));
        } else {
            // If maxBatches is set, ensure there's room in the queue
            if (batcher.maxBatches < 1 || batcher.queue.length < batcher.maxBatches * batcher.batchSize) {

                // A batchJob is a wrapper around the job that resolves the jobResult
                const batchJob = async () => {
                    try {
                        resolve(await job());
                    } catch (err) {
                        reject(err);
                    }
                    return 1;
                };

                batcher.queue.push(batchJob);
            } else {
                reject(new Error(BatcherErrors.QueueFull));
            }
        }
    });

    // put in a job, and await the result returned from addJob
    // addjob adds to a queue
    // when the batch processor processes that job, it should resolve the result promise

    const processBatch = async (batchProcessor: BatchProcessor) => {
        if (batcher.queue.length) {    
            log(`Processing batch.`);

            const batch = batcher.queue.splice(0, batcher.batchSize);
    
            await batchProcessor({ batch });

            // Check for shutdown
            if (batcher.isShutdown && batcher.queue.length === 0 && batcher.shutdownResolver) {
                // This was the final batch
                clearInterval(interval);
                batcher.shutdownResolver();
                log('Batch processor shut down');
            }
        } else {
            log(`No jobs to process - waiting ${frequency} ms...`);
        }
    }

    // shutdown signals the batcher to shut down
    const shutdown = () => {
        if (!batcher.isShutdown) {
            batcher.isShutdown = true;

            return new Promise((resolve) => {
                log('Shutting down batch processor...');
                batcher.shutdownResolver = resolve
            });
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

    // Start the batching process
    const interval = setInterval(() => {
        processBatch(batchProcessor);
    }, frequency);
    log(`Starting batch processor - waiting ${frequency}ms...`);

    // Return the batcher
    return batcher;
};

// Returns a basic batch processor function.
const newBatchProcessor = (): BatchProcessor => ({ batch }) => Promise.allSettled(batch.map(job => job()));

export {
    newBatcher,
    newBatchProcessor
};
