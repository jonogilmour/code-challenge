import { newBatcher, BatcherErrors, JobStatus } from "./batcher";

const asyncProcessor = (delay: number) => () => new Promise<void>((resolve, reject) => {
    setTimeout(resolve, delay);
});

describe(`Batcher`, () => {
    jest.useFakeTimers();

    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(crypto, 'randomUUID').mockImplementation(() => 'so-m-eu-ui-d');
    });

    describe(`newBatcher`, () => {
        it(`should create a new Batcher`, async () => {
            const processor = () => true;
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor, maxBatches: 5 });
            const batcherWithDefaults = newBatcher({ log: () => {}, frequency: 1000, processor });

            expect(batcher.batchSize).toBe(100);
            expect(batcher.maxBatches).toBe(5);
            expect(batcher.isShutdown).toBe(false);

            expect(batcherWithDefaults.batchSize).toBe(1);
            expect(batcherWithDefaults.maxBatches).toBe(0);
        });

        it(`should throw an error if frequency is < 1`, async () => {
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: 0, processor: () => {}, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: 0.5, processor: () => {}, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: -0.5, processor: () => {}, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: -1, processor: () => {}, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: Number.MIN_SAFE_INTEGER, processor: () => {}, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
        });

        it(`should throw an error if frequency is < 1`, async () => {
            expect(() => newBatcher({ log: () => {}, batchSize: 0, frequency: 100, processor: () => {}, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: 0.5, frequency: 100, processor: () => {}, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: -1, frequency: 100, processor: () => {}, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: -0.5, frequency: 100, processor: () => {}, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: -100, frequency: 100, processor: () => {}, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: Number.MIN_SAFE_INTEGER, frequency: 100, processor: () => {}, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
        });

        it(`should default maxBatches to 0, to a minimum of 0, and round any float values`, async () => {
            const processor = () => true;

            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor, maxBatches: -1 });
            expect(batcher.maxBatches).toBe(0);

            const batcher2 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor, maxBatches: 0.5 });
            expect(batcher2.maxBatches).toBe(0);

            const batcher3 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor, maxBatches: 3.5 });
            expect(batcher3.maxBatches).toBe(3);

            const batcher4 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor, maxBatches: -3.5 });
            expect(batcher4.maxBatches).toBe(0);

            const batcher5 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor, maxBatches: Number.MIN_SAFE_INTEGER });
            expect(batcher5.maxBatches).toBe(0);

            const batcher6 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor, maxBatches: -1.245643 });
            expect(batcher6.maxBatches).toBe(0);
        });
    });

    describe(`batch processing`, () => {
        it(`should employ a FIFO queue, with the oldest jobs being processed first`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 1, frequency: 1000, processor: () => {}, maxBatches: 5 });
            const callback = () => null;
            
            batcher.addJob({ callback, name: '1' });
            batcher.addJob({ callback, name: '2' });
            batcher.addJob({ callback, name: '3' });

            expect(batcher.queue).toEqual([
                expect.objectContaining({ name: '1' }), 
                expect.objectContaining({ name: '2' }), 
                expect.objectContaining({ name: '3' })
            ]);

            await jest.advanceTimersByTimeAsync(1000);
            expect(batcher.queue).toEqual([
                expect.objectContaining({ name: '2' }), 
                expect.objectContaining({ name: '3' })
            ]);

            await jest.advanceTimersByTimeAsync(1000);
            expect(batcher.queue).toStrictEqual([
                expect.objectContaining({ name: '3' })
            ]);

            await jest.advanceTimersByTimeAsync(1000);
            expect(batcher.queue).toStrictEqual([]);
        });

        it(`should run on an interval schedule`, async () => {
            let jobsProcessed = 0;

            const batcher = newBatcher({ log: () => {}, batchSize: 2, frequency: 1000, processor: () => jobsProcessed++, maxBatches: 5 });
            const callback = () => null;
            
            batcher.addJob({ callback, name: '1' });
            batcher.addJob({ callback, name: '2' });
            batcher.addJob({ callback, name: '3' });
            batcher.addJob({ callback, name: '4' });
            batcher.addJob({ callback, name: '5' });

            expect(jobsProcessed).toBe(0);

            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(2);

            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(4);

            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(5);
        });

        it(`should process all remaining jobs if the batch size is larger than the remaining jobs`, async () => {
            let jobsProcessed = 0;

            const batcher = newBatcher({ log: () => {}, batchSize: 10, frequency: 1000, processor: () => jobsProcessed++, maxBatches: 15 });
            const callback = () => null;
            
            batcher.addJob({ callback });
            batcher.addJob({ callback });
            batcher.addJob({ callback });

            expect(jobsProcessed).toBe(0);
            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(3); // Ensure it doesn't try to reference jobs out of bounds
        });

        it(`should keep processing new jobs that come in after the queue is emptied`, async () => {
            let jobsProcessed = 0;

            const batcher = newBatcher({ log: () => {}, batchSize: 10, frequency: 1000, processor: () => jobsProcessed++, maxBatches: 15 });
            const callback = () => null;
            
            batcher.addJob({ callback });
            batcher.addJob({ callback });
            batcher.addJob({ callback });

            expect(jobsProcessed).toBe(0);
            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(3);

            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(3); // Ensure it's no longer processing any jobs

            batcher.addJob({ callback });
            batcher.addJob({ callback });

            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(5);
        });

        it(`should mark started jobs as in progress, and then complete when finished, with a saved message`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor: asyncProcessor(500), maxBatches: 5 });
            const callback = () => null;
            
            const job = batcher.addJob({ callback });

            expect(job.result.message).toBeUndefined();
            expect(job.result.status).toBe(JobStatus.Pending);

            await jest.advanceTimersByTimeAsync(1000);

            expect(job.result.status).toBe(JobStatus.InProgress);

            await jest.advanceTimersByTimeAsync(500);

            expect(job.result.status).toBe(JobStatus.Complete);
            expect(job.result.message).toBeDefined(); // Don't need to test the message contents
        });

        it(`should mark a job as failed and save the error if an error occurs`, async () => {
            const e = new Error('oops');
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor: ({ callback }: any) => callback(), maxBatches: 5 });            
            const job = batcher.addJob({ callback: () => { throw e; } }); // Called by the processor

            expect(job.result.status).toBe(JobStatus.Pending);

            await jest.advanceTimersByTimeAsync(1000);

            expect(job.result.status).toBe(JobStatus.Failed);
            expect(job.result.error).toBe(e);
        });

        it(`should stop the processing interval if the batcher is shutdown and the last batch is processed`, async () => {
            jest.spyOn(global, 'clearInterval');
            const clearIntervalSpy = jest.mocked(clearInterval);

            const batcher = newBatcher({ log: () => {}, batchSize: 1, frequency: 1000, processor: () => {}, maxBatches: 5 });
            const callback = () => null;
            
            batcher.addJob({ callback });
            batcher.addJob({ callback });
            batcher.addJob({ callback });

            expect(clearIntervalSpy).not.toHaveBeenCalled();

            batcher.shutdown();

            expect(clearIntervalSpy).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1000);
            expect(batcher.queue).toHaveLength(2);

            expect(clearIntervalSpy).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1000);
            expect(batcher.queue).toHaveLength(1);

            expect(clearIntervalSpy).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1000);
            expect(batcher.queue).toHaveLength(0);

            expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe(`addJob`, () => {
        it(`should return the new job with the specified callback, and default UUID name`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor: () => true, maxBatches: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback });

            expect(job.name).toBe('so-m-eu-ui-d');
            expect(job.callback).toBe(callback);
        });

        it(`should return the new job with the specified callback and name`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor: () => true, maxBatches: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback, name: 'something' });

            expect(job.name).toBe('something');
            expect(job.callback).toBe(callback);
        });

        it(`should set the new job status to pending`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor: () => true, maxBatches: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback });

            expect(job.result.status).toBe(JobStatus.Pending);
        });

        it(`should return the new job with a the specified callback`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor: () => true, maxBatches: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback, name: 'something' });

            expect(job.name).toBe('something');
            expect(job.callback).toBe(callback);
        });

        it(`should add a new job to the batcher job queue`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor: () => true, maxBatches: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback, name: 'something' });

            expect(batcher.queue[0]).toBe(job);
        }); 

        it(`should not add a job and throw an error if the batcher is shutting down`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor: () => true, maxBatches: 5 });

            const callback = () => null;

            batcher.isShutdown = true;

            expect(() => batcher.addJob({ callback, name: 'something' })).toThrow(BatcherErrors.ShuttingDown);
        });

        it(`should not add a job and throw an error if the queue is full`, async () => {
            // Max queue size is 2 * 2 = 4
            const batcher = newBatcher({ log: () => {}, batchSize: 2, frequency: 1000, processor: () => true, maxBatches: 2 });

            const callback = () => null;

            // Add 4 jobs
            batcher.addJob({ callback });
            batcher.addJob({ callback });
            batcher.addJob({ callback });
            batcher.addJob({ callback });

            // Adding a 5th job (ie, a third batch) should throw
            expect(() => batcher.addJob({ callback })).toThrow(BatcherErrors.QueueFull);
        });
    });

    describe(`shutdown`, () => {
        it(`should mark the batch processor as "shutting down"`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, processor: () => true, maxBatches: 1 });

            expect(batcher.isShutdown).toBeFalsy();
            
            batcher.shutdown();

            expect(batcher.isShutdown).toBeTruthy();
        });
    });
});