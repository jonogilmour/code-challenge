import { newBatcher } from "./batcher";

describe(`Batcher`, () => {
    jest.useFakeTimers();

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
        it(`should add a new job to the batcher job queue`, () => {
            expect(1).toBe(0);
        }); 

        it(`should add a default job name if none is supplied`, () => {
            expect(1).toBe(0);
        });

        it(`should not add a job if the batcher is shutting down`, () => {
            expect(1).toBe(0);
        });

        it(`should not add a job if the queue is full`, () => {
            expect(1).toBe(0);
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