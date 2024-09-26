import { newBatcher, BatcherErrors, JobStatus, newBatchProcessor } from "./batcher";

const asyncProcessor = (delay: number, output?: any) => () => new Promise<void>((resolve, reject) => {
    setTimeout(() => resolve(output), delay);
});

describe(`Batcher`, () => {
    jest.useFakeTimers();

    const batchProcessor = newBatchProcessor();

    beforeEach(() => {
        jest.resetAllMocks();
        jest.clearAllTimers();
        jest.spyOn(crypto, 'randomUUID').mockImplementation(() => 'so-m-eu-ui-d');
    });

    describe(`newBatcher`, () => {
        it(`should create a new Batcher`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: 5 });
            const batcherWithDefaults = newBatcher({ log: () => {}, frequency: 1000, batchProcessor });

            expect(batcher.batchSize).toBe(100);
            expect(batcher.maxBatches).toBe(5);
            expect(batcher.isShutdown).toBe(false);

            expect(batcherWithDefaults.batchSize).toBe(1);
            expect(batcherWithDefaults.maxBatches).toBe(0);
        });

        it(`should throw an error if frequency is < 1`, async () => {
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: 0, batchProcessor, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: 0.5, batchProcessor, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: -0.5, batchProcessor, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: -1, batchProcessor, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
            expect(() => newBatcher({ log: () => {}, batchSize: 100, frequency: Number.MIN_SAFE_INTEGER, batchProcessor, maxBatches: 5 })).toThrow('frequency cannot be less than 1ms');
        });

        it(`should throw an error if frequency is < 1`, async () => {
            expect(() => newBatcher({ log: () => {}, batchSize: 0, frequency: 100, batchProcessor, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: 0.5, frequency: 100, batchProcessor, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: -1, frequency: 100, batchProcessor, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: -0.5, frequency: 100, batchProcessor, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: -100, frequency: 100, batchProcessor, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
            expect(() => newBatcher({ log: () => {}, batchSize: Number.MIN_SAFE_INTEGER, frequency: 100, batchProcessor, maxBatches: 5 })).toThrow('batch size cannot be less than 1');
        });

        it(`should default maxBatches to 0, to a minimum of 0, and round any float values`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: -1 });
            expect(batcher.maxBatches).toBe(0);

            const batcher2 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: 0.5 });
            expect(batcher2.maxBatches).toBe(0);

            const batcher3 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: 3.5 });
            expect(batcher3.maxBatches).toBe(3);

            const batcher4 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: -3.5 });
            expect(batcher4.maxBatches).toBe(0);

            const batcher5 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: Number.MIN_SAFE_INTEGER });
            expect(batcher5.maxBatches).toBe(0);

            const batcher6 = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: -1.245643 });
            expect(batcher6.maxBatches).toBe(0);
        });
    });

    describe(`batch processing`, () => {
        it(`should employ a FIFO queue, with the oldest jobs being processed first`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 1, frequency: 1000, batchProcessor, maxBatches: 5 });       
            
            let job1Done = false;
            let job2Done = false;
            let job3Done = false;

            const job1 = batcher.addJob(() => { job1Done = true; });
            const job2 = batcher.addJob(() => { job2Done = true; });
            const job3 = batcher.addJob(() => { job3Done = true; });

            await jest.advanceTimersByTimeAsync(1000);

            expect(job1Done).toBe(true);
            expect(job2Done).toBe(false);
            expect(job3Done).toBe(false);

            await jest.advanceTimersByTimeAsync(1000);
            
            expect(job1Done).toBe(true);
            expect(job2Done).toBe(true);
            expect(job3Done).toBe(false);

            await jest.advanceTimersByTimeAsync(1000);
            
            expect(job1Done).toBe(true);
            expect(job2Done).toBe(true);
            expect(job3Done).toBe(true);
        });

        it(`should run on an interval schedule, processing a batch at a time`, async () => {
            let jobsProcessed = 0;

            const batcher = newBatcher({ log: () => {}, batchSize: 2, frequency: 1000, batchProcessor, maxBatches: 5 });
            const job = () => jobsProcessed++;
            
            batcher.addJob(job);
            batcher.addJob(job);
            batcher.addJob(job);
            batcher.addJob(job);
            batcher.addJob(job);

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

            const batcher = newBatcher({ log: () => {}, batchSize: 10, frequency: 1000, batchProcessor, maxBatches: 15 });
            const job = () => jobsProcessed++;
            
            batcher.addJob(job);
            batcher.addJob(job);
            batcher.addJob(job);

            expect(jobsProcessed).toBe(0);

            await jest.advanceTimersByTimeAsync(1000);

            expect(jobsProcessed).toBe(3);
        });

        it(`should keep processing new jobs that come in after the queue is emptied`, async () => {
            let jobsProcessed = 0;

            const batcher = newBatcher({ log: () => {}, batchSize: 10, frequency: 1000, batchProcessor, maxBatches: 15 });
            const job = () => jobsProcessed++;
            
            batcher.addJob(job);
            batcher.addJob(job);
            batcher.addJob(job);

            expect(jobsProcessed).toBe(0);
            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(3);

            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(3); // Ensure it's no longer processing any jobs

            batcher.addJob(job);
            batcher.addJob(job);

            await jest.advanceTimersByTimeAsync(1000);
            expect(jobsProcessed).toBe(5);
        });

        it(`should resolve the JobResult on success`, async () => {
            const thing = { a: 1 };
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: 5 });
            const job = jest.fn(asyncProcessor(500, thing));
            
            const jobResult = batcher.addJob(job);

            expect(job).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1000);

            expect(job).toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(500);

            const result = await jobResult;

            expect(result).toBe(thing);
        });

        it(`should reject the JobResult if an error occurs`, async () => {
            expect.assertions(1);

            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: 5 });            
            const jobResult = batcher.addJob(async () => { throw new Error('oops'); });

            try {
                // Not async because this would attempt to run promise handlers first, meaning job result would resolve prematurely
                jest.advanceTimersByTime(1000); 
                await jobResult;
            } catch (err) {
                expect(err).toEqual(new Error('oops'));
            }
        });

        it(`should stop the processing interval if the batcher is shutdown and the last batch is processed`, async () => {
            jest.spyOn(global, 'clearInterval');
            const clearIntervalSpy = jest.mocked(clearInterval);

            const batcher = newBatcher({ log: () => {}, batchSize: 1, frequency: 1000, batchProcessor, maxBatches: 5 });
            
            batcher.addJob(() => null);
            batcher.addJob(() => null);
            batcher.addJob(() => null);

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

            // Clear all waiting jobs
            await Promise.all(batcher.queue);
        });
    });

    describe(`addJob`, () => {
        it(`should add a new job to the queue`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: 5 });

            expect(batcher.queue.length).toBe(0);

            batcher.addJob(() => null);

            expect(batcher.queue.length).toBe(1);
        });

        it(`should not add a job and throw an error if the batcher is shutting down`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: 5 });

            batcher.isShutdown = true;

            expect.assertions(1);

            try {
                await batcher.addJob(() => null);
            } catch (error) {
                expect(error).toEqual(new Error(BatcherErrors.ShuttingDown))
            }
        });

        it(`should not add a job and throw an error if the queue is full`, async () => {
            // Max queue size is 2 * 2 = 4
            const batcher = newBatcher({ log: () => {}, batchSize: 2, frequency: 1000, batchProcessor, maxBatches: 2 });

            // Add 4 jobs
            batcher.addJob(() => null);
            batcher.addJob(() => null);
            batcher.addJob(() => null);
            batcher.addJob(() => null);

            // Adding a 5th job (ie, a third batch) should throw
            try {
                await batcher.addJob(() => null);
            } catch (error) {
                expect(error).toEqual(new Error(BatcherErrors.QueueFull));
            }
        });
    });

    describe(`shutdown`, () => {
        it(`should mark the batch processor as "shutting down"`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: 1 });

            expect(batcher.isShutdown).toBeFalsy();
            
            batcher.shutdown();

            expect(batcher.isShutdown).toBeTruthy();
        });

        it(`should return a promise that resolves only when the queue is cleared`, async () => {
            const batcher = newBatcher({ log: () => {}, batchSize: 100, frequency: 1000, batchProcessor, maxBatches: 1 });

            batcher.addJob(() => null);

            let isFinalised = false;
            
            // This will wait for shutdown
            (async () => {
                await batcher.shutdown();
                isFinalised = true;
            })();

            expect(isFinalised).toBe(false); // Jobs not done even though shutdown was called

            await jest.advanceTimersByTimeAsync(1000);

            expect(isFinalised).toBe(true); // Jobs done, shutdown finished
        });
    });
});