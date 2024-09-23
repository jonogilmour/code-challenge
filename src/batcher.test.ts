import { newBatcher, BatcherErrors } from "./batcher";

describe(`Batcher`, () => {
    jest.useFakeTimers();

    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(crypto, 'randomUUID').mockImplementation(() => 'so-m-eu-ui-d');
    });

    describe(`newBatcher`, () => {
        it(`should create a new Batcher`, () => {
            const processor = () => true;
            const batcher = newBatcher({ batchSize: 100, frequency: 1000, processor, maxJobs: 5 });
            const batcherWithDefaults = newBatcher({ frequency: 1000, processor });

            expect(batcher.batchSize).toBe(100);
            expect(batcher.maxJobs).toBe(5);
            expect(batcher.isShutdown).toBe(false);

            expect(batcherWithDefaults.batchSize).toBe(1);
            expect(batcherWithDefaults.maxJobs).toBe(0);
        });
    });

    describe(`batch processing`, () => {
        it(`should run on an interval schedule`, () => {
            expect(1).toBe(0);
        });

        it(`should mark jobs as in progress`, () => {
            expect(1).toBe(0);
        });

        it(`should mark a job as complete when it is finished`, () => {
            expect(1).toBe(0);
        });

        it(`should mark a job as failed if an error occurs`, () => {
            expect(1).toBe(0);
        });
    });

    describe(`addJob`, () => {
        it(`should return the new job with a default UUID name`, () => {
            const batcher = newBatcher({ batchSize: 100, frequency: 1000, processor: () => true, maxJobs: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback });

            expect(job.name).toBe('so-m-eu-ui-d');
            expect(job.callback).toBe(callback);
        });

        it(`should return the new job with the specified callback and name`, () => {
            const batcher = newBatcher({ batchSize: 100, frequency: 1000, processor: () => true, maxJobs: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback, name: 'something' });

            expect(job.name).toBe('something');
            expect(job.callback).toBe(callback);
        });

        it(`should set the new job status to pending`, () => {
            const batcher = newBatcher({ batchSize: 100, frequency: 1000, processor: () => true, maxJobs: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback });

            expect(job.result.status).toBe(JobStatus.Pending);
        });

        it(`should return the new job with a the specified callback`, () => {
            const batcher = newBatcher({ batchSize: 100, frequency: 1000, processor: () => true, maxJobs: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback, name: 'something' });

            expect(job.name).toBe('something');
            expect(job.callback).toBe(callback);
        });

        it(`should add a new job to the batcher job queue`, () => {
            const batcher = newBatcher({ batchSize: 100, frequency: 1000, processor: () => true, maxJobs: 5 });

            const callback = () => null;

            const job = batcher.addJob({ callback, name: 'something' });

            expect(batcher.queue[0]).toBe(job);
        }); 

        it(`should not add a job and throw an error if the batcher is shutting down`, () => {
            const batcher = newBatcher({ batchSize: 100, frequency: 1000, processor: () => true, maxJobs: 5 });

            const callback = () => null;

            batcher.isShutdown = true;

            expect(() => batcher.addJob({ callback, name: 'something' })).toThrow(BatcherErrors.ShuttingDown);
        });

        it(`should not add a job and throw an error if the queue is full`, () => {
            const batcher = newBatcher({ batchSize: 100, frequency: 1000, processor: () => true, maxJobs: 1 });

            const callback = () => null;

            batcher.addJob({ callback, name: 'something1' });

            // Adding a second job should throw
            expect(() => batcher.addJob({ callback, name: 'something2' })).toThrow(BatcherErrors.QueueFull);
        });
    });

    describe(`shutdown`, () => {
        it(`should mark the batch processor as "shutting down"`, () => {
            expect(1).toBe(0);
        });

        it(`should clear the interval when the queue is empty`, () => {
            expect(1).toBe(0);
        });
    });
});