/**
 * Copyright (c) 2017-present Unito Inc.
 * All Rights Reserved
 */
import { assert, expect } from 'chai';

import * as Backoff from '../src/backoff';


describe('backoff', () => {

  const alwaysFalse = () => false;
  const alwaysTrue = () => true;


  describe('exponentialGenerator', () => {
    const ten = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    it('returns powers of two', () => {
      const generator = Backoff.exponentialGenerator(2, 1, 1000, false);
      const values = ten.map(() => generator.next().value);
      expect(values).to.eql(ten.map(x => 2 ** x));
    });

    it('returns maxValue when passed it', () => {
      const generator = Backoff.exponentialGenerator(2, 1, 32, false);
      const values = ten.map(() => generator.next().value);
      expect(values).to.eql([1, 2, 4, 8, 16, 32, 32, 32, 32, 32]);
    });

    it('multiplies values by a factor', () => {
      const generator = Backoff.exponentialGenerator(2, 50, 1e6, false);
      const values = ten.map(() => generator.next().value);
      expect(values).to.eql(ten.map(x => 50 * (2 ** x)));
    });

    it('can add full jitter', () => {
      const generator = Backoff.exponentialGenerator(2, 1, 1000, true);
      const values = ten.map(() => generator.next().value);
      const expectedMax = ten.map(x => 2 ** x);
      for (const idx in values) {
        expect(values[idx]).not.to.be.below(0);
        expect(values[idx]).not.to.be.above(expectedMax[idx]);
      }
    });

    it('always returns rounded-up values', () => {
      const generator = Backoff.exponentialGenerator(2, 5, 1000, true);
      const values = ten.map(() => generator.next().value);
      for (const value of values) {
        expect(Math.round(value)).to.equal(value);
      }
    });

    it('uses the passed in base', () => {
      const generator = Backoff.exponentialGenerator(3, 1, 20000, false);
      const values = ten.map(() => generator.next().value);
      expect(values).to.eql(ten.map(x => 3 ** x));
    });

    it('supports a base of 1', () => {
      const generator = Backoff.exponentialGenerator(1, 12, 10000, false);
      const values = ten.map(() => generator.next().value);
      expect(values).to.eql(ten.map(x => 12));
    });

  });

  describe('retry', () => {
    async function add(a: number, b: number): Promise<number> {
      return a + b;
    }

    async function faultyCall(): Promise<void> {
      throw new Error('foo');
    }


    it('calls the target function with arguments', async () => {
      const result = await Backoff.retry(
        {}, add, null, 2, 6,
      );
      expect(result).to.eql(8);
    });

    it('can bind the target function', async () => {
      class Wrapper {
        offset = 10;
        async subtract(x: number): Promise<number> {
          return x - this.offset;
        }
      }

      const wrapper = new Wrapper();
      const result = await Backoff.retry(
        {}, wrapper.subtract, wrapper, 21,
      );
      expect(result).to.eql(11);
    });

    it('throws error if not matching predicate', async () => {
      try {
        await Backoff.retry({
          predicate: alwaysFalse,
        }, faultyCall);

        assert(false, 'function should throw');
      } catch (err) {
        expect(err.message).to.eql('foo');
      }
    });

    it('throws an error if maxRetries is reached', async () => {
      try {
        await Backoff.retry({
          predicate: alwaysTrue,
          maxRetries: 2,
        }, faultyCall);
        assert(false, 'function should throw');
      } catch (err) {
        expect(err.message).to.match(/Maximum of 2 retries/);
      }
    });

  });

  describe('backoffWith decorator', () => {

    class Decotest {
      offset = 10;

      @Backoff.backoffWith({})
      async add(x: number): Promise<number> {
        return x + this.offset;
      }

      @Backoff.backoffWith({ predicate: alwaysFalse })
      async nonMatchingCall(): Promise<void> {
        throw new Error('foo');
      }

      @Backoff.backoffWith({ maxRetries: 2, predicate: alwaysTrue })
      async matchingCall(): Promise<void> {
        throw new Error('foo');
      }
    }

    const decotest = new Decotest();


    it('calls the target function with arguments', async () => {
      const result = await decotest.add(8);
      expect(result).to.eql(18);
    });

    it('throws error if not matching predicate', async () => {
      try {
        await decotest.nonMatchingCall();
        assert(false, 'function should throw');
      } catch (err) {
        expect(err.message).to.eql('foo');
      }
    });

    it('throws an error if maxRetries is reached', async () => {
      try {
        await decotest.matchingCall();
        assert(false, 'function should throw');
      } catch (err) {
        expect(err.message).to.match(/Maximum of 2 retries/);
      }
    });

  });


  describe('backoff decorator', () => {

    class Decotest {
      offset = 10;
      numCalled = 0;
      backoffOptions = {
        maxRetries: 3,
        maxDelayMs: 1,
        predicate: () => true,
      };

      @Backoff.backoff
      async add(x: number): Promise<number> {
        return x + this.offset;
      }

      @Backoff.backoff
      async matchingCall(): Promise<void> {
        this.numCalled++;
        throw new Error('foo');
      }
    }

    const decotest = new Decotest();


    it('calls the target function with arguments', async () => {
      const result = await decotest.add(8);
      expect(result).to.eql(18);
    });

    it('uses the instance backoffOptions', async () => {
      try {
        await decotest.matchingCall();
        assert(false, 'function should throw');
      } catch (err) {
        expect(err.message).to.match(/Maximum of 3 retries/);
        expect(decotest.numCalled).to.eql(3);
      }
    });

  });

});
